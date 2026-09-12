import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  RefreshCw,
  Filter,
  CheckSquare,
  LayoutGrid,
  Columns,
  CalendarDays,
} from 'lucide-react';
import { getCalendarEvents } from '../services/calendarService';
import { deleteMeeting } from '../services/meetingService';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import CreateMeetingModal from '../components/calendar/CreateMeetingModal';
import MeetingDetailsModal from '../components/calendar/MeetingDetailsModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskDetailsModal from '../components/tasks/TaskDetailsModal';

/**
 * Calendar Page — Phase 8
 *
 * Full calendar workspace with Day/Week/Month views,
 * toolbar navigation, filters, and modals for tasks & meetings.
 */

const VIEW_OPTIONS = [
  { key: 'month', label: 'Month', icon: LayoutGrid },
  { key: 'week', label: 'Week', icon: Columns },
  { key: 'day', label: 'Day', icon: CalendarDays },
];

const TYPE_OPTIONS = [
  { key: 'ALL', label: 'All' },
  { key: 'TASKS', label: 'Tasks' },
  { key: 'MEETINGS', label: 'Meetings' },
];

const SCOPE_OPTIONS = [
  { key: 'ALL', label: 'All' },
  { key: 'PERSONAL', label: 'Personal' },
  { key: 'PROJECT', label: 'Projects' },
];

const Calendar = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(dateParam) : new Date();
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);

  // Date range calculation based on view
  const dateRange = useMemo(() => {
    const d = new Date(currentDate);
    let start, end;

    if (view === 'month') {
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      // Include leading/trailing days
      start.setDate(start.getDate() - start.getDay());
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
    } else if (view === 'week') {
      start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      end = new Date(start);
      end.setDate(end.getDate() + 6);
    } else {
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [currentDate, view]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      };
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (scopeFilter !== 'ALL') params.scope = scopeFilter;

      const res = await getCalendarEvents(params);
      if (res.success) {
        setEvents(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, typeFilter, scopeFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Navigation
  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleDateClick = (date) => {
    setCurrentDate(date);
    if (view === 'month') setView('day');
  };

  const handleEventClick = (evt) => {
    if (evt.sourceType === 'meeting') {
      setSelectedMeeting(evt);
    } else {
      // Task or Deadline
      setSelectedTask({ _id: evt.sourceId, ...evt });
      setIsTaskDetailsOpen(true);
    }
  };

  const handleMeetingDelete = async (meetingId) => {
    try {
      await deleteMeeting(meetingId);
      setSelectedMeeting(null);
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  };

  // Title
  const title = useMemo(() => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startLabel} – ${endLabel}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentDate, view]);

  // Stats
  const taskCount = events.filter((e) => e.sourceType === 'task').length;
  const meetingCount = events.filter((e) => e.sourceType === 'meeting').length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Unified view of tasks, deadlines, and meetings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateTaskOpen(true)}
            className="px-3 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateMeetingOpen(true)}
            className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <Video className="w-3.5 h-3.5" />
            <span>New Meeting</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={navigatePrev}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={navigateNext}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <h2 className="text-sm font-bold text-slate-900 dark:text-white ml-2">
              {title}
            </h2>

            {loading && <RefreshCw className="w-3.5 h-3.5 text-powder-600 animate-spin ml-2" />}
          </div>

          {/* Right: View Switcher + Filters */}
          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-2 mr-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <CheckSquare className="w-3 h-3" /> {taskCount} tasks
              </span>
              <span className="flex items-center gap-1">
                <Video className="w-3 h-3" /> {meetingCount} meetings
              </span>
            </div>

            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl border text-xs transition ${
                showFilters
                  ? 'border-powder-300 dark:border-powder-700 bg-powder-50 dark:bg-powder-950/40 text-powder-600 dark:text-powder-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
            </button>

            {/* View Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
              {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    view === key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Type Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Type:</span>
              {TYPE_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTypeFilter(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    typeFilter === key
                      ? 'bg-powder-100 dark:bg-powder-900/50 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Scope Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Scope:</span>
              {SCOPE_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScopeFilter(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    scopeFilter === key
                      ? 'bg-powder-100 dark:bg-powder-900/50 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendar View */}
      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          events={events}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={events}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'day' && (
        <DayView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
        />
      )}

      {/* Modals */}
      <CreateMeetingModal
        isOpen={isCreateMeetingOpen}
        onClose={() => setIsCreateMeetingOpen(false)}
        onMeetingCreated={() => {
          setIsCreateMeetingOpen(false);
          fetchEvents();
        }}
        defaultDate={currentDate}
      />

      <MeetingDetailsModal
        isOpen={!!selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        meeting={selectedMeeting}
        onDelete={handleMeetingDelete}
      />

      {isCreateTaskOpen && (
        <CreateTaskModal
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          onTaskCreated={() => {
            setIsCreateTaskOpen(false);
            fetchEvents();
          }}
        />
      )}

      {isTaskDetailsOpen && selectedTask && (
        <TaskDetailsModal
          isOpen={isTaskDetailsOpen}
          onClose={() => {
            setIsTaskDetailsOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          projectRole="MEMBER"
          onTaskUpdated={() => fetchEvents()}
          onTaskDeleted={() => {
            setIsTaskDetailsOpen(false);
            setSelectedTask(null);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
};

export default Calendar;
