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
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_DELETED: 'message:deleted',

  // Reactions
  REACTION_ADD: 'reaction:add',
  REACTION_REMOVE: 'reaction:remove',
  REACTION_UPDATED: 'reaction:updated',

  // Typing Indicators
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Delivery & Read Status
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',
  CONVERSATION_READ: 'conversation:read',

  // Conversation updates
  CONVERSATION_UPDATED: 'conversation:updated',

  // Errors
  ERROR: 'error',
};

export default SOCKET_EVENTS;
