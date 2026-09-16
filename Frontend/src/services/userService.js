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

export default {
  uploadProfileImage,
  removeProfileImage,
  searchUsers,
};
