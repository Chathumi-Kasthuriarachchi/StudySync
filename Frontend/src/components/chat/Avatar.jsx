import React from 'react';

/**
 * Avatar Component for Chat
 * Renders user profile image or colorful initials fallback.
 */
export const Avatar = ({ name = 'User', imageUrl, size = 'md', className = '' }) => {
  const getInitials = (n) => {
    if (!n) return '?';
    const parts = n.trim().split(' ').filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  };

  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div
      className={`${sizes[size] || sizes.md} rounded-full overflow-hidden bg-gradient-to-br from-powder-400 to-powder-600 text-white font-semibold flex items-center justify-center shrink-0 select-none shadow-xs ${className}`}
      title={name}
      aria-label={name}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

export default Avatar;
