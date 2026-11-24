import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Terms & Conditions Page
 * Route: /terms (Public)
 */
const Terms = () => {
  const LAST_UPDATED = 'September 8, 2026';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-powder-600 dark:hover:text-powder-400 transition mb-6"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to StudySync
          </Link>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Terms & Conditions
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">Last Updated: {LAST_UPDATED}</p>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 sm:p-10 text-slate-700 dark:text-slate-300">
          <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            Welcome to StudySync. By creating an account or accessing our services, you agree to these Terms and Conditions.
            Please review them carefully before using the platform.
          </p>

          {/* Section 1 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Binding agreement:</strong> Accessing or registering for StudySync constitutes full agreement to these terms.
              If you disagree with any portion of these conditions, you must discontinue using the platform immediately.
            </p>
          </div>

          {/* Section 2 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">2. Description of Service</h2>
            <p className="text-sm leading-relaxed mb-4">
              <strong className="text-slate-900 dark:text-white">Platform purpose:</strong> StudySync provides task planning, goal setting and study workflow tools designed to help learners organize coursework and manage deadlines.
            </p>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Core capabilities include customizable Kanban boards, Pomodoro study intervals, calendar schedules and peer collaboration channels.
            </p>
          </div>

          {/* Section 3 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">3. User Accounts</h2>
            <p className="text-sm leading-relaxed mb-4">
              You must register with a genuine email address and configure a secure password. You remain responsible for:
            </p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Credential confidentiality:</strong> Safeguarding your account password and security tokens from unauthorized access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Account actions:</strong> All activities, modifications and communications carried out through your profile</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Information accuracy:</strong> Providing genuine and up to date registration details</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Security alerts:</strong> Contacting our team promptly upon detecting any unauthorized login or security breach</span>
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">4. Acceptable Use Policy</h2>
            <p className="text-sm leading-relaxed mb-4">You agree not to use StudySync to:</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Unlawful activity:</strong> Conduct unlawful, fraudulent or deceptive practices</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Harmful files:</strong> Upload or transmit malware, viruses, spam or malicious software</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">System interference:</strong> Probe, test vulnerabilities or bypass platform authentication</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Rights infringement:</strong> Violate intellectual property rights or individual privacy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Impersonation:</strong> Misrepresent credentials or impersonate any individual or entity</span>
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">5. Intellectual Property</h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                <strong className="text-slate-900 dark:text-white">Platform ownership:</strong> All brand identities, user interfaces, code bases and visual designs in StudySync are the intellectual property of StudySync and its creators. Unauthorized copying, distribution or modification is prohibited.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">User created content:</strong> Coursework, notes and tasks you compose remain entirely your property. You grant StudySync a limited operational license strictly to display, store and synchronize your materials across your devices.
              </p>
            </div>
          </div>

          {/* Section 6 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">6. Privacy Policy Reference</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Privacy standards:</strong> Platform usage is also governed by our{' '}
              <Link to="/privacy" className="text-powder-600 dark:text-powder-400 hover:underline font-medium">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference.
            </p>
          </div>

          {/* Section 7 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">7. Service Availability</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Uptime commitments:</strong> While we target reliable continuous availability, uninterrupted or defect free operation cannot be guaranteed. We reserve the right to deploy updates, perform maintenance or modify features with reasonable notice where practical.
            </p>
          </div>

          {/* Section 8 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">8. Account Suspension and Deletion</h2>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                <strong className="text-slate-900 dark:text-white">Platform termination:</strong> We retain authority to suspend or close profiles that breach these Terms without advance notice.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">Voluntary closure:</strong> You may close your profile and request data removal at any time through your account settings.
              </p>
            </div>
          </div>

          {/* Section 9 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">As is provision:</strong> StudySync is provided on an as is and as available basis without warranties of any kind, whether express or implied. We make no guarantees that platform operations will completely satisfy every individual requirement.
            </p>
          </div>

          {/* Section 10 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">10. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Liability limits:</strong> To the maximum extent permitted by applicable law, StudySync and its operators bear no liability for indirect, incidental or consequential damages connected with platform usage.
            </p>
          </div>

          {/* Section 11 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">11. Revisions to Terms</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Periodic adjustments:</strong> We may update these Terms periodically. Substantive adjustments will be announced through email alerts or dashboard notifications. Continued platform activity represents consent to the updated Terms.
            </p>
          </div>

          {/* Section 12 */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">12. Contact Information</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Support inquiries:</strong> If you have questions regarding these Terms, contact our team at{' '}
              <a href="mailto:support@studysync.app" className="text-powder-600 dark:text-powder-400 hover:underline font-medium">
                support@studysync.app
              </a>
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
          <Link to="/privacy" className="hover:text-powder-600 dark:hover:text-powder-400 transition">Privacy Policy</Link>
          <span>·</span>
          <Link to="/login" className="hover:text-powder-600 dark:hover:text-powder-400 transition">Sign In</Link>
          <span>·</span>
          <Link to="/" className="hover:text-powder-600 dark:hover:text-powder-400 transition">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default Terms;
