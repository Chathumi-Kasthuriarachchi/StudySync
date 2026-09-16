import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  ExternalLink,
  Code2,
  Sparkles,
  Layers,
  Clock,
  Heart,
  BookOpen,
  Eye,
  X,
} from 'lucide-react';

const TECH_STACK = [
  { name: 'React 18', role: 'Frontend UI', color: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800' },
  { name: 'Vite', role: 'Build Tooling', color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
  { name: 'Tailwind CSS', role: 'Design System', color: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800' },
  { name: 'Node.js & Express', role: 'REST API Backend', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  { name: 'MongoDB', role: 'Database & Atlas', color: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' },
  { name: 'Cloudinary', role: 'CDN Media Storage', color: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' },
  { name: 'JWT & Cookies', role: 'Dual-Token Auth', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
];

const PLATFORM_HIGHLIGHTS = [
  {
    title: 'Workspace Management',
    desc: 'Organize academic projects, assign subtasks, tag priorities, and track milestones.',
  },
  {
    title: 'Focus Sprint Sessions',
    desc: 'Integrated Pomodoro and time tracker to maintain deep study flow without distractions.',
  },
  {
    title: 'Team Collaboration',
    desc: 'Share project boards, invite study partners via email, and collaborate synchronously.',
  },
  {
    title: 'Privacy & Security First',
    desc: 'Multi-session device tracking, granular access controls, and full data deletion rights.',
  },
];

/**
 * About & Legal Section Component
 * 
 * Displays:
 * 1. Platform Details & Version (v1.0.0, MERN tech stack, architecture overview)
 * 2. Terms & Conditions with quick-preview modal and link
 * 3. Privacy Policy with quick-preview modal and link
 */
const AboutAndLegalSection = () => {
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy' | null

  return (
    <div className="space-y-6">
      {/* ── About StudySync Card ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle Decorative Background Glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-powder-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-mint-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-powder-500 text-white flex items-center justify-center shadow-md shadow-powder-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    StudySync
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-powder-100 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 border border-powder-200 dark:border-powder-800">
                    v1.0.0
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-mint-100 dark:bg-mint-950/60 text-mint-700 dark:text-mint-400 border border-mint-200 dark:border-mint-800">
                    Production Stable
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Academic Productivity &amp; Collaborative Study Platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 text-powder-500" />
              <span>Released September 2026</span>
            </div>
          </div>

          {/* Platform Description */}
          <div className="py-6 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
              StudySync is an all-in-one productivity environment built to empower university students,
              researchers, and academic teams. From comprehensive task workflows and interactive project boards
              to focused study sprints and multi-device session security, StudySync centralizes your academic
              workflow in a clean, distraction-free interface.
            </p>

            {/* Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5">
              {PLATFORM_HIGHLIGHTS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-powder-500 shrink-0" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-5.5">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack Pills */}
          <div className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="w-4 h-4 text-powder-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Architecture &amp; Core Stack
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {TECH_STACK.map((item, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${item.color}`}
                >
                  <span className="font-bold">{item.name}</span>
                  <span className="opacity-50">&bull;</span>
                  <span className="text-[11px] opacity-85">{item.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legal & Policies Section ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Terms & Conditions Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Terms &amp; Conditions
                </h3>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Last updated: September 8, 2026
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Understand the rules, guidelines, and acceptable use policies governing your StudySync account,
              content ownership, intellectual property, and community conduct.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveModal('terms')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-powder-600 dark:text-powder-400 hover:text-powder-700 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Quick Preview
            </button>
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-powder-600 dark:hover:text-powder-400 transition"
            >
              Full Document <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Privacy Policy Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Privacy Policy
                </h3>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Last updated: September 8, 2026
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Review how your profile data, study records, and uploaded assets are securely stored, encrypted,
              and never sold or shared with unapproved third parties.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveModal('privacy')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-mint-600 dark:text-mint-400 hover:text-mint-700 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Quick Preview
            </button>
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-mint-600 dark:hover:text-mint-400 transition"
            >
              Full Document <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer / Community Credit */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-powder-500" />
          <span>StudySync Academic Core System &bull; Version 1.0.0</span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          Crafted with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for student success
        </div>
      </div>

      {/* ── Quick Preview Modal ────────────────────────────────────────── */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    activeModal === 'terms'
                      ? 'bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400'
                      : 'bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400'
                  }`}
                >
                  {activeModal === 'terms' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeModal === 'terms' ? 'Terms & Conditions Preview' : 'Privacy Policy Preview'}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Effective: September 8, 2026
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="overflow-y-auto py-5 pr-2 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
              {activeModal === 'terms' ? (
                <>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      1. Acceptance of Terms
                    </h4>
                    <p>
                      By creating an account or otherwise accessing StudySync, you agree to be bound by these
                      Terms &amp; Conditions. If you do not agree to all terms, please do not use the service.
                    </p>
                  </section>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      2. Account Responsibilities
                    </h4>
                    <p>
                      You are responsible for maintaining the confidentiality of your credentials, setting a strong
                      password, and all activities occurring under your account. You agree not to distribute malicious
                      code or engage in harassment.
                    </p>
                  </section>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      3. Intellectual Property &amp; Content Ownership
                    </h4>
                    <p>
                      You retain full ownership of all tasks, notes, documents, and project assets you upload to StudySync.
                      StudySync does not claim ownership of user-submitted materials.
                    </p>
                  </section>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      4. Termination &amp; Account Rights
                    </h4>
                    <p>
                      You may delete your account at any time via Settings &gt; Danger Zone. Upon deletion, all personal data,
                      tokens, and personal task records are permanently purged.
                    </p>
                  </section>
                </>
              ) : (
                <>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      1. Information We Collect
                    </h4>
                    <p>
                      We collect information you directly provide, such as your display name, email address, password hash,
                      profile avatar, task data, and academic preferences. We also capture browser user-agent and IP addresses
                      strictly for active session tracking and security.
                    </p>
                  </section>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      2. Cookie &amp; Session Management
                    </h4>
                    <p>
                      We utilize HttpOnly, SameSite strict cookies for refresh token rotation. Tokens cannot be accessed via
                      client-side JavaScript, effectively neutralizing Cross-Site Scripting (XSS) token extraction.
                    </p>
                  </section>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      3. Data Retention &amp; Permanent Erasure
                    </h4>
                    <p>
                      Your data is stored securely in MongoDB and Cloudinary. When you request account deletion, all personal
                      records, cloud avatars, and authentication sessions are permanently deleted across our infrastructure.
                    </p>
                  </section>
                  <section className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      4. Third-Party Sharing
                    </h4>
                    <p>
                      StudySync does not sell, lease, or monetize your personal information or study metrics to advertisers
                      or third-party data brokers.
                    </p>
                  </section>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <Link
                to={activeModal === 'terms' ? '/terms' : '/privacy'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-powder-600 dark:text-powder-400 hover:underline"
              >
                Open Full Document in New Tab <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutAndLegalSection;
