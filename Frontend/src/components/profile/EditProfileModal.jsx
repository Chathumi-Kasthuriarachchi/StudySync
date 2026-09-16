import { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  AtSign,
  Mail,
  Lock,
  Camera,
  Trash2,
  Loader2,
  Save,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  updateUserProfile,
  uploadProfileImage,
  removeProfileImage,
} from '../../services/userService';

/**
 * EditProfileModal
 * 
 * Interactive dialog allowing users to update their full name, unique handle (username),
 * bio, and profile photo. Email is displayed as read-only.
 */
const EditProfileModal = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(() => user?.name || '');
  const [username, setUsername] = useState(() => user?.username || '');
  const [bio, setBio] = useState(() => user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const getInitials = (displayName) => {
    if (!displayName) return 'U';
    const parts = displayName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5MB Limit
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Maximum allowed size is 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const res = await uploadProfileImage(file);
      if (res.success && res.data) {
        updateUser(res.data.user || { profileImageURL: res.data.profileImageURL });
        toast.success('Profile photo updated successfully!');
      }
    } catch (err) {
      console.error('Upload profile image error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarRemove = async () => {
    if (!user?.profileImageURL) return;
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;

    try {
      setIsRemovingPhoto(true);
      const res = await removeProfileImage();
      if (res.success) {
        updateUser({ profileImageURL: null });
        toast.success('Profile photo removed.');
      }
    } catch (err) {
      console.error('Remove profile image error:', err);
      toast.error(err.response?.data?.message || 'Failed to remove photo.');
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (trimmedName.length > 50) {
      setErrorMessage('Full name cannot exceed 50 characters.');
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(trimmedUsername)) {
        setErrorMessage(
          'Username must be 3 to 30 characters long and contain only letters, numbers, and underscores.'
        );
        return;
      }
    }

    if (bio.length > 500) {
      setErrorMessage('Bio cannot exceed 500 characters.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await updateUserProfile({
        name: trimmedName,
        username: trimmedUsername || '',
        bio: bio.trim(),
      });

      if (res.success && res.data?.user) {
        updateUser(res.data.user);
        toast.success('Profile updated successfully!');
        onClose();
      }
    } catch (err) {
      console.error('Profile update error:', err);
      const msg =
        err.response?.data?.message || 'Failed to update profile. Please check your inputs.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fadeIn">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={!isSaving ? onClose : undefined} />

      {/* Modal Dialog Body */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Edit Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update your public identity and profile details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            aria-label="Close edit profile dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar Section */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-tr from-powder-500 to-mint-400 text-white font-extrabold text-xl flex items-center justify-center shadow-xs shrink-0">
              {user?.profileImageURL ? (
                <img
                  src={user.profileImageURL}
                  alt={user?.name || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(name || user?.name)}</span>
              )}

              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center text-white">
                  <Loader2 className="w-5 h-5 animate-spin text-powder-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Profile Photo
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Square image, JPG/PNG up to 5MB
              </p>

              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto || isRemovingPhoto || isSaving}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-powder-700 dark:text-powder-300 bg-white dark:bg-slate-750 border border-slate-200 dark:border-slate-700 hover:bg-powder-50 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                </button>

                {user?.profileImageURL && (
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    disabled={isUploadingPhoto || isRemovingPhoto || isSaving}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-750 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                  >
                    {isRemovingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Remove
                  </button>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarFileChange}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
                placeholder="e.g. Alex Johnson"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Username (Handle)
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                3-30 characters, letters &amp; numbers
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <AtSign className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                maxLength={30}
                placeholder="e.g. alex_j"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bio
              </label>
              <span
                className={`text-[11px] ${
                  bio.length > 450 ? 'text-amber-500 font-semibold' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {bio.length} / 500
              </span>
            </div>
            <div className="relative">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Share a short summary about your studies, passions, or project focus..."
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition resize-none"
              />
            </div>
          </div>

          {/* Read-only Email Notice */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Email Address (Read-Only)
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                <Lock className="w-3 h-3" /> Locked
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 text-sm font-mono text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              Email changes require secure re-verification and cannot be updated directly.
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-powder-600 hover:bg-powder-700 active:scale-95 shadow-md shadow-powder-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
