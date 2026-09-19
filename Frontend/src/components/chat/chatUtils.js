/**
 * Chat Date & Time Formatting Utilities — Phase 17
 * Local timezone formatted timestamps matching StudySync styling.
 */

/**
 * Format timestamp for conversation list preview
 * e.g. "10:34 AM", "Yesterday", "Mon", or "Sep 18"
 */
export const formatConversationTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const sixDaysAgo = new Date(startOfToday);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

  if (date >= startOfToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  if (date >= startOfYesterday) {
    return 'Yesterday';
  }

  if (date >= sixDaysAgo) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  });
};

/**
 * Format timestamp for individual message bubble
 * e.g. "10:34 AM"
 */
export const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format date divider heading
 * e.g. "Today", "Yesterday", or "Friday, September 19, 2026"
 */
export const formatDateDivider = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  });
};

/**
 * Check if two dates are on the same calendar day
 */
export const isSameDay = (dateStr1, dateStr2) => {
  if (!dateStr1 || !dateStr2) return false;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/**
 * Check if two dates are within X minutes of each other
 */
export const isWithinMinutes = (dateStr1, dateStr2, minutes = 5) => {
  if (!dateStr1 || !dateStr2) return false;
  const diffMs = Math.abs(new Date(dateStr1).getTime() - new Date(dateStr2).getTime());
  return diffMs <= minutes * 60 * 1000;
};

/**
 * Format file size in bytes to human-readable string
 * e.g. "512 B", "2.4 MB", "12.8 KB"
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Determine high-level category of an attachment based on mimeType and/or filename
 */
export const getFileCategory = (mimeType = '', fileName = '') => {
  const mime = mimeType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'IMAGE';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) {
    return 'VIDEO';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'AUDIO';
  }
  return 'FILE';
};
