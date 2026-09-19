import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  ArrowLeft,
  Users,
  User,
  Hash,
  Loader2,
  AlertCircle,
  MessageCircle,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as chatService from '../services/chatService';
import toast from 'react-hot-toast';

/**
 * Chat Page — Phase 15
 *
 * WhatsApp-Web-style two-panel chat interface.
 * Left: Conversation list (projects + direct messages)
 * Right: Message view with composer
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Format relative time
// ─────────────────────────────────────────────────────────────────────────────
const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDateDivider = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Avatar
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = ({ name, imageUrl, size = 'md', className = '' }) => {
  const getInitials = (n) => {
    if (!n) return '?';
    const parts = n.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  };

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div
      className={`${sizes[size]} rounded-full overflow-hidden bg-gradient-to-br from-powder-400 to-powder-600 text-white font-bold flex items-center justify-center shrink-0 ${className}`}
      title={name}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW CONVERSATION MODAL
// ─────────────────────────────────────────────────────────────────────────────
const NewConversationModal = ({ onClose, onCreated }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchTimeout = useRef(null);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await chatService.searchUsers(query);
        setSearchResults(data.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectUser = async (userId) => {
    setCreating(true);
    try {
      const data = await chatService.createDirectConversation(userId);
      onCreated(data.conversation);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Message</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users by name or email..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-400 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto px-2 pb-3">
          {searching && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Searching...</span>
            </div>
          )}

          {!searching && searchQuery && searchResults.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No users found</p>
            </div>
          )}

          {!searching && searchResults.map((user) => (
            <button
              key={user._id}
              onClick={() => handleSelectUser(user._id)}
              disabled={creating}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition text-left group"
            >
              <Avatar name={user.name} imageUrl={user.profileImageURL} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
              <MessageCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-powder-500 transition shrink-0" />
            </button>
          ))}

          {!searching && !searchQuery && (
            <div className="text-center py-8 text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search for a user to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION LIST PANEL
// ─────────────────────────────────────────────────────────────────────────────
const ConversationList = ({ conversations, activeId, onSelect, onNewConversation, loading, currentUser }) => {
  const [filter, setFilter] = useState('');

  const projectConvos = conversations.filter((c) => c.type === 'PROJECT');
  const directConvos = conversations.filter((c) => c.type === 'DIRECT');

  const filterConvo = (conv) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    if (conv.type === 'PROJECT') {
      return conv.project?.name?.toLowerCase().includes(q);
    }
    const otherUser = conv.participants?.find((p) => p._id !== currentUser?._id);
    return otherUser?.name?.toLowerCase().includes(q) || otherUser?.email?.toLowerCase().includes(q);
  };

  const filteredProjects = projectConvos.filter(filterConvo);
  const filteredDirect = directConvos.filter(filterConvo);

  const getConvoDisplayInfo = (conv) => {
    if (conv.type === 'PROJECT') {
      return {
        name: conv.project?.name || 'Unnamed Project',
        icon: <Hash className="w-4 h-4 text-powder-500" />,
        avatar: null,
      };
    }
    const otherUser = conv.participants?.find((p) => p._id !== currentUser?._id);
    return {
      name: otherUser?.name || 'Unknown User',
      icon: null,
      avatar: <Avatar name={otherUser?.name} imageUrl={otherUser?.profileImageURL} size="sm" />,
    };
  };

  const getLastMessagePreview = (conv) => {
    if (!conv.lastMessage) return 'No messages yet';
    const senderName = conv.lastMessage.sender?._id === currentUser?._id ? 'You' : conv.lastMessage.sender?.name?.split(' ')[0];
    const content = conv.lastMessage.content || '';
    const preview = content.length > 40 ? content.substring(0, 40) + '...' : content;
    return `${senderName}: ${preview}`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Chat</h2>
          <button
            onClick={onNewConversation}
            className="p-2 rounded-xl bg-powder-50 dark:bg-powder-950/40 text-powder-600 dark:text-powder-400 hover:bg-powder-100 dark:hover:bg-powder-900/50 transition"
            title="New conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-400/50 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">Loading conversations...</p>
          </div>
        ) : (
          <>
            {/* Project Conversations */}
            {filteredProjects.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Project Channels
                </div>
                {filteredProjects.map((conv) => {
                  const info = getConvoDisplayInfo(conv);
                  return (
                    <button
                      key={conv._id}
                      onClick={() => onSelect(conv)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-0.5 text-left transition-all duration-150 ${
                        activeId === conv._id
                          ? 'bg-powder-50 dark:bg-powder-950/50 border border-powder-200/60 dark:border-powder-800/40 shadow-xs'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-powder-100 to-powder-200 dark:from-powder-900/60 dark:to-powder-800/40 flex items-center justify-center shrink-0">
                        {info.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-semibold truncate ${
                            activeId === conv._id ? 'text-powder-700 dark:text-powder-300' : 'text-slate-900 dark:text-white'
                          }`}>
                            {info.name}
                          </p>
                          {conv.lastMessageAt && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                              {formatTime(conv.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {getLastMessagePreview(conv)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Direct Messages */}
            {filteredDirect.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Direct Messages
                </div>
                {filteredDirect.map((conv) => {
                  const info = getConvoDisplayInfo(conv);
                  return (
                    <button
                      key={conv._id}
                      onClick={() => onSelect(conv)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-0.5 text-left transition-all duration-150 ${
                        activeId === conv._id
                          ? 'bg-powder-50 dark:bg-powder-950/50 border border-powder-200/60 dark:border-powder-800/40 shadow-xs'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                      }`}
                    >
                      {info.avatar}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-semibold truncate ${
                            activeId === conv._id ? 'text-powder-700 dark:text-powder-300' : 'text-slate-900 dark:text-white'
                          }`}>
                            {info.name}
                          </p>
                          {conv.lastMessageAt && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                              {formatTime(conv.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {getLastMessagePreview(conv)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {filteredProjects.length === 0 && filteredDirect.length === 0 && !filter && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <MessageSquare className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium mb-1">No conversations yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center px-4">
                  Start a new conversation or join a project to begin chatting
                </p>
                <button
                  onClick={onNewConversation}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-powder-500 text-white hover:bg-powder-600 transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Message
                </button>
              </div>
            )}

            {filteredProjects.length === 0 && filteredDirect.length === 0 && filter && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Search className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No matching conversations</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE VIEW PANEL
// ─────────────────────────────────────────────────────────────────────────────
const MessageView = ({ conversation, currentUser, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Load messages
  const loadMessages = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const data = await chatService.getMessages(conversation._id, { page: pageNum, limit: 30 });
      const fetched = data.messages || [];

      if (append) {
        setMessages((prev) => [...prev, ...fetched]);
      } else {
        setMessages(fetched);
      }
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [conversation._id]);

  useEffect(() => {
    setPage(1);
    loadMessages(1);
  }, [conversation._id, loadMessages]);

  // Scroll to bottom on initial load or new message sent
  useEffect(() => {
    if (!loading && page === 1 && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [loading, page, messages.length]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await loadMessages(nextPage, true);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const data = await chatService.sendMessage(conversation._id, content);
      const msg = data.message;
      setMessages((prev) => [msg, ...prev]);
      // Scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      setNewMessage(content); // Restore message on failure
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine conversation display name
  const getConversationName = () => {
    if (conversation.type === 'PROJECT') {
      return conversation.project?.name || 'Project Chat';
    }
    const otherUser = conversation.participants?.find((p) => p._id !== currentUser?._id);
    return otherUser?.name || 'Chat';
  };

  const getConversationSubtext = () => {
    if (conversation.type === 'PROJECT') {
      const count = conversation.participants?.length || 0;
      return `${count} member${count !== 1 ? 's' : ''}`;
    }
    const otherUser = conversation.participants?.find((p) => p._id !== currentUser?._id);
    return otherUser?.email || '';
  };

  // Group messages by date, displayed in chronological order (reversed from API)
  const chronologicalMessages = [...messages].reverse();

  const groupedMessages = [];
  let lastDate = '';
  chronologicalMessages.forEach((msg) => {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastDate) {
      groupedMessages.push({ type: 'divider', date: msg.createdAt });
      lastDate = msgDate;
    }
    groupedMessages.push({ type: 'message', data: msg });
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Conversation Header */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition lg:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {conversation.type === 'PROJECT' ? (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-powder-100 to-powder-200 dark:from-powder-900/60 dark:to-powder-800/40 flex items-center justify-center shrink-0">
            <Hash className="w-5 h-5 text-powder-500" />
          </div>
        ) : (
          <Avatar
            name={getConversationName()}
            imageUrl={conversation.participants?.find((p) => p._id !== currentUser?._id)?.profileImageURL}
            size="md"
          />
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {getConversationName()}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {getConversationSubtext()}
          </p>
        </div>

        {conversation.type === 'PROJECT' && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-powder-50 dark:bg-powder-950/40 text-powder-600 dark:text-powder-400">
            <Users className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{conversation.participants?.length || 0}</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">Loading messages...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <AlertCircle className="w-8 h-8 mb-2 text-rose-400" />
            <p className="text-sm text-rose-500">{error}</p>
          </div>
        ) : (
          <>
            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center py-3">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-xs"
                >
                  {loadingMore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                  )}
                  Load earlier messages
                </button>
              </div>
            )}

            {/* Messages */}
            {groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4 shadow-xs">
                  <MessageCircle className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium mb-1">No messages yet</p>
                <p className="text-xs text-center">Send the first message to start the conversation</p>
              </div>
            ) : (
              groupedMessages.map((item, idx) => {
                if (item.type === 'divider') {
                  return (
                    <div key={`divider-${idx}`} className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        {formatDateDivider(item.date)}
                      </span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                    </div>
                  );
                }

                const msg = item.data;
                const isOwn = msg.sender?._id === currentUser?._id;
                const prevItem = idx > 0 ? groupedMessages[idx - 1] : null;
                const isSameSenderAsPrev = prevItem?.type === 'message' && prevItem.data.sender?._id === msg.sender?._id;

                return (
                  <div
                    key={msg._id}
                    className={`flex gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'} ${isSameSenderAsPrev ? 'mt-0.5' : 'mt-3'}`}
                  >
                    {/* Sender avatar (only for others, first in a group) */}
                    {!isOwn && !isSameSenderAsPrev && (
                      <Avatar name={msg.sender?.name} imageUrl={msg.sender?.profileImageURL} size="sm" className="mt-1" />
                    )}
                    {!isOwn && isSameSenderAsPrev && <div className="w-8 shrink-0" />}

                    <div className={`max-w-[75%] min-w-[60px] ${isOwn ? 'items-end' : 'items-start'}`}>
                      {/* Sender name (only for others, first in a group) */}
                      {!isOwn && !isSameSenderAsPrev && (
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 px-1">
                          {msg.sender?.name}
                        </p>
                      )}

                      <div
                        className={`relative px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-xs ${
                          isOwn
                            ? 'bg-powder-500 text-white rounded-br-md'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700/60 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 text-right ${
                          isOwn ? 'text-powder-200' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {formatMessageTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Composer */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-400/50 focus:border-transparent transition max-h-32 scrollbar-thin"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className={`p-2.5 rounded-xl transition shrink-0 ${
              newMessage.trim() && !sending
                ? 'bg-powder-500 text-white hover:bg-powder-600 shadow-sm shadow-powder-500/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
            title="Send message"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1.5 px-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CHAT PAGE
// ─────────────────────────────────────────────────────────────────────────────
const Chat = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [mobileShowMessages, setMobileShowMessages] = useState(false);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await chatService.getConversations();
        setConversations(data.conversations || []);
      } catch (err) {
        toast.error('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setMobileShowMessages(true);
  };

  const handleBack = () => {
    setMobileShowMessages(false);
  };

  const handleNewConversationCreated = (conv) => {
    setShowNewModal(false);
    // Add to list if not already present
    setConversations((prev) => {
      const exists = prev.find((c) => c._id === conv._id);
      if (exists) return prev;
      return [conv, ...prev];
    });
    setActiveConversation(conv);
    setMobileShowMessages(true);
  };

  return (
    <div className="h-[calc(100vh-5rem)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 flex overflow-hidden bg-white dark:bg-slate-900 rounded-none lg:rounded-2xl lg:mx-0 lg:mt-0 lg:border lg:border-slate-200 lg:dark:border-slate-800 lg:shadow-sm lg:h-[calc(100vh-7rem)]">
      {/* Left Panel: Conversation List */}
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
        />
      </div>

      {/* Right Panel: Message View */}
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
          />
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-powder-100 to-mint-100 dark:from-powder-900/30 dark:to-mint-900/30 flex items-center justify-center shadow-inner">
                <MessageSquare className="w-10 h-10 text-powder-400 dark:text-powder-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-mint-400 dark:bg-mint-600 flex items-center justify-center shadow-md">
                <Send className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
              StudySync Chat
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center max-w-xs mb-6 leading-relaxed">
              Select a conversation from the sidebar or start a new one to begin messaging your team.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-powder-500 text-white hover:bg-powder-600 transition shadow-sm shadow-powder-500/20"
            >
              <Plus className="w-4 h-4" />
              Start a Conversation
            </button>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
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
