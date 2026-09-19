import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Paperclip,
  X,
  FileText,
  File,
  Film,
  Music,
  Image as ImageIcon,
  UploadCloud,
} from 'lucide-react';
import { formatFileSize } from './chatUtils';
import toast from 'react-hot-toast';

// Allowed file extensions and category limits (bytes)
const MAX_SIZES = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 25 * 1024 * 1024, // 25MB
  ARCHIVE: 50 * 1024 * 1024, // 50MB
  AUDIO: 50 * 1024 * 1024, // 50MB
  VIDEO: 100 * 1024 * 1024, // 100MB
};

const ACCEPT_STRING = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/x-m4a',
].join(',');

/**
 * MessageComposer Component — Phase 18
 * Rich chat composer with text auto-expansion, attachment picker,
 * pre-upload preview card with thumbnail, drag-and-drop file upload,
 * upload progress bar, and keyboard shortcuts.
 */
const MessageComposer = ({
  onSend,
  onSendAttachment,
  disabled = false,
  placeholder = 'Type a message...',
}) => {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea
  const handleInput = (e) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
  };

  // Generate and cleanup object URL for image preview
  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreviewUrl(null);
    }
  }, [selectedFile]);

  // File validation
  const validateAndSelectFile = (file) => {
    if (!file) return;

    // Check MIME category and size limit
    const mime = file.mimetype || file.type || '';
    let category = 'DOCUMENT';
    let maxAllowed = MAX_SIZES.DOCUMENT;

    if (mime.startsWith('image/')) {
      category = 'IMAGE';
      maxAllowed = MAX_SIZES.IMAGE;
    } else if (mime.startsWith('video/')) {
      category = 'VIDEO';
      maxAllowed = MAX_SIZES.VIDEO;
    } else if (mime.startsWith('audio/')) {
      category = 'AUDIO';
      maxAllowed = MAX_SIZES.AUDIO;
    } else if (mime.includes('zip')) {
      category = 'ARCHIVE';
      maxAllowed = MAX_SIZES.ARCHIVE;
    }

    if (file.size > maxAllowed) {
      const maxMb = Math.round(maxAllowed / (1024 * 1024));
      toast.error(`${category} files cannot exceed ${maxMb}MB in size.`);
      return;
    }

    setSelectedFile(file);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
    // Reset file input value so selecting the same file again triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = () => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setUploadProgress(0);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !sending) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || sending) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  // Send message or attachment
  const handleSend = async () => {
    const trimmed = content.trim();
    if ((!trimmed && !selectedFile) || sending || disabled) return;

    setSending(true);
    setUploadProgress(0);

    try {
      if (selectedFile && onSendAttachment) {
        await onSendAttachment(selectedFile, trimmed, (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(pct);
          }
        });
        handleRemoveAttachment();
      } else if (trimmed && onSend) {
        await onSend(trimmed);
      }

      // Clear text
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '42px';
        textareaRef.current.focus();
      }
    } catch (err) {
      console.error('Failed to send message/attachment:', err);
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (Boolean(content.trim()) || Boolean(selectedFile)) && !sending && !disabled;

  // File icon for preview card
  const getPreviewIcon = () => {
    if (!selectedFile) return File;
    const type = selectedFile.type || '';
    if (type.startsWith('video/')) return Film;
    if (type.startsWith('audio/')) return Music;
    if (type.includes('pdf') || type.includes('word') || type.includes('text')) return FileText;
    return File;
  };

  const PreviewIcon = getPreviewIcon();

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 select-none relative transition-colors ${
        isDragOver ? 'bg-powder-50/70 dark:bg-powder-950/40' : ''
      }`}
    >
      {/* ── Drag & Drop Overlay ─────────────────────────────────────────── */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 bg-powder-500/10 dark:bg-powder-500/20 backdrop-blur-xs border-2 border-dashed border-powder-500 rounded-t-xl flex items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-powder-600 dark:text-powder-300 font-semibold text-sm">
            <UploadCloud className="w-6 h-6 animate-bounce" />
            <span>Drop file here to attach</span>
          </div>
        </div>
      )}

      {/* ── Selected Attachment Preview Card ────────────────────────────── */}
      {selectedFile && (
        <div className="mb-2.5 p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            {filePreviewUrl ? (
              <img
                src={filePreviewUrl}
                alt="Upload preview"
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-powder-50 dark:bg-powder-950/50 border border-powder-200 dark:border-powder-800/50 flex items-center justify-center text-powder-600 dark:text-powder-400 shrink-0">
                <PreviewIcon className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemoveAttachment}
            disabled={sending}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0"
            title="Remove attachment"
            aria-label="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Upload Progress Bar ─────────────────────────────────────────── */}
      {sending && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
            <span>Uploading attachment...</span>
            <span className="font-mono font-medium">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-powder-500 transition-all duration-150 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Main Input & Buttons Bar ─────────────────────────────────────── */}
      <div className="flex items-end gap-2">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleFileInputChange}
          className="hidden"
          id="chat-file-input"
          aria-label="Upload attachment"
        />

        {/* Attachment (Paperclip) Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          className="p-2.5 rounded-xl text-slate-500 hover:text-powder-600 dark:text-slate-400 dark:hover:text-powder-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 focus:outline-none focus:ring-2 focus:ring-powder-400/50"
          title="Attach file (Images, PDF, Docs, Video, Audio, ZIP)"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text Area */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            placeholder={
              selectedFile ? 'Add a caption (optional)...' : placeholder
            }
            rows={1}
            className="w-full resize-none px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-powder-400/50 focus:border-transparent transition max-h-32 scrollbar-thin leading-relaxed"
            style={{ minHeight: '42px' }}
            aria-label={selectedFile ? 'Add a caption' : 'Write a message'}
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`p-2.5 rounded-xl transition-all duration-150 shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-powder-400/50 ${
            canSend
              ? 'bg-powder-500 text-white hover:bg-powder-600 active:scale-95 shadow-sm shadow-powder-500/25 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
          }`}
          title={
            canSend
              ? selectedFile
                ? 'Send attachment'
                : 'Send message (Enter)'
              : 'Enter message or attach file'
          }
          aria-label="Send message or attachment"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* ── Hint / Character Counter ─────────────────────────────────────── */}
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
