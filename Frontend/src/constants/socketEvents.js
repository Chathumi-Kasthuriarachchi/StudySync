/**
 * Socket.IO Event Constants — Phase 16
 * Matching backend event names.
 */
export const SOCKET_EVENTS = {
  // Connection lifecycle
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',

  // Room operations
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',

  // Messaging
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',

  // Conversation updates
  CONVERSATION_UPDATED: 'conversation:updated',

  // Errors
  ERROR: 'error',
};

export default SOCKET_EVENTS;
