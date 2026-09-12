import React from 'react';
import { CheckSquare, Video, Clock, AlertTriangle, FolderKanban } from 'lucide-react';

/**
 * MonthView — Full monthly calendar grid
 *
 * Props:
 * - currentDate: Date object for the displayed month
 * - events: Array of normalized calendar items
 * - onDateClick: (date) => void
 * - onEventClick: (event) => void
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getEventColor = (item) => {
  if (item.sourceType === 'meeting') return 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800';
  if (item.deadlineClassification === 'OVERDUE') return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  if (item.deadlineClassification === 'DUE_TODAY') return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  if (item.priority === 'URGENT') return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800';
  if (item.priority === 'HIGH') return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
  if (item.category === 'PROJECT') return 'bg-powder-50 dark:bg-powder-950/40 text-powder-600 dark:text-powder-400 border-powder-200 dark:border-powder-800';
  return 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
};

const MonthView = ({ currentDate, events = [], onDateClick, onEventClick }) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days = [];
  const prevMonthLast = new Date(year, month, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ day: prevMonthLast - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthLast - i) });
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
  }
  const remaining = Math.ceil(days.length / 7) * 7 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
  }

  // Group events by date key
  const eventsByDate = {};
  events.forEach((evt) => {
    const startDate = new Date(evt.start);
    const endDate = evt.end ? new Date(evt.end) : startDate;

    // For multi-day events, place on start day (for month view simplicity)
    const key = `${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(evt);

    // Also place on end day if different
    const endKey = `${endDate.getFullYear()}-${endDate.getMonth()}-${endDate.getDate()}`;
    if (endKey !== key) {
      if (!eventsByDate[endKey]) eventsByDate[endKey] = [];
      eventsByDate[endKey].push(evt);
    }
  });

  const isToday = (date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const MAX_VISIBLE = 3;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
        {WEEKDAYS_SHORT.map((wd, i) => (
          <div
            key={wd}
            className={`text-center text-[11px] font-bold uppercase tracking-wider py-2.5 text-slate-500 dark:text-slate-400 ${
              i < 6 ? 'border-r border-slate-100 dark:border-slate-800' : ''
            }`}
          >
            <span className="hidden sm:inline">{WEEKDAYS[i]}</span>
            <span className="sm:hidden">{wd}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((dayObj, idx) => {
          const dateKey = `${dayObj.date.getFullYear()}-${dayObj.date.getMonth()}-${dayObj.date.getDate()}`;
          const dayEvents = eventsByDate[dateKey] || [];
          const today_ = isToday(dayObj.date);
          const isLast = idx === days.length - 1;
          const colIdx = idx % 7;

          return (
            <div
              key={idx}
              className={`
                min-h-[90px] sm:min-h-[110px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800/60 transition-colors cursor-pointer
                ${!dayObj.isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-950/30' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/20'}
                ${colIdx === 6 ? 'border-r-0' : ''}
              `}
              onClick={() => onDateClick?.(dayObj.date)}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`
                    text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                    ${today_
                      ? 'bg-powder-600 text-white'
                      : dayObj.isCurrentMonth
                        ? 'text-slate-800 dark:text-slate-200'
                        : 'text-slate-300 dark:text-slate-600'
                    }
                  `}
                >
                  {dayObj.day}
                </span>
              </div>

              {/* Event Badges */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_VISIBLE).map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(evt);
                    }}
                    className={`
                      w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border transition-all
                      hover:opacity-80 ${getEventColor(evt)}
                    `}
                    title={evt.title}
                  >
                    <span className="flex items-center gap-1">
                      {evt.sourceType === 'meeting' ? (
                        <Video className="w-2.5 h-2.5 shrink-0" />
                      ) : evt.isAtRisk ? (
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                      ) : (
                        <CheckSquare className="w-2.5 h-2.5 shrink-0" />
                      )}
                      <span className="truncate">{evt.title}</span>
                    </span>
                  </button>
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDateClick?.(dayObj.date);
                    }}
                    className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-bold text-powder-600 dark:text-powder-400 hover:bg-powder-50 dark:hover:bg-powder-950/40 transition"
                  >
                    +{dayEvents.length - MAX_VISIBLE} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
