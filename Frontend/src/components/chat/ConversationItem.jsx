import React from 'react';
import { Hash, FolderKanban } from 'lucide-react';
import Avatar from './Avatar';
import { formatConversationTime } from './chatUtils';

/**
 * ConversationItem Component — Phase 17
 * Renders individual project or direct conversation row with previews, timestamps, and unread badge.
 */
const ConversationItem = ({
  conversation,
  active = false,
  onSelect,
  currentUser,
  unreadCount = 0,
}) => {
  const isProject = conversation.type === 'PROJECT';

  // Extract display info
  let displayName = 'Conversation';
  let otherParticipant = null;

  if (isProject) {
    displayName = conversation.project?.name || 'Unnamed Project';
  } else {
    otherParticipant = conversation.participants?.find(
      (p) => p._id !== currentUser?._id
    );
    displayName = otherParticipant?.name || 'Unknown User';
  }

  // Format last message preview
  const getLastMessagePreview = () => {
    if (!conversation.lastMessage) return 'No messages yet';

    const senderId = conversation.lastMessage.sender?._id || conversation.lastMessage.sender;
    const isOwn = senderId === currentUser?._id;
    const senderName = isOwn
      ? 'You'
      : (conversation.lastMessage.sender?.name?.split(' ')[0] || 'Someone');

    const msgType = conversation.lastMessage.messageType || 'TEXT';
    const content = conversation.lastMessage.content || '';

    let previewText = content;
    if (!previewText || msgType !== 'TEXT') {
      if (msgType === 'IMAGE') previewText = content ? `📷 ${content}` : '📷 Photo';
      else if (msgType === 'VIDEO') previewText = content ? `🎥 ${content}` : '🎥 Video';
      else if (msgType === 'AUDIO') previewText = content ? `🎵 ${content}` : '🎵 Audio';
      else if (msgType === 'FILE') {
        const fileLabel = conversation.lastMessage.attachment?.originalName || 'Attachment';
        previewText = content ? `📎 ${fileLabel} - ${content}` : `📎 ${fileLabel}`;
      }
    }

    const truncated = previewText.length > 36 ? previewText.substring(0, 36) + '...' : previewText;
    return `${senderName}: ${truncated}`;
  };

  const timeDisplay = formatConversationTime(
    conversation.lastMessageAt || conversation.updatedAt
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-all duration-150 relative group ${
        active
          ? 'bg-powder-50/90 dark:bg-powder-950/40 border border-powder-200/80 dark:border-powder-800/60 shadow-xs'
          : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50 border border-transparent'
      }`}
      aria-current={active ? 'true' : undefined}
      aria-label={`${displayName}, ${unreadCount > 0 ? `${unreadCount} unread messages` : ''}`}
    >
      {/* Active Left Accent Indicator */}
      {active && (
        <span
          className="absolute left-0 top-2 bottom-2 w-1 bg-powder-500 rounded-r-full"
          aria-hidden="true"
        />
      )}

      {/* Avatar / Icon */}
      <div className="relative shrink-0">
        {isProject ? (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-powder-100 to-powder-200 dark:from-powder-900/60 dark:to-powder-800/40 border border-powder-200/50 dark:border-powder-700/30 flex items-center justify-center text-powder-600 dark:text-powder-400 shadow-xs">
            <Hash className="w-5 h-5" />
          </div>
        ) : (
          <Avatar
            name={displayName}
            imageUrl={otherParticipant?.profileImageURL}
            size="md"
          />
        )}
      </div>

      {/* Content Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 mb-0.5">
          <p
            className={`text-sm font-semibold truncate ${
              active
                ? 'text-powder-700 dark:text-powder-300 font-bold'
                : 'text-slate-900 dark:text-slate-100 group-hover:text-powder-600 dark:group-hover:text-powder-400'
            }`}
          >
            {displayName}
          </p>
          {timeDisplay && (
            <span
              className={`text-[11px] shrink-0 font-medium ${
                unreadCount > 0
                  ? 'text-powder-600 dark:text-powder-400 font-bold'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {timeDisplay}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-xs truncate ${
              unreadCount > 0
                ? 'text-slate-800 dark:text-slate-200 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {getLastMessagePreview()}
          </p>

          {/* Unread Badge Pill */}
          {unreadCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-powder-500 text-white shadow-xs shrink-0 animate-in fade-in zoom-in duration-200"
              aria-label={`${unreadCount} unread`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ConversationItem;
