import React, { useState, useRef, useCallback } from 'react';
import { Search, Loader2, X, MessageCircle, AlertCircle } from 'lucide-react';
import Avatar from './Avatar';
import * as chatService from '../../services/chatService';
import toast from 'react-hot-toast';

/**
 * NewConversationModal Component — Phase 17
 * Modal dialog to search platform users and initiate a direct conversation.
 */
const NewConversationModal = ({ onClose, onCreated }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchTimeout = useRef(null);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setSearchError(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await chatService.searchUsers(query.trim());
        setSearchResults(data.users || []);
      } catch (err) {
        setSearchError('Failed to search users. Please try again.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectUser = async (userId) => {
    try {
      setCreating(true);
      const data = await chatService.createDirectConversation(userId);
      if (data.conversation) {
        onCreated(data.conversation);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start conversation');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 id="modal-title" className="text-base font-bold text-slate-900 dark:text-white">
            New Direct Message
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search user by name or email..."
              autoFocus
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-400/50 transition"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2 scrollbar-thin">
          {searching && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-xs">Searching users...</span>
            </div>
          )}

          {searchError && (
            <div className="p-4 text-center text-xs text-rose-500">
              <AlertCircle className="w-5 h-5 mx-auto mb-1 text-rose-400" />
              {searchError}
            </div>
          )}

          {!searching && searchQuery && searchResults.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm font-medium">No users found</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Try searching with a different name or email
              </p>
            </div>
          )}

          {!searching &&
            searchResults.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => handleSelectUser(user._id)}
                disabled={creating}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition text-left group disabled:opacity-50"
              >
                <Avatar name={user.name} imageUrl={user.profileImageURL} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
                <MessageCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-powder-500 transition shrink-0" />
              </button>
            ))}

          {!searching && !searchQuery && (
            <div className="text-center py-8 text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Search for a team member
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Type their name or email to start chatting
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewConversationModal;
