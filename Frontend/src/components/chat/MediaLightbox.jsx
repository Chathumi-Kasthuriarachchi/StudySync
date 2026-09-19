import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';
import { formatFileSize } from './chatUtils';

/**
 * MediaLightbox Component — Phase 18
 * High-resolution modal viewer for image attachments with zoom,
 * reset, direct download, and keyboard accessibility.
 */
const MediaLightbox = ({
  isOpen,
  onClose,
  src,
  alt = 'Image preview',
  fileName = 'image.png',
  fileSize = 0,
}) => {
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  // Reset state when opening a new image
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setLoading(true);
    }
  }, [isOpen, src]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setScale((s) => Math.min(s + 0.25, 3));
      } else if (e.key === '-') {
        setScale((s) => Math.max(s - 0.25, 0.5));
      } else if (e.key === '0') {
        setScale(1);
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !src) return null;

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleResetZoom = () => setScale(1);

  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
      onClick={onClose}
    >
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div
        className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col min-w-0 pr-4">
          <span className="text-sm font-medium truncate text-slate-100">{fileName}</span>
          {fileSize > 0 && (
            <span className="text-xs text-slate-400">{formatFileSize(fileSize)}</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom Out (-)"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-slate-200 hover:text-white transition"
            title="Reset Zoom (0)"
            aria-label="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom In (+)"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
            title="Download image"
            aria-label="Download image"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/80 text-slate-200 hover:text-white transition ml-2"
            title="Close (Esc)"
            aria-label="Close image viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Image Display Area ───────────────────────────────────────────── */}
      <div
        className="flex-1 w-full flex items-center justify-center p-4 overflow-hidden relative"
        onClick={onClose}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        <img
          src={src}
          alt={alt}
          onLoad={() => setLoading(false)}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `scale(${scale})`,
            transition: 'transform 0.15s ease-out',
            maxHeight: '85vh',
            maxWidth: '90vw',
          }}
          className={`object-contain rounded-lg shadow-2xl transition-opacity duration-300 ${
            loading ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </div>
    </div>
  );
};

export default MediaLightbox;
