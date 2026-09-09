import React, { useMemo } from 'react';
import {
  CheckSquare,
  Video,
  AlertTriangle,
  FolderKanban,
  User,
  Clock,
  AlertCircle,
  Calendar as CalendarIcon,
} from 'lucide-react';

/**
 * DayView — Detailed single-day view
 *
 * Features:
 * - Overdue attention banner
 * - All-day tasks section
 * - Hourly meeting timeline (7am–10pm)
 * - Clean empty states
 *
 * Props:
 * - currentDate: Date object for the displayed day
 * - events: Array of normalized calendar items
 * - onEventClick: (event) => void
 */

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

const formatHour = (h) => {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'URGENT': return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'HIGH': return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'MEDIUM': return 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    default: return 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  }
};

const getDeadlineColor = (classification) => {
  switch (classification) {
    case 'OVERDUE': return 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300';
    case 'DUE_TODAY': return 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300';
    case 'DUE_SOON': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
    default: return 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400';
  }
};

const DayView = ({ currentDate, events = [], onEventClick }) => {
  const today = new Date();
  const isToday =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getDate() === today.getDate();

  const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;

  // Separate events for this day
  const { allDayEvents, timedEvents, overdueEvents } = useMemo(() => {
    const allDay = [];
    const timed = [];
    const overdue = [];

    events.forEach((evt) => {
      const evtStart = new Date(evt.start);
      const evtKey = `${evtStart.getFullYear()}-${evtStart.getMonth()}-${evtStart.getDate()}`;

      // Check if event falls on current date
      let isOnDate = evtKey === dateKey;
      if (!isOnDate && evt.end) {
        const evtEnd = new Date(evt.end);
        const endKey = `${evtEnd.getFullYear()}-${evtEnd.getMonth()}-${evtEnd.getDate()}`;
        isOnDate = endKey === dateKey;
      }

      if (!isOnDate) return;

      if (evt.deadlineClassification === 'OVERDUE' && evt.sourceType === 'task') {
        overdue.push(evt);
      }

      if (evt.allDay) {
        allDay.push(evt);
      } else {
        timed.push(evt);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed, overdueEvents: overdue };
  }, [events, dateKey]);

  const dayLabel = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const hasAnyEvents = allDayEvents.length > 0 || timedEvents.length > 0;

  return (
    <div className="space-y-4">
      {/* Day Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isToday
                ? 'bg-powder-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="text-lg font-extrabold">{currentDate.getDate()}</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{dayLabel}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isToday ? "Today's Schedule" : 'Day View'} · {allDayEvents.length} tasks · {timedEvents.length} meetings
            </p>
          </div>
        </div>
      </div>

      {/* Overdue Attention Banner */}
      {overdueEvents.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
              Attention — {overdueEvents.length} overdue task{overdueEvents.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {overdueEvents.map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => onEventClick?.(evt)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-100/60 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition text-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold text-rose-800 dark:text-rose-200 truncate">{evt.title}</span>
                {evt.urgencyScore != null && (
                  <span className="ml-auto text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                    {evt.urgencyScore}/100
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All-Day Tasks */}
      {allDayEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="w-4 h-4 text-powder-600 dark:text-powder-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tasks & Deadlines</h3>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {allDayEvents.length}
            </span>
          </div>
          <div className="space-y-2">
            {allDayEvents.map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => onEventClick?.(evt)}
                className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {evt.isAtRisk ? (
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : evt.status === 'COMPLETED' ? (
                      <CheckSquare className="w-4 h-4 text-mint-500 shrink-0" />
                    ) : (
                      <CheckSquare className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-powder-600 dark:group-hover:text-powder-400 transition">
                      {evt.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {evt.priority && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getPriorityColor(evt.priority)}`}>
                        {evt.priority}
                      </span>
                    )}
                    {evt.deadlineClassification && evt.deadlineClassification !== 'NO_DEADLINE' && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getDeadlineColor(evt.deadlineClassification)}`}>
                        {evt.deadlineClassification.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {evt.project && (
                    <span className="flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" />
                      {evt.project.name}
                    </span>
                  )}
                  {!evt.project && evt.category === 'PERSONAL' && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Personal
                    </span>
                  )}
                  {evt.urgencyScore != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Urgency: {evt.urgencyScore}/100
                    </span>
                  )}
                  {evt.progress != null && (
                    <span>Progress: {evt.progress}%</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hourly Meeting Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <Video className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Schedule</h3>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {timedEvents.length}
          </span>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {HOURS.map((hour) => {
            const hourEvents = timedEvents.filter((evt) => new Date(evt.start).getHours() === hour);

            return (
              <div
                key={hour}
                className="flex border-b border-slate-50 dark:border-slate-800/40 last:border-b-0"
              >
                <div className="w-[60px] shrink-0 text-right pr-3 py-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-slate-800/60">
                  {formatHour(hour)}
                </div>
                <div className="flex-1 py-1 px-2 min-h-[48px] space-y-1">
                  {hourEvents.map((evt) => {
                    const startTime = new Date(evt.start);
                    const endTime = new Date(evt.end);

                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => onEventClick?.(evt)}
                        className="w-full text-left px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-200/70 dark:border-violet-800/50 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition group"
                      >
                        <div className="flex items-center gap-2">
                          <Video className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                          <span className="text-xs font-bold text-violet-800 dark:text-violet-200 truncate group-hover:text-violet-600 dark:group-hover:text-violet-300 transition">
                            {evt.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-violet-600/70 dark:text-violet-400/70">
                          <Clock className="w-3 h-3" />
                          <span>
                            {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {evt.location && <span>· {evt.location}</span>}
                          {evt.meetingLink && <span>· Online</span>}
                        </div>
                        {evt.project && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-violet-500/70">
                            <FolderKanban className="w-3 h-3" />
                            {evt.project.name}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {!hasAnyEvents && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No events scheduled</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {isToday
              ? "You're free today! Create a task or schedule a meeting."
              : 'No tasks or meetings scheduled for this day.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default DayView;
