import { useState } from 'react';
import {
  ChevronDown,
  CheckCircle2,
  Calendar,
  Sparkles,
  BarChart3,
  Users,
  Send,
  Loader2,
  FileQuestion,
  UserCheck,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { submitSupportTicket } from '../../services/userService';

const QUICK_HELP_TOPICS = [
  {
    id: 'tasks',
    title: 'How to create and manage tasks',
    icon: CheckCircle2,
    color: 'powder',
    steps: [
      'Navigate to the My Tasks page from the main sidebar.',
      'Click the "+ Add Task" button at the top of the board.',
      'Fill in the task title, description, priority (LOW, MEDIUM, HIGH, URGENT), and due date.',
      'Click Create Task to save. You can change statuses anytime by clicking the status pill or dragging cards.',
    ],
  },
  {
    id: 'projects',
    title: 'How to create a project & invite team members',
    icon: Users,
    color: 'mint',
    steps: [
      'Navigate to the Projects page and select "+ New Project".',
      'Provide your project name, color accent, and target milestones.',
      'Inside the Project Details page, open the Team Members tab.',
      'Search for registered users by their name or email and assign their workspace role (EDITOR or VIEWER).',
    ],
  },
  {
    id: 'focus',
    title: 'How to use Focus Mode (Pomodoro & Zen)',
    icon: Sparkles,
    color: 'amber',
    steps: [
      'Click Focus Mode in the sidebar to enter a distraction-free environment.',
      'Choose your preferred focus session length (e.g., 25-minute Pomodoro or 50-minute deep work block).',
      'Select a task from your list to associate time tracking automatically.',
      'Press Start. Completed focus sessions log directly into your productivity Analytics.',
    ],
  },
  {
    id: 'calendar',
    title: 'How to use the Calendar & Deadlines',
    icon: Calendar,
    color: 'powder',
    steps: [
      'Open the Calendar page to see tasks and milestone deliverables plotted across days and weeks.',
      'Click any date cell to quickly inspect tasks scheduled for that day.',
      'Use the filter dropdowns to isolate tasks by project or priority level.',
    ],
  },
  {
    id: 'analytics',
    title: 'How to track productivity analytics',
    icon: BarChart3,
    color: 'mint',
    steps: [
      'Visit the Analytics page to view your completion velocity, focus hours, and task completion rates.',
      'Inspect historical weekly trends to identify peak productive periods and bottlenecks.',
      'Export or review productivity summaries on the Reports page.',
    ],
  },
  {
    id: 'profile',
    title: 'How to update your profile & customize themes',
    icon: UserCheck,
    color: 'amber',
    steps: [
      'Visit the Profile page and click Edit Profile to change your name, handle (@username), or bio.',
      'Click the camera icon on your avatar to upload a profile photo up to 5MB.',
      'In Settings under Appearance, choose between Light, Dark, or System mode to adapt to your environment.',
    ],
  },
];

const FAQ_ITEMS = [
  {
    category: 'Account & Security',
    questions: [
      {
        q: 'How do I change my password?',
        a: 'Navigate to Settings → Security section. In the Change Password card, enter your current password followed by your desired new password (minimum 8 characters, with at least 1 number and 1 special symbol). Submitting will securely update your credentials and terminate other sessions.',
      },
      {
        q: 'How do I log out of other devices?',
        a: 'In Settings → Security, check the Active Sessions list to see all logged-in devices. You can click "Terminate" on individual devices or click "Logout from all devices" to revoke all sessions at once.',
      },
      {
        q: 'Why is my email address locked on the Profile page?',
        a: 'To safeguard your account and prevent unauthorized identity takeover, email modification is restricted to secure verification workflows rather than direct form editing.',
      },
    ],
  },
  {
    category: 'Tasks & Productivity',
    questions: [
      {
        q: 'How do task priorities work?',
        a: 'StudySync supports LOW, MEDIUM, HIGH, and URGENT priorities with color-coded tags. Urgent tasks are automatically surfaced to the top of your Dashboard and daily focus queues.',
      },
      {
        q: 'Can I track time spent on individual tasks?',
        a: 'Yes! In Focus Mode, you can attach any task to your active timer. Time spent is logged into your personal Productivity Analytics and Time Tracking history.',
      },
    ],
  },
  {
    category: 'Projects & Collaboration',
    questions: [
      {
        q: 'How do I invite teammates to my project?',
        a: 'Open your project, go to the Team tab, and use the user search bar to invite registered StudySync members by email or name. You can assign them either an EDITOR or VIEWER role.',
      },
      {
        q: 'Who can delete a project?',
        a: 'Only the project OWNER has authorization to permanently delete a project. Doing so removes associated task memberships and invitations.',
      },
    ],
  },
  {
    category: 'Notifications & Settings',
    questions: [
      {
        q: 'How do I disable optional email notifications?',
        a: 'In Settings → Preferences, find the Email Notifications card and toggle the switch to "Disabled". Your in-app notifications in the top bar bell will continue operating normally.',
      },
      {
        q: 'Does switching to System Theme adapt automatically?',
        a: 'Yes! When you select System, StudySync listens to your operating system’s light/dark mode preference and updates automatically when your OS changes.',
      },
    ],
  },
];

const HelpAndSupportSection = () => {
  const { user } = useAuth();

  // Selected quick help modal / drawer
  const [activeTopic, setActiveTopic] = useState(null);

  // Accordion open states
  const [openFaqIndex, setOpenFaqIndex] = useState({});

  // Contact support form state
  const [name, setName] = useState(() => user?.name || '');
  const [email, setEmail] = useState(() => user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const toggleFaq = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setOpenFaqIndex((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error('Please fill in all support fields.');
      return;
    }

    try {
      setIsSubmittingTicket(true);
      const res = await submitSupportTicket({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });

      if (res.success) {
        toast.success('Support inquiry submitted! We will respond shortly.');
        setSubject('');
        setMessage('');
      }
    } catch (err) {
      console.error('Support submission error:', err);
      toast.error(err.response?.data?.message || 'Failed to submit inquiry. Please try again.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Quick Help Topics */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Quick Help Topics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Interactive guides to get the most out of StudySync features.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {QUICK_HELP_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActiveTopic(topic)}
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-powder-400 dark:hover:border-powder-600 bg-slate-50/50 dark:bg-slate-850 text-left transition cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 text-powder-600 dark:text-powder-400 shadow-2xs group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-powder-600 dark:group-hover:text-powder-400 transition-colors">
                    {topic.title}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors pt-2">
                  View guide &rarr;
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Help Modal Drawer */}
      {activeTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
                  <activeTopic.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeTopic.title}
                </h3>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {activeTopic.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <span className="w-5 h-5 rounded-full bg-powder-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveTopic(null)}
                className="px-5 py-2 rounded-2xl text-xs font-bold text-white bg-powder-600 hover:bg-powder-700 transition cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Frequently Asked Questions Accordion */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2.5 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
            <FileQuestion className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quick answers to common questions about features, accounts, and workspace settings.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {FAQ_ITEMS.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                {cat.category}
              </h3>

              <div className="space-y-2">
                {cat.questions.map((item, qIdx) => {
                  const isOpen = Boolean(openFaqIndex[`${catIdx}-${qIdx}`]);
                  return (
                    <div
                      key={qIdx}
                      className="rounded-2xl border border-slate-200/70 dark:border-slate-800 overflow-hidden bg-slate-50/40 dark:bg-slate-850/60 transition"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(catIdx, qIdx)}
                        className="w-full px-4 py-3 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800 transition"
                      >
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.q}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-powder-500' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Contact Support Form */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Contact Support
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Have questions, feedback, or need assistance? Reach out directly to our team.
            </p>
          </div>
        </div>

        <form onSubmit={handleSupportSubmit} className="space-y-4 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Your Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
              placeholder="Brief summary of your inquiry"
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Message
              </label>
              <span className="text-[11px] text-slate-400">
                {message.length} / 2000
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Describe your question or issue in detail..."
              required
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingTicket}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-powder-600 hover:bg-powder-700 active:scale-95 shadow-md shadow-powder-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {isSubmittingTicket ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending Message...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Send Message
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default HelpAndSupportSection;
