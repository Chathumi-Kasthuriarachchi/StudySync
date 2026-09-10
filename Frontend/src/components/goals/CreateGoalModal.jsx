import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  Clock,
  CheckCircle2,
  Calendar,
  FolderKanban,
  User,
  AlertCircle,
  Flag,
} from 'lucide-react';
import { createGoal, updateGoal } from '../../services/goalService';
import { getProjects } from '../../services/projectService';

const CreateGoalModal = ({ isOpen, onClose, onGoalCreated, editGoal = null }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contextType: 'PERSONAL', // 'PERSONAL' | 'PROJECT'
    project: '',
    status: 'NOT_STARTED',
    measurementType: 'TASK_COUNT',
    targetValue: '',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      loadProjects();

      if (editGoal) {
        setFormData({
          title: editGoal.title || '',
          description: editGoal.description || '',
          contextType: editGoal.project ? 'PROJECT' : 'PERSONAL',
          project: editGoal.project?._id || editGoal.project || '',
          status: editGoal.status || 'NOT_STARTED',
          measurementType: editGoal.measurementType || 'TASK_COUNT',
          targetValue: editGoal.targetValue !== undefined ? String(editGoal.targetValue) : '',
          startDate: editGoal.startDate ? editGoal.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
          targetDate: editGoal.targetDate ? editGoal.targetDate.split('T')[0] : '',
        });
      } else {
        setFormData({
          title: '',
          description: '',
          contextType: 'PERSONAL',
          project: '',
          status: 'NOT_STARTED',
          measurementType: 'TASK_COUNT',
          targetValue: '5',
          startDate: new Date().toISOString().split('T')[0],
          targetDate: '',
        });
      }
    }
  }, [isOpen, editGoal]);

  const loadProjects = async () => {
    try {
      const res = await getProjects();
      const list = res.data || res.projects || [];
      // Filter projects where user is owner or manager if role is present, or allow all user projects
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Goal title is required');
      return;
    }

    if (formData.contextType === 'PROJECT' && !formData.project) {
      setError('Please select a project for this goal');
      return;
    }

    if (formData.startDate && formData.targetDate) {
      const start = new Date(formData.startDate);
      const target = new Date(formData.targetDate);
      if (target < start) {
        setError('Target date cannot be before start date');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        measurementType: formData.measurementType,
        targetValue: formData.measurementType === 'MILESTONE' ? 0 : Number(formData.targetValue) || 0,
        startDate: formData.startDate || null,
        targetDate: formData.targetDate || null,
      };

      if (!editGoal) {
        payload.project = formData.contextType === 'PROJECT' ? formData.project : null;
      }

      let res;
      if (editGoal) {
        res = await updateGoal(editGoal._id, payload);
      } else {
        res = await createGoal(payload);
      }

      if (onGoalCreated) {
        onGoalCreated(res.goal || res);
      }
      onClose();
    } catch (err) {
      console.error('Save goal error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editGoal ? 'Edit Goal' : 'Create New Goal'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define an outcome measured through tasks, focus time, or milestones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Goal Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Master React Fundamentals or Launch Beta MVP"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="What does success look like for this goal?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all resize-none"
            />
          </div>

          {/* Context Selector (Only on creation) */}
          {!editGoal && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Goal Context
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, contextType: 'PERSONAL', project: '' }))}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                    formData.contextType === 'PERSONAL'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">Personal Goal</p>
                    <p className="text-[11px] opacity-75">Only you & your tasks</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, contextType: 'PROJECT' }))}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                    formData.contextType === 'PROJECT'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <FolderKanban className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">Project Goal</p>
                    <p className="text-[11px] opacity-75">Shared with project</p>
                  </div>
                </button>
              </div>

              {formData.contextType === 'PROJECT' && (
                <div className="mt-3">
                  <select
                    name="project"
                    value={formData.project}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a Project...</option>
                    {projects.map((proj) => (
                      <option key={proj._id} value={proj._id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Measurement Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Measurement Metric
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { type: 'TASK_COUNT', label: 'Task Count', icon: CheckCircle2, desc: 'Completed tasks' },
                { type: 'TIME', label: 'Focus Time', icon: Clock, desc: 'Hours tracked' },
                { type: 'MILESTONE', label: 'Milestones', icon: Flag, desc: 'Key deliverables' },
              ].map(({ type, label, icon: Icon, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, measurementType: type }))}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    formData.measurementType === type
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1 text-current" />
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] opacity-75 mt-0.5">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Value (for TASK_COUNT and TIME) */}
          {formData.measurementType !== 'MILESTONE' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {formData.measurementType === 'TASK_COUNT' ? 'Target Completed Tasks' : 'Target Focus Hours'}
              </label>
              <input
                type="number"
                name="targetValue"
                value={formData.targetValue}
                onChange={handleChange}
                min="1"
                placeholder={formData.measurementType === 'TASK_COUNT' ? 'e.g., 8' : 'e.g., 20'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          )}

          {/* Status & Timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Target Date
              </label>
              <input
                type="date"
                name="targetDate"
                value={formData.targetDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? 'Saving...' : editGoal ? 'Update Goal' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGoalModal;
