import React, { useMemo } from 'react';
import { CheckSquare, Video, Clock, AlertTriangle, FolderKanban, User } from 'lucide-react';

/**
 * WeekView — 7-day calendar schedule
 *
 * Features:
 * - All-day / deadline bar at top
 * - Hourly timeline for timed meetings (7am–10pm)
 * - Today column highlight
 *
 * Props:
 * - currentDate: Date object for the displayed week
 * - events: Array of normalized calendar items
 * - onEventClick: (event) => void
 * - onDateClick: (date) => void
 */

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am to 10pm

const formatHour = (h) => {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const getEventColor = (item) => {
  if (item.sourceType === 'meeting') return 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800/80';
  if (item.deadlineClassification === 'OVERDUE') return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80';
  if (item.deadlineClassification === 'DUE_TODAY') return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80';
  if (item.category === 'PROJECT') return 'bg-powder-50 dark:bg-powder-950/40 text-powder-600 dark:text-powder-400 border-powder-200/80 dark:border-powder-800/80';
  return 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80';
};

const WeekView = ({ currentDate, events = [], onEventClick, onDateClick }) => {
  const today = new Date();

  // Get start of week (Sunday)
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  // 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const isToday = (date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  // Separate all-day and timed events
  const { allDayByDate, timedByDate } = useMemo(() => {
    const allDay = {};
    const timed = {};

    events.forEach((evt) => {
      const start = new Date(evt.start);
      const key = dateKey(start);

      if (evt.allDay) {
        if (!allDay[key]) allDay[key] = [];
        allDay[key].push(evt);
      } else {
        if (!timed[key]) timed[key] = [];
        timed[key].push(evt);
      }
    });

    return { allDayByDate: allDay, timedByDate: timed };
  }, [events]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
      {/* Week Header + All Day Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          <div className="border-r border-slate-100 dark:border-slate-800" />
          {weekDays.map((day, i) => {
            const today_ = isToday(day);
            return (
              <div
                key={i}
                onClick={() => onDateClick?.(day)}
                className={`
                  text-center py-3 border-r border-slate-100 dark:border-slate-800 last:border-r-0 cursor-pointer
                  ${today_ ? 'bg-powder-50/70 dark:bg-powder-950/20' : ''}
                `}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div
                  className={`
                    text-sm font-extrabold mt-0.5
                    ${today_
                      ? 'w-7 h-7 rounded-full bg-powder-600 text-white mx-auto flex items-center justify-center'
                      : 'text-slate-800 dark:text-slate-200'
                    }
                  `}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-Day Events Bar */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-t border-slate-100 dark:border-slate-800">
          <div className="border-r border-slate-100 dark:border-slate-800 text-[9px] font-bold uppercase text-slate-400 flex items-center justify-center">
            All Day
          </div>
          {weekDays.map((day, i) => {
            const key = dateKey(day);
            const dayAllDay = allDayByDate[key] || [];
            const today_ = isToday(day);

            return (
              <div
                key={i}
                className={`
                  p-1 min-h-[36px] border-r border-slate-100 dark:border-slate-800 last:border-r-0 space-y-0.5
                  ${today_ ? 'bg-powder-50/40 dark:bg-powder-950/10' : ''}
                `}
              >
                {dayAllDay.slice(0, 3).map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => onEventClick?.(evt)}
                    className={`
                      w-full text-left px-1 py-0.5 rounded text-[9px] font-semibold truncate border transition
                      hover:opacity-80 ${getEventColor(evt)}
                    `}
                    title={evt.title}
                  >
                    {evt.title}
                  </button>
                ))}
                {dayAllDay.length > 3 && (
                  <span className="text-[9px] font-bold text-powder-600 dark:text-powder-400 px-1">
                    +{dayAllDay.length - 3}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly Timeline */}
      <div className="overflow-y-auto max-h-[600px]">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-50 dark:border-slate-800/40"
          >
            {/* Hour label */}
            <div className="border-r border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-2 py-3 text-right">
              {formatHour(hour)}
            </div>

            {/* Day columns */}
            {weekDays.map((day, i) => {
              const key = dateKey(day);
              const dayTimed = timedByDate[key] || [];
              const today_ = isToday(day);

              // Events that start at this hour
              const hourEvents = dayTimed.filter((evt) => {
                const startH = new Date(evt.start).getHours();
                return startH === hour;
              });

              return (
                <div
                  key={i}
                  className={`
                    relative border-r border-slate-50 dark:border-slate-800/40 last:border-r-0 min-h-[48px] p-0.5
                    ${today_ ? 'bg-powder-50/20 dark:bg-powder-950/5' : ''}
                  `}
                >
                  {hourEvents.map((evt) => {
                    const startTime = new Date(evt.start);
                    const endTime = new Date(evt.end);
                    const durationMins = Math.max(30, (endTime - startTime) / 60000);
                    const heightPx = Math.min(96, Math.max(24, (durationMins / 60) * 48));

                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => onEventClick?.(evt)}
                        className={`
                          w-full text-left px-1.5 py-1 rounded-lg text-[10px] font-semibold border transition
                          hover:opacity-80 cursor-pointer ${getEventColor(evt)}
                        `}
                        style={{ minHeight: `${heightPx}px` }}
                        title={`${evt.title} (${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                      >
                        <div className="flex items-center gap-1">
                          <Video className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{evt.title}</span>
                        </div>
                        <div className="text-[9px] opacity-70 mt-0.5">
                          {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeekView;
