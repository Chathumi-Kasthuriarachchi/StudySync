import React from 'react';
import Avatar from './Avatar';
import { formatMessageTime } from './chatUtils';

/**
 * MessageBubble Component — Phase 17
 * Renders individual chat message with sender grouping, custom corner radii,
 * high-contrast StudySync palette, and wrapped content.
 */
const MessageBubble = ({
  message,
  isOwn = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  isGroupedWithPrev = false,
}) => {
  const senderName = message.sender?.name || 'Someone';

  return (
    <div
      className={`flex gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'} ${
        isGroupedWithPrev ? 'mt-1' : 'mt-3.5'
      }`}
      role="article"
      aria-label={`${isOwn ? 'You' : senderName}: ${message.content}`}
    >
      {/* ── Left Avatar (Only for other senders) ─────────────────────────── */}
      {!isOwn && (
        <div className="w-8 shrink-0 flex items-end">
          {isFirstInGroup ? (
            <Avatar
              name={senderName}
              imageUrl={message.sender?.profileImageURL}
              size="sm"
              className="mb-0.5"
            />
          ) : (
            <div className="w-8" aria-hidden="true" />
          )}
        </div>
      )}

      {/* ── Bubble Container ────────────────────────────────────────────── */}
      <div className={`max-w-[78%] sm:max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender Name (Only for other senders on initial message in sequence) */}
        {!isOwn && isFirstInGroup && (
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 px-1">
            {senderName}
          </p>
        )}

        {/* Message Card */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs transition-shadow ${
            isOwn
              ? `bg-powder-600 dark:bg-powder-600 text-white ${
                  isLastInGroup ? 'rounded-tr-xs' : ''
                }`
              : `bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700/60 ${
                  isLastInGroup ? 'rounded-tl-xs' : ''
                }`
          }`}
        >
          {/* Plaintext Content */}
          <p className="whitespace-pre-wrap break-words selection:bg-powder-200 selection:text-powder-900">
            {message.content}
          </p>

          {/* Formatted Message Timestamp */}
          <p
            className={`text-[10px] mt-1 select-none text-right font-medium ${
              isOwn ? 'text-powder-100/80' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {formatMessageTime(message.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
