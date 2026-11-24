import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Privacy Policy Page
 * Route: /privacy (Public)
 */
const Privacy = () => {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">Last Updated: {LAST_UPDATED}</p>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 sm:p-10 text-slate-700 dark:text-slate-300">
          <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            At StudySync, we value your privacy and keep your personal data protected.
            This Privacy Policy outlines how we collect, store, handle and protect your information
            whenever you access the platform.
          </p>

          {/* Section 1 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">1. Information We Collect</h2>
            
            <h3 className="text-sm font-bold uppercase tracking-wider text-powder-600 dark:text-powder-400 mb-3">
              Information You Provide
            </h3>
            <ul className="space-y-2.5 text-sm mb-6">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Account information:</strong> Full name, verified email address and encrypted password created during registration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Profile details:</strong> Optional profile picture and custom display name</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Workspace content:</strong> Tasks, study goals, timetable entries and notes you create</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Support inquiries:</strong> Messages and questions submitted directly to our support team</span>
              </li>
            </ul>

            <h3 className="text-sm font-bold uppercase tracking-wider text-powder-600 dark:text-powder-400 mb-3">
              Information Collected Automatically
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Usage records:</strong> Feature visits, navigation paths and workflow activity</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Device data:</strong> Browser family, operating system and general technical parameters</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">IP address:</strong> Recorded strictly for rate limits, session validation and security monitoring</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Session tokens:</strong> Encrypted identifiers used to verify valid user sessions</span>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">2. How We Use Your Information</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Provide core functionality:</strong> Deliver task boards, focus tracking timers and collaborative workspaces</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Identity verification:</strong> Confirm identity during sign in and protect account integrity</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">System notifications:</strong> Send verification codes and password reset instructions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Performance enhancements:</strong> Optimize page speed, platform responsiveness and stability</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Threat prevention:</strong> Detect and mitigate unauthorized intrusions, abuse or fraudulent actions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Legal compliance:</strong> Meet applicable statutory and regulatory requirements</span>
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">3. Data Storage and Security</h2>
            <p className="text-sm leading-relaxed mb-4">
              Your data is hosted on secure cloud infrastructure through MongoDB Atlas.
              We implement industry standard protection measures:
            </p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Password protection:</strong> Hashed using salted bcrypt algorithms and never stored in plain text</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Access tokens:</strong> Short lived JWT tokens expiring every 15 minutes to reduce exposure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Refresh security:</strong> Saved as SHA-256 hashes so the raw token is never written to disk</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Verification codes:</strong> Encrypted before storage and deleted immediately upon expiration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Transport encryption:</strong> Mandatory HTTPS encryption across all client and API traffic</span>
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">4. Data Sharing and Third Parties</h2>
            <p className="text-sm leading-relaxed mb-4">
              We never sell your personal information. Information is shared only under specific circumstances:
            </p>
            <ul className="space-y-2.5 text-sm mb-4">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Email dispatchers:</strong> Transactional providers (such as Resend) used strictly to deliver verification codes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Legal authorities:</strong> Disclosed only when formally mandated by law or necessary to protect user safety</span>
              </li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              We do not share your personal records with external advertisers or commercial data brokers.
            </p>
          </div>

          {/* Section 5 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">5. Cookies and Local Storage</h2>
            <ul className="space-y-2.5 text-sm mb-4">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">HttpOnly cookies:</strong> Hold refresh tokens securely away from client side scripts and clear upon logout</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Local storage:</strong> Stores temporary access tokens and your selected theme appearance</span>
              </li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              StudySync does not use cross site tracking cookies or behavioral marketing beacons.
            </p>
          </div>

          {/* Section 6 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">6. Retention and Account Deletion</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Active accounts:</strong> Your data remains retained while your account stays open</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Automated expiry:</strong> Stale sessions clear via database TTL indexes while verification codes expire in 5 minutes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-powder-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Account deletion:</strong> Deleting your account permanently cleans all personal information within 30 days</span>
              </li>
            </ul>
          </div>

          {/* Section 7 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">7. Your Privacy Rights</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Data access:</strong> Inspect the personal information connected to your profile</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Corrections:</strong> Correct inaccurate profile and account information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Permanent erasure:</strong> Request complete deletion of your account and saved data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Data portability:</strong> Export your task records and project data whenever needed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-500 mt-2 shrink-0"></span>
                <span><strong className="text-slate-900 dark:text-white">Revoke consent:</strong> Delete your profile at any time to withdraw platform consent</span>
              </li>
            </ul>
          </div>

          {/* Section 8 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">8. Children's Privacy</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Age requirement:</strong> StudySync is intended for individuals aged 13 and older.
              We do not knowingly collect personal information from children. If an account belonging to a minor under 13 is identified,
              it will be removed promptly along with associated data.
            </p>
          </div>

          {/* Section 9 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">9. Third Party Links</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">External sites:</strong> StudySync may provide links to external websites.
              We do not oversee or control the privacy practices of external platforms and recommend reviewing their respective privacy policies.
            </p>
          </div>

          {/* Section 10 */}
          <div className="pb-8 mb-8 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">10. Policy Updates</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Periodic revisions:</strong> We may revise this Privacy Policy periodically.
              Substantial adjustments will be communicated through email or announcements on the dashboard. Continued participation after updates
              represents acceptance of revised terms.
            </p>
          </div>

          {/* Section 11 */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">11. Contact Us</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Reach our privacy team:</strong> For questions about this policy or to exercise your data rights,
              contact us at{' '}
              <a href="mailto:privacy@studysync.app" className="text-powder-600 dark:text-powder-400 hover:underline font-medium">
                privacy@studysync.app
              </a>
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
          <Link to="/terms" className="hover:text-powder-600 dark:hover:text-powder-400 transition">Terms & Conditions</Link>
          <span>·</span>
          <Link to="/login" className="hover:text-powder-600 dark:hover:text-powder-400 transition">Sign In</Link>
          <span>·</span>
          <Link to="/" className="hover:text-powder-600 dark:hover:text-powder-400 transition">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
