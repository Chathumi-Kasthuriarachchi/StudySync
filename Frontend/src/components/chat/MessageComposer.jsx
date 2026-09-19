import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

/**
 * MessageComposer Component — Phase 17
 * Pinned chat composer with auto-expanding textarea, Enter to send,
 * Shift+Enter for newline, disabled states, and keyboard accessibility.
 */
const MessageComposer = ({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}) => {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea based on text content
  const handleInput = (e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      // Clear and reset textarea
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '42px';
        textareaRef.current.focus();
      }
    } catch (err) {
      // Input content is preserved on error
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = Boolean(content.trim()) && !sending && !disabled;

  return (
    <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 select-none">
      <div className="flex items-end gap-2.5">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            placeholder={placeholder}
            rows={1}
            className="w-full resize-none px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-powder-400/50 focus:border-transparent transition max-h-32 scrollbar-thin leading-relaxed"
            style={{ minHeight: '42px' }}
            aria-label="Write a message"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`p-2.5 rounded-xl transition-all duration-150 shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-powder-400/50 ${
            canSend
              ? 'bg-powder-500 text-white hover:bg-powder-600 active:scale-95 shadow-sm shadow-powder-500/25 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
          }`}
          title={canSend ? 'Send message (Enter)' : 'Enter message content'}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1">
        <span>
          Press <kbd className="font-sans px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Enter</kbd> to send, <kbd className="font-sans px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Shift + Enter</kbd> for new line
        </span>
        <span className={content.length > 4500 ? 'text-amber-500 font-semibold' : ''}>
          {content.length > 4000 ? `${content.length}/5000` : ''}
        </span>
      </div>
    </div>
  );
};

export default MessageComposer;
