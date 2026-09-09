import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { getCalendarEvents } from '../../services/calendarService';

/**
 * MiniCalendar — Compact monthly widget for the Dashboard
 *
 * Features:
 * - Month navigation (prev/next)
 * - Today highlight
 * - Event indicator dots on dates with tasks/meetings
 * - Click date → navigate to /calendar
 * - "Open Calendar" quick link
 */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MiniCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventDates, setEventDates] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const days = [];

    // Leading days from previous month
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ day: prevMonthLast - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthLast - i) });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
    }

    // Trailing days to fill last row
    const remaining = 42 - days.length; // 6 rows * 7 cols
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }

    return days;
  }, [year, month]);

  // Fetch events for the current month
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const res = await getCalendarEvents({ start, end });
      if (res.success && Array.isArray(res.data)) {
        const dates = new Set();
        res.data.forEach((item) => {
          if (item.start) {
            const d = new Date(item.start);
            dates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
          }
          if (item.end && item.end !== item.start) {
            const d = new Date(item.end);
            dates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
          }
        });
        setEventDates(dates);
      }
    } catch {
      // Silent fail for widget
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const today = new Date();
  const isToday = (date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const hasEvent = (date) =>
    eventDates.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-powder-600 dark:text-powder-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Calendar</h2>
        </div>
        <Link
          to="/calendar"
          className="text-[11px] font-semibold text-powder-600 dark:text-powder-400 hover:underline flex items-center gap-1"
        >
          <span>Open</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={goToToday}
          className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-powder-600 dark:hover:text-powder-400 transition"
        >
          {monthLabel}
        </button>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((dayObj, idx) => {
          const today_ = isToday(dayObj.date);
          const hasEvt = hasEvent(dayObj.date);

          return (
            <Link
              to={`/calendar?date=${dayObj.date.toISOString().split('T')[0]}`}
              key={idx}
              className={`
                relative flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer
                ${!dayObj.isCurrentMonth
                  ? 'text-slate-300 dark:text-slate-700'
                  : today_
                    ? 'bg-powder-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              {dayObj.day}
              {/* Event dot */}
              {hasEvt && dayObj.isCurrentMonth && (
                <span
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                    today_ ? 'bg-white' : 'bg-powder-500 dark:bg-powder-400'
                  }`}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="mt-2 text-center">
          <span className="text-[10px] text-slate-400">Loading events...</span>
        </div>
      )}
    </div>
  );
};

export default MiniCalendar;
