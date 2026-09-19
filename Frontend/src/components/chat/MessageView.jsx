import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Hash,
  Loader2,
  AlertCircle,
  MessageCircle,
  ChevronUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react';
import Avatar from './Avatar';
import ConnectionBadge from './ConnectionBadge';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import { formatDateDivider, isSameDay, isWithinMinutes } from './chatUtils';
import * as chatService from '../../services/chatService';
import socketService from '../../services/socketService';
import toast from 'react-hot-toast';

/**
 * MessageView Component — Phase 17
 * Right-panel message area featuring WhatsApp-Web-style conversation header,
 * grouped message bubbles, date dividers, intelligent auto-scroll with floating
 * unread pill, loading skeletons, and integrated composer.
 */
const MessageView = ({
  conversation,
  currentUser,
  onBack,
  connectionStatus = 'connected',
  onMessageSent,
}) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Auto-scroll and floating "New messages ↓" pill state
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isNearBottomRef = useRef(true);

  // ── Conversation Display Info ─────────────────────────────────────────────
  const isProject = conversation.type === 'PROJECT';
  const otherParticipant = useMemo(
    () => conversation.participants?.find((p) => p._id !== currentUser?._id),
    [conversation.participants, currentUser?._id]
  );

  const conversationName = isProject
    ? conversation.project?.name || 'Project Channel'
    : otherParticipant?.name || 'Chat';

  const conversationSubtext = isProject
    ? `${conversation.participants?.length || 0} members`
    : otherParticipant?.email || '';

  // ── Helper: Check if container is near bottom ─────────────────────────────
  const checkIfNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const threshold = 120; // pixels from bottom
    const isNear = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isNearBottomRef.current = isNear;
    return isNear;
  }, []);

  const scrollToBottomSmooth = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
    setUnreadBelowCount(0);
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    setShowScrollDown(false);
    setUnreadBelowCount(0);
  }, []);

  // ── Handle scroll event on message container ──────────────────────────────
  const handleScroll = useCallback(() => {
    const isNear = checkIfNearBottom();
    if (isNear) {
      setShowScrollDown(false);
      setUnreadBelowCount(0);
    }
  }, [checkIfNearBottom]);

  // ── Load Messages via REST ────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const data = await chatService.getMessages(conversation._id, {
          page: pageNum,
          limit: 30,
        });
        const fetched = data.messages || [];

        if (append) {
          // Append older messages to the end of the newest-first list
          setMessages((prev) => {
            const prevIds = new Set(prev.map((m) => m._id));
            const uniqueIncoming = fetched.filter((m) => !prevIds.has(m._id));
            return [...prev, ...uniqueIncoming];
          });
        } else {
          setMessages(fetched);
        }
        setHasMore(data.hasMore);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load message history');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [conversation._id]
  );

  // ── Initial load & room management ────────────────────────────────────────
  useEffect(() => {
    setPage(1);
    setShowScrollDown(false);
    setUnreadBelowCount(0);
    loadMessages(1);

    // Join Socket.IO room for this conversation
    socketService.joinConversation(conversation._id).catch((err) => {
      console.warn('Socket joinConversation error:', err.message);
    });

    return () => {
      socketService.leaveConversation(conversation._id);
    };
  }, [conversation._id, loadMessages]);

  // ── Scroll to bottom on initial message load ──────────────────────────────
  useEffect(() => {
    if (!loading && messages.length > 0 && page === 1) {
      // Small timeout to ensure DOM has rendered messages
      const timer = setTimeout(() => {
        scrollToBottomInstant();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, messages.length, page, scrollToBottomInstant]);

  // ── Real-Time Socket Listener ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = socketService.onNewMessage((newMsg) => {
      if (newMsg.conversation === conversation._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [newMsg, ...prev];
        });

        const isOwn = newMsg.sender?._id === currentUser?._id;

        if (isOwn || isNearBottomRef.current) {
          // If own message or already at bottom, scroll down automatically
          setTimeout(() => {
            scrollToBottomSmooth();
          }, 30);
        } else {
          // User is reading history: show floating pill without force-scrolling
          setShowScrollDown(true);
          setUnreadBelowCount((count) => count + 1);
        }
      }
    });

    return () => unsubscribe();
  }, [conversation._id, currentUser?._id, scrollToBottomSmooth]);

  // ── Socket Reconnection Catchup ───────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = socketService.onReconnect(async () => {
      try {
        await socketService.joinConversation(conversation._id);
        const data = await chatService.getMessages(conversation._id, {
          page: 1,
          limit: 30,
        });
        if (data.messages) {
          setMessages((prev) => {
            const map = new Map(prev.map((m) => [m._id, m]));
            data.messages.forEach((m) => map.set(m._id, m));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
          });
        }
      } catch (err) {
        console.warn('Reconnection catchup error:', err.message);
      }
    });

    return () => unsubscribe();
  }, [conversation._id]);

  // ── Load Earlier Messages Pagination ──────────────────────────────────────
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;

    const nextPage = page + 1;
    setPage(nextPage);
    await loadMessages(nextPage, true);

    // Maintain scroll position after prepending older messages
    requestAnimationFrame(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop += newScrollHeight - previousScrollHeight;
      }
    });
  };

  // ── Message Sending Handler ───────────────────────────────────────────────
  const handleSend = async (content) => {
    let msg;
    if (socketService.isConnected()) {
      try {
        msg = await socketService.sendMessage(conversation._id, content);
      } catch (socketErr) {
        console.warn('Socket send failed, falling back to REST:', socketErr.message);
        const data = await chatService.sendMessage(conversation._id, content);
        msg = data.message;
      }
    } else {
      const data = await chatService.sendMessage(conversation._id, content);
      msg = data.message;
    }

    if (msg) {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [msg, ...prev];
      });

      // Notify parent to update conversation list preview immediately
      if (onMessageSent) {
        onMessageSent(conversation._id, msg);
      }

      setTimeout(() => {
        scrollToBottomSmooth();
      }, 30);
    }
  };

  // ── Group messages chronologically with date dividers ─────────────────────
  const groupedDisplayItems = useMemo(() => {
    // Reverse newest-first into chronological order
    const chrono = [...messages].reverse();
    const items = [];

    for (let i = 0; i < chrono.length; i++) {
      const msg = chrono[i];
      const prevMsg = i > 0 ? chrono[i - 1] : null;
      const nextMsg = i < chrono.length - 1 ? chrono[i + 1] : null;

      // Check if we need a date divider
      if (!prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt)) {
        items.push({
          type: 'divider',
          id: `divider-${msg.createdAt}`,
          date: msg.createdAt,
        });
      }

      const isSameSenderAsPrev =
        prevMsg &&
        prevMsg.sender?._id === msg.sender?._id &&
        isWithinMinutes(prevMsg.createdAt, msg.createdAt, 5);

      const isSameSenderAsNext =
        nextMsg &&
        nextMsg.sender?._id === msg.sender?._id &&
        isWithinMinutes(msg.createdAt, nextMsg.createdAt, 5);

      items.push({
        type: 'message',
        id: msg._id,
        message: msg,
        isOwn: msg.sender?._id === currentUser?._id,
        isFirstInGroup: !isSameSenderAsPrev,
        isLastInGroup: !isSameSenderAsNext,
        isGroupedWithPrev: Boolean(isSameSenderAsPrev),
      });
    }

    return items;
  }, [messages, currentUser?._id]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* ── 1. Conversation Header ─────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button on mobile view */}
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition lg:hidden"
            aria-label="Back to conversations list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Conversation Avatar / Channel Icon */}
          {isProject ? (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-powder-100 to-powder-200 dark:from-powder-900/60 dark:to-powder-800/40 border border-powder-200/50 dark:border-powder-700/30 flex items-center justify-center text-powder-600 dark:text-powder-400 shrink-0 shadow-xs">
              <Hash className="w-5 h-5" />
            </div>
          ) : (
            <Avatar
              name={conversationName}
              imageUrl={otherParticipant?.profileImageURL}
              size="md"
            />
          )}

          {/* Titles & Meta */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {conversationName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {conversationSubtext}
              </p>
              {isProject && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-powder-600 dark:text-powder-400 bg-powder-50 dark:bg-powder-950/40 px-1.5 py-0.5 rounded-md border border-powder-200/50 dark:border-powder-800/40">
                  <Users className="w-3 h-3" />
                  Channel
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="shrink-0 flex items-center gap-2">
          <ConnectionBadge status={connectionStatus} />
        </div>
      </div>

      {/* ── 2. Scrollable Messages Area ─────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 scrollbar-thin relative"
        role="log"
        aria-live="polite"
        aria-label={`Messages in ${conversationName}`}
      >
        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-4 py-4" aria-label="Loading message history">
            <div className="flex justify-center">
              <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex items-end gap-2.5 ${
                  i % 2 === 0 ? 'justify-end' : 'justify-start'
                }`}
              >
                {i % 2 !== 0 && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
                )}
                <div
                  className={`h-12 rounded-2xl animate-pulse ${
                    i % 2 === 0
                      ? 'w-48 bg-powder-200/50 dark:bg-powder-900/30 rounded-tr-xs'
                      : 'w-64 bg-slate-200 dark:bg-slate-800 rounded-tl-xs'
                  }`}
                />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State with Retry */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              Unable to load messages
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
              {error}
            </p>
            <button
              type="button"
              onClick={() => loadMessages(1)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Pagination Button: Load earlier messages */}
            {hasMore && (
              <div className="flex justify-center pt-1 pb-3">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-xs"
                  aria-label="Load older messages"
                >
                  {loadingMore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                  Load earlier messages
                </button>
              </div>
            )}

            {/* Empty Messages State */}
            {groupedDisplayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 select-none">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center mb-3 shadow-xs">
                  <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  No messages yet
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                  Send the first message to start collaborating in {conversationName}.
                </p>
              </div>
            ) : (
              /* Render Chronological Messages with Date Dividers */
              groupedDisplayItems.map((item) => {
                if (item.type === 'divider') {
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-3 select-none">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50">
                        {formatDateDivider(item.date)}
                      </span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                    </div>
                  );
                }

                return (
                  <MessageBubble
                    key={item.id}
                    message={item.message}
                    isOwn={item.isOwn}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                    isGroupedWithPrev={item.isGroupedWithPrev}
                  />
                );
              })
            )}

            {/* Bottom scroll target anchor */}
            <div ref={messagesEndRef} className="h-2" />
          </>
        )}
      </div>

      {/* ── 3. Floating "New messages ↓" Pill ───────────────────────────────── */}
      {showScrollDown && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <button
            type="button"
            onClick={scrollToBottomSmooth}
            className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-powder-500 hover:bg-powder-600 text-white text-xs font-bold shadow-lg shadow-powder-500/30 transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 active:scale-95 cursor-pointer"
            aria-label="Scroll to latest messages"
          >
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
            <span>
              {unreadBelowCount > 1
                ? `${unreadBelowCount} new messages`
                : 'New message'}
            </span>
          </button>
        </div>
      )}

      {/* ── 4. Integrated Message Composer ─────────────────────────────────── */}
      <MessageComposer
        onSend={handleSend}
        disabled={loading || Boolean(error)}
        placeholder={`Message ${conversationName}...`}
      />
    </div>
  );
};

export default MessageView;
