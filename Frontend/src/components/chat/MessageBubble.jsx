import React, { useState } from 'react';
import {
  FileText,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  ExternalLink,
  ZoomIn,
  Loader2,
  Music,
  Film,
  AlertCircle,
} from 'lucide-react';
import Avatar from './Avatar';
import { formatMessageTime, formatFileSize } from './chatUtils';
import * as chatService from '../../services/chatService';

/**
 * MessageBubble Component — Phase 18
 * Renders individual chat message supporting TEXT, IMAGE, FILE, VIDEO, AUDIO,
 * with presigned S3 downloads, inline media previews, and caption support.
 */
const MessageBubble = ({
  message,
  isOwn = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  isGroupedWithPrev = false,
  onOpenMedia,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const senderName = message.sender?.name || 'Someone';
  const type = message.messageType || 'TEXT';
  const attachment = message.attachment;

  // Handle direct or fresh presigned download
  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!attachment || downloading) return;

    setDownloading(true);
    try {
      let downloadUrl = attachment.downloadUrl || attachment.url;

      // If missing or potentially expired, request a fresh presigned URL
      if (!downloadUrl) {
        const convId = message.conversation?._id || message.conversation;
        const res = await chatService.getAttachmentDownloadUrl(convId, message._id);
        downloadUrl = res.downloadUrl;
      }

      if (downloadUrl) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = attachment.originalName || 'download';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Helper to get file icon and color badge
  const getFileBadge = (fileName = '', mimeType = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime = mimeType.toLowerCase();

    if (ext === 'pdf' || mime === 'application/pdf') {
      return { icon: FileText, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/40' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip')) {
      return { icon: FileArchive, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/40' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('csv')) {
      return { icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/40' };
    }
    if (['doc', 'docx'].includes(ext) || mime.includes('word')) {
      return { icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/40' };
    }
    if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py'].includes(ext)) {
      return { icon: FileCode, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/40' };
    }
    return { icon: File, color: 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  };

  const fileBadge = getFileBadge(attachment?.originalName, attachment?.mimeType);
  const FileBadgeIcon = fileBadge.icon;

  return (
    <div
      className={`flex gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'} ${
        isGroupedWithPrev ? 'mt-1' : 'mt-3.5'
      }`}
      role="article"
      aria-label={`${isOwn ? 'You' : senderName}: ${
        attachment ? `${type} attachment` : message.content
      }`}
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
      <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender Name */}
        {!isOwn && isFirstInGroup && (
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 px-1">
            {senderName}
          </p>
        )}

        {/* Message Card */}
        <div
          className={`relative rounded-2xl shadow-xs transition-shadow overflow-hidden ${
            isOwn
              ? `bg-powder-600 dark:bg-powder-600 text-white ${
                  isLastInGroup ? 'rounded-tr-xs' : ''
                }`
              : `bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 ${
                  isLastInGroup ? 'rounded-tl-xs' : ''
                }`
          } ${type === 'IMAGE' && !message.content ? 'p-1.5' : 'p-3'}`}
        >
          {/* ── 1. IMAGE ATTACHMENT ──────────────────────────────────────── */}
          {type === 'IMAGE' && attachment && (
            <div className="relative group select-none">
              <div
                onClick={() =>
                  onOpenMedia &&
                  attachment.url &&
                  onOpenMedia({
                    url: attachment.url,
                    originalName: attachment.originalName,
                    size: attachment.size,
                  })
                }
                className="relative overflow-hidden rounded-xl bg-slate-950/10 dark:bg-slate-900 cursor-pointer max-w-sm"
              >
                {!imageLoaded && !imageError && (
                  <div className="w-64 h-44 flex items-center justify-center bg-slate-100 dark:bg-slate-800/80">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                )}

                {imageError ? (
                  <div className="w-64 h-32 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5 p-4 bg-slate-100 dark:bg-slate-800">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <span>Failed to load image preview</span>
                  </div>
                ) : (
                  <img
                    src={attachment.url}
                    alt={attachment.originalName || 'Image attachment'}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                    className={`max-h-72 w-auto object-cover rounded-xl transition-transform duration-200 group-hover:scale-[1.02] ${
                      imageLoaded ? 'block' : 'hidden'
                    }`}
                  />
                )}

                {/* Hover Zoom Overlay */}
                {imageLoaded && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 rounded-full bg-black/60 text-white shadow-md hover:bg-black/80 transition">
                      <ZoomIn className="w-4 h-4" />
                    </span>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="p-2 rounded-full bg-black/60 text-white shadow-md hover:bg-black/80 transition"
                      title="Download image"
                      aria-label="Download image"
                    >
                      {downloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 2. FILE ATTACHMENT (DOCUMENT / ARCHIVE) ──────────────────── */}
          {type === 'FILE' && attachment && (
            <div
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                isOwn
                  ? 'bg-powder-700/40 border-powder-500/50 hover:bg-powder-700/60'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
              }`}
            >
              {/* Category File Icon */}
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 ${fileBadge.color}`}
              >
                <FileBadgeIcon className="w-5 h-5" />
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0 pr-2">
                <p
                  className={`text-xs font-semibold truncate ${
                    isOwn ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                  }`}
                  title={attachment.originalName}
                >
                  {attachment.originalName || 'Attachment'}
                </p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    isOwn ? 'text-powder-200' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {formatFileSize(attachment.size)}
                </p>
              </div>

              {/* Download Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className={`p-2 rounded-lg transition shrink-0 ${
                  isOwn
                    ? 'bg-powder-500/80 hover:bg-powder-500 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Download file"
                aria-label={`Download ${attachment.originalName}`}
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {/* ── 3. VIDEO ATTACHMENT ──────────────────────────────────────── */}
          {type === 'VIDEO' && attachment && (
            <div className="relative rounded-xl overflow-hidden bg-black/10 dark:bg-black/40 max-w-sm">
              <video
                src={attachment.url}
                controls
                preload="metadata"
                className="w-full max-h-72 rounded-xl"
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}

          {/* ── 4. AUDIO ATTACHMENT ──────────────────────────────────────── */}
          {type === 'AUDIO' && attachment && (
            <div
              className={`p-3 rounded-xl border flex flex-col gap-2 ${
                isOwn
                  ? 'bg-powder-700/40 border-powder-500/50'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Music className="w-4 h-4 shrink-0" />
                <span className="truncate">{attachment.originalName || 'Audio file'}</span>
                <span className="text-[10px] opacity-70 ml-auto shrink-0">
                  {formatFileSize(attachment.size)}
                </span>
              </div>
              <audio
                src={attachment.url}
                controls
                preload="metadata"
                className="w-full h-8"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* ── 5. CAPTION OR PLAINTEXT CONTENT ───────────────────────────── */}
          {message.content && (
            <p
              className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${
                type !== 'TEXT' ? 'mt-2 px-1' : ''
              } ${isOwn ? 'selection:bg-powder-400 selection:text-white' : 'selection:bg-powder-200 selection:text-powder-900'}`}
            >
              {message.content}
            </p>
          )}

          {/* ── 6. TIMESTAMP ─────────────────────────────────────────────── */}
          <div
            className={`flex items-center justify-end gap-1 mt-1 select-none text-[10px] font-medium ${
              type === 'IMAGE' && !message.content ? 'px-1.5 pb-0.5' : ''
            } ${
              isOwn ? 'text-powder-100/80' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span>{formatMessageTime(message.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
