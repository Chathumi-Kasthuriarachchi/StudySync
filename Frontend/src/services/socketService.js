import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '../constants/socketEvents';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const ACCESS_TOKEN_KEY = 'studysync_access_token';

class SocketService {
  constructor() {
    this.socket = null;
    this.status = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
    this.statusListeners = new Set();
    this.reconnectListeners = new Set();
    this.currentConversationId = null;
  }

  /**
   * Connect to the Socket.IO server with JWT authentication.
   */
  connect() {
    if (this.socket && (this.socket.connected || this.status === 'connecting')) {
      return this.socket;
    }

    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      this._setStatus('disconnected');
      return null;
    }

    this._setStatus('connecting');

    this.socket = io(SOCKET_URL, {
      auth: (cb) => {
        const currentToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        cb({ token: currentToken });
      },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this._registerCoreListeners();
    return this.socket;
  }

  /**
   * Disconnect the socket.
   */
  disconnect() {
    if (this.socket) {
      if (this.currentConversationId) {
        this.leaveConversation(this.currentConversationId);
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentConversationId = null;
    this._setStatus('disconnected');
  }

  /**
   * Register internal lifecycle listeners
   */
  _registerCoreListeners() {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      this._setStatus('connected');
      // If we were inside a conversation before disconnect, re-join it
      if (this.currentConversationId) {
        this.joinConversation(this.currentConversationId);
      }
      this.reconnectListeners.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.error('Error in reconnect listener:', e);
        }
      });
    });

    this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      if (reason === 'io client disconnect') {
        this._setStatus('disconnected');
      } else {
        // Server disconnected or network lost, Socket.IO will attempt reconnect
        this._setStatus('connecting');
      }
    });

    this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, () => {
      this._setStatus('disconnected');
    });

    // Phase 21: Handle server-side socket errors (auth failures, rate limits, etc.)
    this.socket.on(SOCKET_EVENTS.ERROR, (error) => {
      const message = error?.message || '';
      // If authentication error, disconnect cleanly rather than retrying forever
      if (message.toLowerCase().includes('authentication') || message.toLowerCase().includes('not authorized')) {
        console.warn('Socket authentication error:', message);
        this.disconnect();
      }
    });

    if (this.socket.io) {
      this.socket.io.on('reconnect_attempt', () => {
        this._setStatus('connecting');
      });

      this.socket.io.on('reconnect', () => {
        this._setStatus('connected');
      });
    }
  }

  /**
   * Update and notify connection status
   */
  _setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('Error in status listener:', e);
        }
      });
    }
  }

  /**
   * Subscribe to connection status changes.
   * Immediately calls the callback with current status.
   */
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Subscribe to socket reconnection events.
   */
  onReconnect(callback) {
    this.reconnectListeners.add(callback);
    return () => this.reconnectListeners.delete(callback);
  }

  /**
   * Join a conversation room.
   */
  joinConversation(conversationId) {
    if (!conversationId) return Promise.reject(new Error('Conversation ID is required'));

    this.currentConversationId = conversationId;

    if (!this.socket || !this.socket.connected) {
      // Connect if not already connected
      this.connect();
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket is not initialized'));
      }

      this.socket.emit(SOCKET_EVENTS.CONVERSATION_JOIN, { conversationId }, (response) => {
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.message || 'Failed to join conversation room'));
        }
      });
    });
  }

  /**
   * Leave a conversation room.
   */
  leaveConversation(conversationId) {
    const idToLeave = conversationId || this.currentConversationId;
    if (!idToLeave) return;

    if (this.currentConversationId === idToLeave) {
      this.currentConversationId = null;
    }

    if (this.socket && this.socket.connected) {
      this.socket.emit(SOCKET_EVENTS.CONVERSATION_LEAVE, { conversationId: idToLeave });
    }
  }

  /**
   * Send a real-time message through Socket.IO.
   */
  sendMessage(conversationId, content) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Socket is not connected'));
      }

      this.socket.emit(
        SOCKET_EVENTS.MESSAGE_SEND,
        { conversationId, content },
        (response) => {
          if (response && response.success) {
            resolve(response.message);
          } else {
            reject(new Error(response?.message || 'Failed to send message via socket'));
          }
        }
      );
    });
  }

  /**
   * Subscribe to incoming real-time messages.
   */
  onNewMessage(handler) {
    if (!this.socket) this.connect();
    if (this.socket) {
      this.socket.on(SOCKET_EVENTS.MESSAGE_NEW, handler);
    }
    return () => {
      if (this.socket) {
        this.socket.off(SOCKET_EVENTS.MESSAGE_NEW, handler);
      }
    };
  }

  /**
   * Subscribe to conversation list updates (preview/last message).
   */
  onConversationUpdated(handler) {
    if (!this.socket) this.connect();
    if (this.socket) {
      this.socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, handler);
    }
    return () => {
      if (this.socket) {
        this.socket.off(SOCKET_EVENTS.CONVERSATION_UPDATED, handler);
      }
    };
  }

  /**
   * Subscribe to new in-app notifications in real time.
   */
  onNotificationNew(handler) {
    if (!this.socket) this.connect();
    if (this.socket) {
      this.socket.on('notification:new', handler);
    }
    return () => {
      if (this.socket) {
        this.socket.off('notification:new', handler);
      }
    };
  }

  /**
   * Check if socket is currently connected.
   */
  isConnected() {
    return this.socket ? this.socket.connected : false;
  }

  /**
   * Get current connection status string.
   */
  getStatus() {
    return this.status;
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
