import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Timer,
  Play,
  Pause,
  Square,
  XCircle,
  Sparkles,
  CheckCircle2,
  FolderKanban,
  User,
  Coffee,
  BrainCircuit,
  Volume2,
  VolumeX,
  AlertCircle,
  Check,
  Settings2,
  Bell,
  Sliders,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTimeTracking, formatDuration, formatHumanTime } from '../context/TimeTrackingContext';
import { getPersonalTasks, getMyTasks, getTaskById } from '../services/taskService';
import { getTaskTimeSummary } from '../services/timeService';

/**
 * Web Audio API synthesizer for clean, audible chimes and alarms
 * without external audio files.
 */
const playAlarmSound = (soundType = 'bell') => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (soundType === 'digital') {
      // 3 crisp digital beeps repeated twice
      [0, 0.2, 0.4, 0.8, 1.0, 1.2].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.12);
      });
    } else if (soundType === 'marimba') {
      // Uplifting ascending marimba chord
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((freq, idx) => {
        const delay = idx * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.5);
      });
    } else {
      // Tibetan singing bowl / Zen Bell (default)
      const freqs = [440, 880, 1320, 1760];
      const gains = [0.35, 0.18, 0.1, 0.05];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gains[idx], ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 2.5);
      });
    }
  } catch (err) {
    console.error('Audio synthesis failed:', err);
  }
};

/**
 * Desktop notification helper
 */
const sendDesktopNotification = (title, body) => {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    } catch {
      // Notification failed
    }
  }
};

/**
 * Focus Mode Page — Phase 9
 *
 * Dedicated workspace for deep work and customizable Pomodoro intervals.
 * Features customizable work & break durations, audio alarms, desktop notifications,
 * target reminders, and direct persistence to TimeSession backend.
 */
const Focus = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTaskId = searchParams.get('taskId');

  const {
    activeSession,
    isTracking,
    elapsedSeconds,
    startTimer: contextStartTimer,
    stopTimer: contextStopTimer,
    cancelTimer: contextCancelTimer,
  } = useTimeTracking();

  // Mode and settings
  const [mode, setMode] = useState('STANDARD'); // 'STANDARD' | 'POMODORO'
  const [pomodoroPhase, setPomodoroPhase] = useState('WORK'); // 'WORK' | 'BREAK'
  const [isPaused, setIsPaused] = useState(false);

  // Customizable Pomodoro Durations (Defaults: 25m Focus / 5m Break)
  const [workMinutes, setWorkMinutes] = useState(() => {
    const saved = localStorage.getItem('studysync_pomodoro_work_mins');
    return saved ? Math.max(1, Number(saved)) : 25;
  });
  const [breakMinutes, setBreakMinutes] = useState(() => {
    const saved = localStorage.getItem('studysync_pomodoro_break_mins');
    return saved ? Math.max(1, Number(saved)) : 5;
  });

  // Standard Mode Target Time Reminder (0 = off)
  const [targetReminderMinutes, setTargetReminderMinutes] = useState(() => {
    const saved = localStorage.getItem('studysync_target_reminder_mins');
    return saved ? Number(saved) : 0;
  });

  // Sound and Notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alarmSound, setAlarmSound] = useState(() => {
    return localStorage.getItem('studysync_alarm_sound') || 'bell';
  });
  const [showSettings, setShowSettings] = useState(false);

  // Break Countdown State (seconds remaining in break)
  const [breakRemainingSeconds, setBreakRemainingSeconds] = useState(breakMinutes * 60);
  const [isBreakRunning, setIsBreakRunning] = useState(false);

  // Available tasks for selection
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskSummary, setTaskSummary] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastFinishedDuration, setLastFinishedDuration] = useState(0);
  const [showIntervalAlert, setShowIntervalAlert] = useState(null); // 'WORK_DONE' | 'BREAK_DONE' | 'TARGET_REACHED'

  // Persist user timer preferences
  useEffect(() => {
    localStorage.setItem('studysync_pomodoro_work_mins', String(workMinutes));
  }, [workMinutes]);

  useEffect(() => {
    localStorage.setItem('studysync_pomodoro_break_mins', String(breakMinutes));
  }, [breakMinutes]);

  useEffect(() => {
    localStorage.setItem('studysync_alarm_sound', alarmSound);
  }, [alarmSound]);

  useEffect(() => {
    localStorage.setItem('studysync_target_reminder_mins', String(targetReminderMinutes));
  }, [targetReminderMinutes]);

  // Trigger alarm chime + desktop alert
  const triggerAlarm = useCallback(
    (title, body) => {
      if (soundEnabled) {
        playAlarmSound(alarmSound);
      }
      sendDesktopNotification(title, body);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 150, 300]);
      }
    },
    [soundEnabled, alarmSound]
  );

  // Request desktop notification permission on first toggle or settings open
  const handleEnableNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        triggerAlarm('Notifications Enabled! 🔔', 'StudySync will alert you when timers and breaks finish.');
      }
    }
  };

  // Load user tasks (personal + assigned project tasks)
  const loadTasks = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const [personalRes, myRes] = await Promise.all([
        getPersonalTasks().catch(() => ({ data: [] })),
        getMyTasks().catch(() => ({ data: [] })),
      ]);

      const pList = personalRes.data || [];
      const mList = myRes.data || [];

      // Combine unique tasks that are not COMPLETED
      const map = new Map();
      [...pList, ...mList].forEach((t) => {
        if (t && t._id && t.status !== 'COMPLETED') {
          map.set(t._id.toString(), t);
        }
      });

      const uniqueList = Array.from(map.values());
      setTasks(uniqueList);

      // Align selected task
      if (activeSession?.task?._id) {
        const activeTaskId = activeSession.task._id.toString();
        const activeT = uniqueList.find((t) => t._id.toString() === activeTaskId);
        if (activeT) {
          setSelectedTask(activeT);
        } else {
          getTaskById(activeTaskId)
            .then((r) => r.success && setSelectedTask(r.data))
            .catch(() => {});
        }
      } else if (initialTaskId) {
        const initialT = uniqueList.find((t) => t._id.toString() === initialTaskId);
        if (initialT) {
          setSelectedTask(initialT);
        } else {
          getTaskById(initialTaskId)
            .then((r) => r.success && setSelectedTask(r.data))
            .catch(() => {});
        }
      } else if (uniqueList.length > 0 && !selectedTask) {
        setSelectedTask(uniqueList[0]);
      }
    } catch (err) {
      console.error('Failed to load tasks for Focus Mode:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, [activeSession, initialTaskId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Align selectedTask if activeSession changes
  useEffect(() => {
    if (activeSession?.task?._id) {
      const activeTaskId = activeSession.task._id.toString();
      if (!selectedTask || selectedTask._id?.toString() !== activeTaskId) {
        getTaskById(activeTaskId)
          .then((r) => r.success && setSelectedTask(r.data))
          .catch(() => {});
      }
      setIsPaused(false);
    }
  }, [activeSession]);

  // Load task time summary for the selected task
  const refreshSummary = useCallback(async (taskId) => {
    if (!taskId) return;
    try {
      const res = await getTaskTimeSummary(taskId);
      if (res.success && res.data) {
        setTaskSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to get task summary:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedTask?._id) {
      refreshSummary(selectedTask._id);
    } else {
      setTaskSummary(null);
    }
  }, [selectedTask, refreshSummary]);

  // Check if active timer is on the currently selected task
  const isActiveOnThisTask =
    isTracking &&
    selectedTask &&
    (activeSession?.task?._id?.toString() === selectedTask._id?.toString() ||
      activeSession?.task?.toString() === selectedTask._id?.toString());

  const isActiveOnOtherTask = isTracking && !isActiveOnThisTask;

  // ── Pomodoro Work Interval Completion Logic ──
  const workSecondsLimit = workMinutes * 60;
  const pomodoroSecondsLeft = Math.max(0, workSecondsLimit - elapsedSeconds);

  // Watch for Pomodoro Work completion
  const hasTriggeredWorkDoneRef = useRef(false);
  useEffect(() => {
    if (mode === 'POMODORO' && pomodoroPhase === 'WORK' && isTracking) {
      if (elapsedSeconds >= workSecondsLimit && !hasTriggeredWorkDoneRef.current) {
        hasTriggeredWorkDoneRef.current = true;
        triggerAlarm(
          'Focus Interval Complete! 🎉',
          `Awesome job! You finished your ${workMinutes}-minute focus session. Time for a ${breakMinutes}-minute break.`
        );
        // Auto-pause/stop the work session on the backend so duration is saved
        contextStopTimer()
          .then(() => {
            if (selectedTask?._id) refreshSummary(selectedTask._id);
          })
          .catch(() => {});

        setShowIntervalAlert('WORK_DONE');
      }
    } else {
      if (elapsedSeconds < workSecondsLimit) {
        hasTriggeredWorkDoneRef.current = false;
      }
    }
  }, [
    mode,
    pomodoroPhase,
    isTracking,
    elapsedSeconds,
    workSecondsLimit,
    workMinutes,
    breakMinutes,
    triggerAlarm,
    contextStopTimer,
    refreshSummary,
    selectedTask,
  ]);

  // ── Break Countdown Timer Loop ──
  useEffect(() => {
    let interval = null;
    if (pomodoroPhase === 'BREAK' && isBreakRunning) {
      interval = setInterval(() => {
        setBreakRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsBreakRunning(false);
            triggerAlarm(
              'Break Finished! 🚀',
              'Break time is over. Ready to start your next focused study interval?'
            );
            setShowIntervalAlert('BREAK_DONE');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomodoroPhase, isBreakRunning, triggerAlarm]);

  // ── Standard Focus Mode Target Reminder Logic ──
  const hasTriggeredTargetReminderRef = useRef(false);
  useEffect(() => {
    if (mode === 'STANDARD' && isTracking && targetReminderMinutes > 0) {
      const targetSeconds = targetReminderMinutes * 60;
      if (elapsedSeconds >= targetSeconds && !hasTriggeredTargetReminderRef.current) {
        hasTriggeredTargetReminderRef.current = true;
        triggerAlarm(
          'Target Focus Goal Reached! 🎯',
          `You have achieved your target focus time of ${targetReminderMinutes} minutes on "${
            selectedTask?.title || 'your task'
          }"!`
        );
        setShowIntervalAlert('TARGET_REACHED');
      }
    } else {
      if (elapsedSeconds < targetReminderMinutes * 60) {
        hasTriggeredTargetReminderRef.current = false;
      }
    }
  }, [mode, isTracking, elapsedSeconds, targetReminderMinutes, triggerAlarm, selectedTask]);

  // ── Action Handlers ──
  const handleStart = async () => {
    if (!selectedTask) {
      setError('Please select a task to focus on.');
      return;
    }
    if (selectedTask.status === 'COMPLETED') {
      setError('Cannot track time on a completed task. Please reopen the task first.');
      return;
    }
    setError('');
    setIsPaused(false);
    setPomodoroPhase('WORK');
    setIsBreakRunning(false);
    hasTriggeredWorkDoneRef.current = false;
    try {
      await contextStartTimer(selectedTask._id);
      await refreshSummary(selectedTask._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start timer');
    }
  };

  const handlePause = async () => {
    setError('');
    try {
      await contextStopTimer();
      setIsPaused(true);
      if (selectedTask?._id) refreshSummary(selectedTask._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to pause timer');
    }
  };

  const handleResume = async () => {
    if (!selectedTask) return;
    setError('');
    try {
      await contextStartTimer(selectedTask._id);
      setIsPaused(false);
      if (selectedTask?._id) refreshSummary(selectedTask._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resume timer');
    }
  };

  const handleFinish = async () => {
    setError('');
    try {
      let totalSecondsWorked = elapsedSeconds;
      if (isTracking) {
        const res = await contextStopTimer();
        if (res?.durationSeconds) {
          totalSecondsWorked = res.durationSeconds;
        }
      }
      setIsPaused(false);
      setIsBreakRunning(false);
      setLastFinishedDuration(totalSecondsWorked);
      setShowCelebration(true);
      if (selectedTask?._id) refreshSummary(selectedTask._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to finish session');
    }
  };

  const handleCancel = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this focus session? The current session duration will not be saved.'
      )
    ) {
      return;
    }
    setError('');
    try {
      await contextCancelTimer();
      setIsPaused(false);
      setIsBreakRunning(false);
      if (selectedTask?._id) refreshSummary(selectedTask._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel timer');
    }
  };

  // Start Break interval
  const handleStartBreak = () => {
    setShowIntervalAlert(null);
    setPomodoroPhase('BREAK');
    setBreakRemainingSeconds(breakMinutes * 60);
    setIsBreakRunning(true);
  };

  // Skip Break and Start New Focus interval
  const handleSkipBreak = async () => {
    setShowIntervalAlert(null);
    setPomodoroPhase('WORK');
    setIsBreakRunning(false);
    handleStart();
  };

  // Switch task
  const handleSelectTask = (taskId) => {
    const found = tasks.find((t) => t._id.toString() === taskId);
    if (found) {
      setSelectedTask(found);
      setSearchParams({ taskId: found._id });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-powder-500" />
              <span>Focus Mode</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800">
              <Sparkles className="w-3.5 h-3.5" />
              Zen Workspace
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Deep work timer with customizable Pomodoro intervals, break countdowns, and sound alarms.
          </p>
        </div>

        {/* Top Controls: Audio toggle & Configure Intervals */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              soundEnabled
                ? 'border-powder-200 dark:border-powder-800 text-powder-600 dark:text-powder-400 bg-powder-50 dark:bg-powder-950/40'
                : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
            }`}
            title={soundEnabled ? 'Alarm sounds enabled' : 'Sound muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Alarm On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              showSettings
                ? 'border-powder-500 text-powder-600 dark:text-powder-300 bg-powder-50 dark:bg-powder-950/60'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings2 className="w-4 h-4 text-powder-500" />
            <span>Customize Timer</span>
            {showSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Custom Timer & Alarm Settings Drawer ── */}
      {showSettings && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-powder-200 dark:border-slate-800 shadow-lg space-y-5 animate-scaleIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-powder-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Timer & Alarm Customization
              </h3>
            </div>
            <span className="text-xs text-slate-400">Settings auto-saved</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            {/* 1. Pomodoro Focus Interval */}
            <div className="space-y-2.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Pomodoro Focus Duration</span>
                <span className="text-powder-600 dark:text-powder-400 font-extrabold text-sm">
                  {workMinutes} mins
                </span>
              </label>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[15, 25, 30, 45, 50, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={isTracking}
                    onClick={() => setWorkMinutes(mins)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      workMinutes === mins
                        ? 'bg-powder-600 text-white border-powder-600 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {mins}m {mins === 25 ? '(Default)' : ''}
                  </button>
                ))}
              </div>

              {/* Custom Number Input */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-400 text-[11px]">Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  disabled={isTracking}
                  value={workMinutes}
                  onChange={(e) => setWorkMinutes(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-semibold text-center text-xs"
                />
                <span className="text-slate-400 text-[11px]">minutes</span>
              </div>
            </div>

            {/* 2. Break Duration */}
            <div className="space-y-2.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Break Duration</span>
                <span className="text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                  {breakMinutes} mins
                </span>
              </label>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[3, 5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={isTracking}
                    onClick={() => {
                      setBreakMinutes(mins);
                      setBreakRemainingSeconds(mins * 60);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      breakMinutes === mins
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {mins}m {mins === 5 ? '(Default)' : ''}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-400 text-[11px]">Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  disabled={isTracking}
                  value={breakMinutes}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1);
                    setBreakMinutes(val);
                    setBreakRemainingSeconds(val * 60);
                  }}
                  className="w-24 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-semibold text-center text-xs"
                />
                <span className="text-slate-400 text-[11px]">minutes</span>
              </div>
            </div>

            {/* 3. Alarm Tone & Desktop Notification */}
            <div className="space-y-2.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Alarm Sound & Alerts
              </label>

              <div className="space-y-1.5">
                {[
                  { id: 'bell', name: 'Zen Temple Bell' },
                  { id: 'digital', name: 'Digital Triple Beep' },
                  { id: 'marimba', name: 'Uplifting Marimba' },
                ].map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition ${
                      alarmSound === s.id
                        ? 'border-powder-400 bg-powder-50/70 dark:bg-powder-950/50 text-slate-900 dark:text-white font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="alarmSound"
                        checked={alarmSound === s.id}
                        onChange={() => setAlarmSound(s.id)}
                        className="text-powder-600 focus:ring-powder-500"
                      />
                      <span>{s.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        playAlarmSound(s.id);
                      }}
                      className="text-[11px] font-bold text-powder-600 hover:underline flex items-center gap-1"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Test</span>
                    </button>
                  </label>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="text-xs font-semibold text-powder-600 dark:text-powder-400 hover:underline flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enable Desktop Popups</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs shadow-xs animate-shake">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-amber-600 hover:text-amber-900 font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active on other task banner */}
      {isActiveOnOtherTask && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              A timer is currently active on <strong>"{activeSession?.task?.title || 'another task'}"</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeSession?.task?._id) {
                const found = tasks.find((t) => t._id.toString() === activeSession.task._id.toString());
                if (found) setSelectedTask(found);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition"
          >
            Switch to Active Task
          </button>
        </div>
      )}

      {/* ── Main Zen Timer Card ── */}
      <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-8 sm:p-12 text-center transition-all">
        {/* Glow ambient background effect */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 blur-3xl rounded-full pointer-events-none transition-all duration-700 ${
            pomodoroPhase === 'BREAK'
              ? 'bg-rose-500/15'
              : 'bg-powder-500/10 dark:bg-powder-500/5'
          }`}
        />

        {/* Mode Selector Pills */}
        <div className="relative z-10 flex items-center justify-center gap-2 mb-8">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              disabled={isTracking || isBreakRunning}
              onClick={() => {
                setMode('STANDARD');
                setPomodoroPhase('WORK');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'STANDARD'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Timer className="w-3.5 h-3.5 text-powder-500" />
              <span>Standard Focus</span>
            </button>

            <button
              type="button"
              disabled={isTracking || isBreakRunning}
              onClick={() => {
                setMode('POMODORO');
                setPomodoroPhase('WORK');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'POMODORO'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-rose-500" />
              <span>Pomodoro ({workMinutes}m / {breakMinutes}m)</span>
            </button>
          </div>
        </div>

        {/* Task Selection Header */}
        <div className="relative z-10 max-w-md mx-auto mb-8">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {pomodoroPhase === 'BREAK' ? 'Resting / Break Time' : 'Focusing On Task'}
          </label>

          {pomodoroPhase === 'BREAK' ? (
            <div className="px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300 text-sm shadow-xs">
              <Coffee className="w-4 h-4 text-rose-500 animate-bounce" />
              <span>Rest & Recharge Interval ({breakMinutes} mins)</span>
            </div>
          ) : isTracking ? (
            <div className="px-4 py-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 border border-powder-200 dark:border-powder-800 inline-flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate">{selectedTask?.title || activeSession?.task?.title || 'Active Task'}</span>
              {selectedTask?.project ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-powder-100 dark:bg-powder-900 text-powder-700 dark:text-powder-300">
                  Project
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                  Personal
                </span>
              )}
            </div>
          ) : (
            <select
              value={selectedTask?._id || ''}
              onChange={(e) => handleSelectTask(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition text-center shadow-xs"
            >
              {tasks.length === 0 ? (
                <option value="">No active tasks found</option>
              ) : (
                tasks.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.title} {t.project ? '(Project)' : '(Personal)'}
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        {/* Big Circular Clock Display */}
        <div className="relative z-10 my-6">
          <div
            className={`inline-flex flex-col items-center justify-center w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 bg-slate-50/50 dark:bg-slate-950/40 shadow-inner relative transition-all duration-500 ${
              pomodoroPhase === 'BREAK'
                ? 'border-rose-200 dark:border-rose-900'
                : 'border-slate-100 dark:border-slate-800/80'
            }`}
          >
            {/* Pulsing ring while running */}
            {(isActiveOnThisTask || isBreakRunning) && (
              <div
                className={`absolute inset-0 rounded-full border-4 animate-ping pointer-events-none ${
                  pomodoroPhase === 'BREAK' ? 'border-rose-500/30' : 'border-powder-500/40'
                }`}
              />
            )}

            <span className="text-4xl sm:text-5xl font-mono font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {pomodoroPhase === 'BREAK'
                ? formatDuration(breakRemainingSeconds)
                : mode === 'POMODORO'
                ? formatDuration(pomodoroSecondsLeft)
                : formatDuration(elapsedSeconds)}
            </span>

            <span className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-widest flex items-center gap-1.5">
              {pomodoroPhase === 'BREAK' ? (
                isBreakRunning ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">BREAK IN PROGRESS</span>
                  </>
                ) : (
                  <span className="text-slate-400">BREAK READY</span>
                )
              ) : isActiveOnThisTask ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{mode === 'POMODORO' ? `FOCUS (${workMinutes}M)` : 'SESSION RUNNING'}</span>
                </>
              ) : isPaused ? (
                <span className="text-amber-500 font-bold">PAUSED</span>
              ) : (
                <span>READY</span>
              )}
            </span>
          </div>
        </div>

        {/* Action Controls Button Bar */}
        <div className="relative z-10 flex items-center justify-center gap-3 pt-4 flex-wrap">
          {pomodoroPhase === 'BREAK' ? (
            /* Break Mode Controls */
            <>
              {isBreakRunning ? (
                <button
                  type="button"
                  onClick={() => setIsBreakRunning(false)}
                  className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Break</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsBreakRunning(true)}
                  className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-rose-500/20 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Break ({breakMinutes}m)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSkipBreak}
                className="px-6 py-3 rounded-2xl bg-powder-600 hover:bg-powder-700 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-powder-500/20 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Return to Focus</span>
              </button>
            </>
          ) : isActiveOnThisTask ? (
            /* Work Mode Running Controls */
            <>
              <button
                type="button"
                onClick={handlePause}
                className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center gap-2 shadow-xs transition"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Finish & Save</span>
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-3 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-sm font-bold flex items-center gap-1.5 transition"
                title="Discard session"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </>
          ) : isPaused ? (
            /* Work Mode Paused Controls */
            <>
              <button
                type="button"
                onClick={handleResume}
                className="px-8 py-3.5 rounded-2xl bg-powder-600 hover:bg-powder-700 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-powder-500/20 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Focus</span>
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 shadow-xs transition"
              >
                <Check className="w-4 h-4" />
                <span>Finish & Close</span>
              </button>
            </>
          ) : (
            /* Ready to Start */
            <button
              type="button"
              disabled={!selectedTask || isActiveOnOtherTask}
              onClick={handleStart}
              className="px-8 py-3.5 rounded-2xl bg-powder-600 hover:bg-powder-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-powder-500/20 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Focus Session ({workMinutes}m)</span>
            </button>
          )}
        </div>

        {/* Task Progress Footer */}
        {selectedTask && taskSummary && (
          <div className="relative z-10 max-w-lg mx-auto mt-10 pt-6 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimated</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {taskSummary.estimatedMinutes ? formatHumanTime(taskSummary.estimatedMinutes) : 'No estimate'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Tracked</span>
                <span className="font-bold text-powder-600 dark:text-powder-400">
                  {formatHumanTime(taskSummary.totalTrackedMinutes || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  {taskSummary.isOverEstimate ? 'Over Estimate' : 'Remaining'}
                </span>
                <span
                  className={`font-bold ${
                    taskSummary.isOverEstimate ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {taskSummary.isOverEstimate
                    ? `+${formatHumanTime(taskSummary.overMinutes)}`
                    : taskSummary.estimatedMinutes
                    ? formatHumanTime(taskSummary.remainingMinutes)
                    : '—'}
                </span>
              </div>
            </div>

            {taskSummary.estimatedMinutes > 0 && (
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    taskSummary.isOverEstimate
                      ? 'bg-rose-500'
                      : (taskSummary.totalTrackedMinutes || 0) / taskSummary.estimatedMinutes > 0.85
                      ? 'bg-amber-500'
                      : 'bg-powder-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((taskSummary.totalTrackedMinutes || 0) / taskSummary.estimatedMinutes) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Interval Completion Alert Modal (Alarm Event) ── */}
      {showIntervalAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center shadow-2xl space-y-4 animate-scaleIn">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border ${
                showIntervalAlert === 'WORK_DONE'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                  : showIntervalAlert === 'BREAK_DONE'
                  ? 'bg-powder-50 dark:bg-powder-950/60 text-powder-600 border-powder-200 dark:border-powder-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border-amber-200 dark:border-amber-800'
              }`}
            >
              {showIntervalAlert === 'WORK_DONE' ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : showIntervalAlert === 'BREAK_DONE' ? (
                <Coffee className="w-8 h-8" />
              ) : (
                <Bell className="w-8 h-8 animate-bounce" />
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {showIntervalAlert === 'WORK_DONE'
                ? 'Focus Interval Complete! 🎉'
                : showIntervalAlert === 'BREAK_DONE'
                ? 'Break Finished! ☕'
                : 'Target Reminder Reached! 🎯'}
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {showIntervalAlert === 'WORK_DONE'
                ? `You completed ${workMinutes} minutes of focused study. Time session has been saved. Ready for a break?`
                : showIntervalAlert === 'BREAK_DONE'
                ? 'Your rest time is complete. Ready to begin your next focus interval?'
                : `You reached your target focus goal of ${targetReminderMinutes} minutes.`}
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {showIntervalAlert === 'WORK_DONE' ? (
                <>
                  <button
                    type="button"
                    onClick={handleStartBreak}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Coffee className="w-4 h-4" />
                    <span>Start {breakMinutes}-Min Break</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipBreak}
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                  >
                    Skip Break & Keep Focusing
                  </button>
                </>
              ) : showIntervalAlert === 'BREAK_DONE' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowIntervalAlert(null);
                    setPomodoroPhase('WORK');
                    handleStart();
                  }}
                  className="w-full py-2.5 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-bold transition"
                >
                  Start Next Focus Session
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowIntervalAlert(null)}
                  className="w-full py-2.5 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-bold transition"
                >
                  Dismiss Reminder
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Celebration Modal on Manual Finish */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center shadow-2xl space-y-4 animate-scaleIn">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Great Focus Session!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your focus session has been stored in your task's time log.
            </p>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Time Recorded</span>
              <p className="text-base font-extrabold text-powder-600 dark:text-powder-400">
                {formatDuration(lastFinishedDuration)}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCelebration(false)}
                className="flex-1 py-2.5 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-bold transition"
              >
                Keep Going
              </button>
              <Link
                to="/tasks"
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition text-center"
              >
                View Tasks
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Focus;
