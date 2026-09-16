import React, { useState, useRef } from 'react';
import { User as UserIcon, Mail, Shield, KeyRound, Camera, Trash2, Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { uploadProfileImage, removeProfileImage } from '../services/userService';

/**
 * Profile Page
 * 
 * Displays user account details, role authorizations, and allows
 * uploading/updating the user's profile avatar via Cloudinary.
 */
const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isAdmin = user?.systemRole === 'ADMIN';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size validation (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Image is too large. Maximum allowed size is 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side MIME validation
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsUploading(true);
      const res = await uploadProfileImage(file);
      if (res.success && res.data) {
        updateUser(res.data.user || { profileImageURL: res.data.profileImageURL });
        toast.success('Profile photo updated successfully!');
      }
    } catch (err) {
      console.error('Upload profile image error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.profileImageURL) return;
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;

    try {
      setIsRemoving(true);
      const res = await removeProfileImage();
      if (res.success) {
        updateUser({ profileImageURL: null });
        toast.success('Profile photo removed.');
      }
    } catch (err) {
      console.error('Remove profile image error:', err);
      toast.error(err.response?.data?.message || 'Failed to remove photo.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Account Profile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal details, profile picture, and view system authorizations.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-8 border-b border-slate-100 dark:border-slate-800">
          {/* Avatar Container with Hover Upload Overlay */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-gradient-to-tr from-powder-500 to-mint-400 text-white font-extrabold text-3xl flex items-center justify-center shadow-md border-2 border-white dark:border-slate-800">
              {user?.profileImageURL ? (
                <img
                  src={user.profileImageURL}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(user?.name)}</span>
              )}

              {/* Uploading Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs gap-1">
                  <Loader2 className="w-6 h-6 animate-spin text-powder-400" />
                  <span className="font-medium text-[11px]">Uploading...</span>
                </div>
              )}
            </div>

            {/* Change Photo Trigger Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRemoving}
              title="Upload new photo"
              className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-md border border-slate-200 dark:border-slate-700 hover:bg-powder-50 dark:hover:bg-slate-700 hover:text-powder-600 transition disabled:opacity-50 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {user?.name || 'StudySync Member'}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-center sm:self-auto ${
                  isAdmin
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-mint-100 text-mint-900 dark:bg-mint-950/60 dark:text-mint-300 border border-mint-300 dark:border-mint-700'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {user?.systemRole || 'USER'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
              {user?.email}
            </p>

            {/* Photo Action Buttons & Guidance */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isRemoving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-powder-700 dark:text-powder-300 bg-powder-50 dark:bg-powder-950/50 border border-powder-200 dark:border-powder-800 hover:bg-powder-100 dark:hover:bg-powder-900/60 transition cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? 'Uploading...' : 'Upload Photo'}
              </button>

              {user?.profileImageURL && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isUploading || isRemoving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer disabled:opacity-50"
                >
                  {isRemoving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Remove Photo
                </button>
              )}

              <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-1">
                JPG, PNG, WEBP or GIF up to 5MB
              </span>
            </div>
          </div>
        </div>

        {/* User Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Full Name</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {user?.name || 'Not provided'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Email Address</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5 font-mono">
                {user?.email || 'Not provided'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">System Role (RBAC)</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {user?.systemRole === 'ADMIN'
                  ? 'Administrator (Full System Access)'
                  : 'Standard User (Personal Workspace)'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Authentication Token</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                JWT Active & Verified
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
