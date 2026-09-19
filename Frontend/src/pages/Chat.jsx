import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Plus, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import * as chatService from '../services/chatService';
import socketService from '../services/socketService';
import ConversationList from '../components/chat/ConversationList';
import MessageView from '../components/chat/MessageView';
import NewConversationModal from '../components/chat/NewConversationModal';
import toast from 'react-hot-toast';

/**
 * Chat Page — Phase 17
 * Main collaboration tab coordinator managing conversations, active thread selection,
 * local unread counters, document title indicators, and Socket.IO real-time subscriptions.
 */
const Chat = () => {
  const { user } = useAuth();
  const { recentNotifications, markAsRead } = useNotifications() || {};

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [mobileShowMessages, setMobileShowMessages] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [unreadMap, setUnreadMap] = useState({});

  // ── 1. Fetch Conversations via REST ───────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatService.getConversations();
      const list = data.conversations || [];
      setConversations(list);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load conversations');
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── 2. Socket Connection & Lifecycle Listeners ────────────────────────────
  useEffect(() => {
    // Connect socket
    socketService.connect();

    // Listen to connection status changes
    const unsubStatus = socketService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // Listen to conversation preview updates (lastMessage, lastMessageAt)
    const unsubConvoUpdate = socketService.onConversationUpdated((data) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c._id === data.conversationId);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessage: data.lastMessage,
          lastMessageAt: data.lastMessageAt,
        };

        // Re-sort conversations by newest message activity
        return updated.sort((a, b) => {
          const dateA = new Date(a.lastMessageAt || a.updatedAt || 0);
          const dateB = new Date(b.lastMessageAt || b.updatedAt || 0);
          return dateB - dateA;
        });
      });
    });

    // Listen to incoming real-time messages for global unread tracking
    const unsubNewMessage = socketService.onNewMessage((newMsg) => {
      const convId = newMsg.conversation;

      // Update conversation list preview
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === convId);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          lastMessage: newMsg,
          lastMessageAt: newMsg.createdAt,
        };
        return copy.sort((a, b) => {
          const dateA = new Date(a.lastMessageAt || a.updatedAt || 0);
          const dateB = new Date(b.lastMessageAt || b.updatedAt || 0);
          return dateB - dateA;
        });
      });

      // If user is not currently viewing this conversation, increment unread count
      setActiveConversation((currentActive) => {
        if (!currentActive || currentActive._id !== convId) {
          setUnreadMap((prevMap) => ({
            ...prevMap,
            [convId]: (prevMap[convId] || 0) + 1,
          }));
        }
        return currentActive;
      });
    });

    return () => {
      unsubStatus();
      unsubConvoUpdate();
      unsubNewMessage();
    };
  }, []);

  // ── 3. Dynamic Document Title Unread Counter ──────────────────────────────
  const totalUnread = useMemo(() => {
    return Object.values(unreadMap).reduce((sum, val) => sum + (val || 0), 0);
  }, [unreadMap]);

  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) StudySync Chat`;
    } else {
      document.title = 'StudySync Chat';
    }
    return () => {
      document.title = 'StudySync';
    };
  }, [totalUnread]);

  // ── 4. Select Conversation Handler ────────────────────────────────────────
  const handleSelectConversation = useCallback(
    (conv) => {
      setActiveConversation(conv);
      setMobileShowMessages(true);

      // Clear local unread counter for this conversation
      setUnreadMap((prev) => {
        if (!prev[conv._id]) return prev;
        const copy = { ...prev };
        delete copy[conv._id];
        return copy;
      });

      // Synchronize with global notification context
      if (recentNotifications && markAsRead) {
        recentNotifications
          .filter(
            (n) =>
              !n.isRead &&
              (n.sourceId === conv._id || n.metadata?.conversationId === conv._id)
          )
          .forEach((n) => markAsRead(n._id));
      }
    },
    [recentNotifications, markAsRead]
  );

  // ── 5. Back button for mobile view ────────────────────────────────────────
  const handleBack = useCallback(() => {
    setMobileShowMessages(false);
  }, []);

  // ── 6. New conversation created callback ──────────────────────────────────
  const handleNewConversationCreated = useCallback((conv) => {
    setShowNewModal(false);
    setConversations((prev) => {
      const exists = prev.find((c) => c._id === conv._id);
      if (exists) return prev;
      return [conv, ...prev];
    });
    setActiveConversation(conv);
    setMobileShowMessages(true);
  }, []);

  // ── 7. Optimistic local preview update after sending ──────────────────────
  const handleMessageSent = useCallback((convId, sentMessage) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c._id === convId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        lastMessage: sentMessage,
        lastMessageAt: sentMessage.createdAt,
      };
      return copy.sort((a, b) => {
        const dateA = new Date(a.lastMessageAt || a.updatedAt || 0);
        const dateB = new Date(b.lastMessageAt || b.updatedAt || 0);
        return dateB - dateA;
      });
    });
  }, []);

  return (
    <div className="h-[calc(100vh-5rem)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 flex overflow-hidden bg-white dark:bg-slate-900 rounded-none lg:rounded-2xl lg:mx-0 lg:mt-0 lg:border lg:border-slate-200 lg:dark:border-slate-800 lg:shadow-sm lg:h-[calc(100vh-7rem)] select-none">
      {/* ── Left Panel: Conversation List ──────────────────────────────────── */}
      <div
        className={`w-full lg:w-80 xl:w-96 shrink-0 ${
          mobileShowMessages ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeConversation?._id}
          onSelect={handleSelectConversation}
          onNewConversation={() => setShowNewModal(true)}
          loading={loading}
          currentUser={user}
          connectionStatus={connectionStatus}
          unreadMap={unreadMap}
          error={error}
          onRetry={loadConversations}
        />
      </div>

      {/* ── Right Panel: Message View ──────────────────────────────────────── */}
      <div
        className={`flex-1 min-w-0 ${
          !mobileShowMessages ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
        }`}
      >
        {activeConversation ? (
          <MessageView
            key={activeConversation._id}
            conversation={activeConversation}
            currentUser={user}
            onBack={handleBack}
            connectionStatus={connectionStatus}
            onMessageSent={handleMessageSent}
          />
        ) : (
          /* ── Empty State on Desktop ─────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 p-8 text-center select-none">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-powder-100 to-mint-100 dark:from-powder-900/40 dark:to-mint-900/40 flex items-center justify-center shadow-inner">
                <MessageSquare className="w-10 h-10 text-powder-500 dark:text-powder-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-mint-400 dark:bg-mint-600 flex items-center justify-center shadow-md">
                <Send className="w-4 h-4 text-white" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
              StudySync Chat
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mb-6 leading-relaxed">
              Select a conversation from the sidebar or start a new direct message to begin collaborating.
            </p>

            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-powder-500 text-white hover:bg-powder-600 transition shadow-sm shadow-powder-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Start a Conversation
            </button>
          </div>
        )}
      </div>

      {/* ── New Direct Conversation Modal ──────────────────────────────────── */}
      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleNewConversationCreated}
        />
      )}
    </div>
  );
};

export default Chat;
