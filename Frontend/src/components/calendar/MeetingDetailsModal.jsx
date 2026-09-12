import React from 'react';
import {
  X,
  Video,
  MapPin,
  Link as LinkIcon,
  Users,
  FolderKanban,
  Clock,
  ExternalLink,
  User,
  Calendar,
} from 'lucide-react';

/**
 * MeetingDetailsModal — Display meeting details
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - meeting: normalized calendar item (sourceType === 'meeting')
 * - onDelete: (meetingId) => void
 */

const getStatusBadge = (status) => {
  switch (status) {
    case 'SCHEDULED':
      return 'bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800';
    case 'COMPLETED':
      return 'bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border-mint-200 dark:border-mint-800';
    case 'CANCELLED':
      return 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    default:
      return 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  }
};

const MeetingDetailsModal = ({ isOpen, onClose, meeting, onDelete }) => {
  if (!isOpen || !meeting) return null;

  const startTime = meeting.start ? new Date(meeting.start) : null;
  const endTime = meeting.end ? new Date(meeting.end) : null;

  const formatDate = (d) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const formatTime = (d) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      onDelete?.(meeting.sourceId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-300 flex items-center justify-center">
              <Video className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{meeting.title}</h2>
              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusBadge(meeting.status)}`}>
                {meeting.status}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Description */}
          {meeting.description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {meeting.description}
            </p>
          )}

          {/* Time */}
          {startTime && endTime && (
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
              <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {formatDate(startTime)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatTime(startTime)} – {formatTime(endTime)}
                </div>
              </div>
            </div>
          )}

          {/* Meeting Link */}
          {meeting.meetingLink && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40">
              <LinkIcon className="w-4 h-4 text-violet-500 shrink-0" />
              <a
                href={meeting.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline flex items-center gap-1 truncate"
              >
                <span className="truncate">{meeting.meetingLink}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          )}

          {/* Location */}
          {meeting.location && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {meeting.location}
              </span>
            </div>
          )}

          {/* Project */}
          {meeting.project && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-powder-50/60 dark:bg-powder-950/20 border border-powder-100 dark:border-powder-900/40">
              <FolderKanban className="w-4 h-4 text-powder-500 shrink-0" />
              <span className="text-xs font-semibold text-powder-700 dark:text-powder-300">
                {meeting.project.name}
              </span>
            </div>
          )}

          {/* Organizer */}
          {meeting.organizer && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Organizer</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {meeting.organizer.name}
                </div>
              </div>
            </div>
          )}

          {/* Participants */}
          {meeting.participants && meeting.participants.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Participants ({meeting.participants.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {meeting.participants.map((p) => (
                  <span
                    key={p._id}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80"
                  >
                    {p.name || p.email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-slate-800">
          {meeting.meetingLink ? (
            <a
              href={meeting.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              Join Meeting
            </a>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailsModal;
