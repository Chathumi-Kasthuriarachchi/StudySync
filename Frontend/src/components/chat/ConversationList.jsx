import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  X,
  MessageSquare,
  AlertCircle,
  Hash,
  Users,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import ConversationItem from './ConversationItem';
import ConnectionBadge from './ConnectionBadge';

/**
 * ConversationList Component — Phase 17
 * Left-panel conversation list featuring separated project/direct sections,
 * search filtering, unread pill indicators, loading skeletons, and empty states.
 */
const ConversationList = ({
  conversations = [],
  activeId,
  onSelect,
  onNewConversation,
  loading = false,
  currentUser,
  connectionStatus = 'connected',
  unreadMap = {},
  error = null,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations by query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase().trim();

    return conversations.filter((conv) => {
      if (conv.type === 'PROJECT') {
        return conv.project?.name?.toLowerCase().includes(query);
      }
      const otherUser = conv.participants?.find((p) => p._id !== currentUser?._id);
      return (
        otherUser?.name?.toLowerCase().includes(query) ||
        otherUser?.email?.toLowerCase().includes(query)
      );
    });
  }, [conversations, searchQuery, currentUser?._id]);

  // Separate Project Channels vs Direct Messages
  const projectConvos = useMemo(
    () => filteredConversations.filter((c) => c.type === 'PROJECT'),
    [filteredConversations]
  );

  const directConvos = useMemo(
    () => filteredConversations.filter((c) => c.type === 'DIRECT'),
    [filteredConversations]
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Messages
            </h2>
            <ConnectionBadge status={connectionStatus} />
          </div>

          <button
            type="button"
            onClick={onNewConversation}
            className="p-2 rounded-xl bg-powder-50 dark:bg-powder-950/50 text-powder-600 dark:text-powder-400 hover:bg-powder-100 dark:hover:bg-powder-900/60 transition shadow-xs focus:outline-none focus:ring-2 focus:ring-powder-400/50"
            title="Start new direct message"
            aria-label="Start new conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* ── Search Bar ────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-powder-400/40 focus:border-transparent transition"
            aria-label="Search conversations by project or name"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Conversation List ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4 scrollbar-thin">
        {/* Loading Skeletons */}
        {loading ? (
          <div className="space-y-2 p-1" aria-label="Loading conversations">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 animate-pulse"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-28 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="w-10 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="w-3/4 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Unable to load conversations
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
              {error}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── 1. Project Channels Section ──────────────────────────────── */}
            {projectConvos.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-3 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    Project Channels
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[10px]">
                    {projectConvos.length}
                  </span>
                </div>

                <div role="list" aria-label="Project Channels">
                  {projectConvos.map((conv) => (
                    <ConversationItem
                      key={conv._id}
                      conversation={conv}
                      active={activeId === conv._id}
                      onSelect={onSelect}
                      currentUser={currentUser}
                      unreadCount={unreadMap[conv._id] || 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── 2. Direct Messages Section ───────────────────────────────── */}
            {directConvos.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-3 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Direct Messages
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[10px]">
                    {directConvos.length}
                  </span>
                </div>

                <div role="list" aria-label="Direct Messages">
                  {directConvos.map((conv) => (
                    <ConversationItem
                      key={conv._id}
                      conversation={conv}
                      active={activeId === conv._id}
                      onSelect={onSelect}
                      currentUser={currentUser}
                      unreadCount={unreadMap[conv._id] || 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── 3. Empty State: No search results ────────────────────────── */}
            {searchQuery && filteredConversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  No conversations found
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 max-w-xs">
                  No project or direct messages match "{searchQuery}"
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* ── 4. Empty State: No conversations at all ──────────────────── */}
            {!searchQuery && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-powder-50 to-mint-50 dark:from-powder-950/50 dark:to-mint-950/50 border border-powder-100 dark:border-powder-900/40 flex items-center justify-center mb-4 shadow-xs">
                  <MessageSquare className="w-8 h-8 text-powder-500 dark:text-powder-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  No conversations yet
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-xs mb-5 leading-relaxed">
                  Start a project conversation or message a team member to begin collaborating.
                </p>
                <button
                  type="button"
                  onClick={onNewConversation}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-powder-500 text-white hover:bg-powder-600 transition shadow-sm shadow-powder-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Start a Conversation
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
