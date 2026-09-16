import api from './api';

/**
 * User Service
 * Handles user searching, profile management, and avatar upload.
 */

/**
 * Upload a new profile image.
 * @param {File} file
 * @returns {Promise<Object>} { success, message, data: { user, profileImageURL } }
 */
export const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post('/api/users/profile-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Remove the current user's profile image.
 * @returns {Promise<Object>} { success, message, data: { user, profileImageURL: null } }
 */
export const removeProfileImage = async () => {
  const response = await api.delete('/api/users/profile-image');
  return response.data;
};

/**
 * Search users by name or email for member invitations.
 * @param {string} query
 * @returns {Promise<Object>}
 */
export const searchUsers = async (query) => {
  const response = await api.get('/api/users/search', {
    params: { q: query },
  });
  return response.data;
};

/**
 * Get the current user's profile and preferences.
 * @returns {Promise<Object>} { success, data: { user } }
 */
export const getUserProfile = async () => {
  const response = await api.get('/api/users/profile');
  return response.data;
};

/**
 * Update the user's profile (name, username, bio).
 * @param {Object} profileData { name, username, bio }
 * @returns {Promise<Object>} { success, message, data: { user } }
 */
export const updateUserProfile = async (profileData) => {
  const response = await api.put('/api/users/profile', profileData);
  return response.data;
};

/**
 * Update the user's preferences (theme, language, emailNotifications).
 * @param {Object} preferencesData { theme, language, emailNotifications }
 * @returns {Promise<Object>} { success, message, data: { preferences, user } }
 */
export const updateUserPreferences = async (preferencesData) => {
  const response = await api.put('/api/users/preferences', preferencesData);
  return response.data;
};

/**
 * Change the current user's password.
 * @param {Object} data { currentPassword, newPassword, confirmPassword }
 * @returns {Promise<Object>} { success, message, data: { accessToken } }
 */
export const changePassword = async (data) => {
  const response = await api.put('/api/users/change-password', data);
  return response.data;
};

/**
 * Retrieve all active refresh token sessions for current user.
 * @returns {Promise<Object>} { success, data: { sessions } }
 */
export const getActiveSessions = async () => {
  const response = await api.get('/api/users/sessions');
  return response.data;
};

/**
 * Log out from all devices by revoking all refresh sessions.
 * @returns {Promise<Object>} { success, message }
 */
export const logoutAllDevices = async () => {
  const response = await api.post('/api/users/sessions/logout-all');
  return response.data;
};

/**
 * Revoke a specific active session.
 * @param {string} sessionId
 * @returns {Promise<Object>} { success, message }
 */
export const revokeSession = async (sessionId) => {
  const response = await api.delete(`/api/users/sessions/${sessionId}`);
  return response.data;
};

/**
 * Submit a contact support ticket.
 * @param {Object} data { name, email, subject, message }
 * @returns {Promise<Object>} { success, message }
 */
export const submitSupportTicket = async (data) => {
  const response = await api.post('/api/users/support', data);
  return response.data;
};

/**
 * Permanently delete the user account and associated data.
 * @param {Object} data { confirmationText, password }
 * @returns {Promise<Object>} { success, message }
 */
export const deleteAccount = async (data) => {
  const response = await api.delete('/api/users/account', { data });
  return response.data;
};

export default {
  uploadProfileImage,
  removeProfileImage,
  searchUsers,
  getUserProfile,
  updateUserProfile,
  updateUserPreferences,
  changePassword,
  getActiveSessions,
  logoutAllDevices,
  revokeSession,
  submitSupportTicket,
  deleteAccount,
};


