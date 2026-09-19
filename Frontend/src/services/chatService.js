import api from './api';

/**
 * Chat Service — Phase 15
 * Handles chat conversation and message API calls.
 */

export const getConversations = async () => {
    const response = await api.get('/api/chat/conversations');
    return response.data;
};

export const createDirectConversation = async (userId) => {
    const response = await api.post('/api/chat/conversations/direct', { userId });
    return response.data;
};

export const getConversation = async (conversationId) => {
    const response = await api.get(`/api/chat/conversations/${conversationId}`);
    return response.data;
};

export const getMessages = async (conversationId, params = {}) => {
    const response = await api.get(`/api/chat/conversations/${conversationId}/messages`, { params });
    return response.data;
};

export const sendMessage = async (conversationId, content) => {
    const response = await api.post(`/api/chat/conversations/${conversationId}/messages`, { content });
    return response.data;
};

export const searchUsers = async (query) => {
    const response = await api.get('/api/users/search', { params: { q: query } });
    return response.data;
};

export default {
    getConversations,
    createDirectConversation,
    getConversation,
    getMessages,
    sendMessage,
    searchUsers,
};
