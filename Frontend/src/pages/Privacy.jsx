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
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-powder-600 dark:hover:text-powder-400 transition mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to StudySync
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-mint-100 dark:bg-mint-900/40 text-mint-700 dark:text-mint-300 mb-3">
            Legal
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Last Updated: {LAST_UPDATED}</p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 sm:p-10 prose prose-slate dark:prose-invert max-w-none">
          <p className="lead text-slate-600 dark:text-slate-300">
            At StudySync, we are committed to protecting your privacy and personal data.
            This Privacy Policy explains how we collect, use, store, and protect your information
            when you use our platform.
          </p>

          <h2>1. Information We Collect</h2>
          <h3>Information You Provide</h3>
          <ul>
            <li><strong>Account information</strong>: Name, email address, and password when you register</li>
            <li><strong>Profile information</strong>: Optional profile picture and display name</li>
            <li><strong>Content data</strong>: Tasks, projects, notes, and other content you create</li>
            <li><strong>Communications</strong>: Messages you send to our support team</li>
          </ul>

          <h3>Information Collected Automatically</h3>
          <ul>
            <li><strong>Usage data</strong>: Pages visited, features used, and interactions within the platform</li>
            <li><strong>Device information</strong>: Browser type, operating system, and user agent string</li>
            <li><strong>IP address</strong>: Used for security monitoring and rate limiting</li>
            <li><strong>Session data</strong>: Authentication tokens and session identifiers</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and operate the StudySync service</li>
            <li>Authenticate your identity and maintain account security</li>
            <li>Send account-related emails (verification codes, password resets)</li>
            <li>Improve and personalize the platform experience</li>
            <li>Detect and prevent fraud, abuse, and security threats</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>3. Data Storage and Security</h2>
          <p>
            Your data is stored in MongoDB Atlas on cloud infrastructure. We implement the following
            security measures:
          </p>
          <ul>
            <li>Passwords are hashed using bcrypt (cost factor 12) — never stored in plain text</li>
            <li>Authentication tokens use industry-standard JWT with short expiry (15 minutes)</li>
            <li>Refresh tokens are stored as SHA-256 hashes — the raw token is never persisted</li>
            <li>OTP verification codes are bcrypt-hashed before storage</li>
            <li>All data transmission uses HTTPS encryption in production</li>
          </ul>

          <h2>4. Data Sharing</h2>
          <p>
            We do not sell your personal data. We may share your information with:
          </p>
          <ul>
            <li><strong>Service providers</strong>: Email delivery services (Resend) used solely to send verification emails</li>
            <li><strong>Legal authorities</strong>: When required by law or to protect the rights and safety of users</li>
          </ul>
          <p>
            We do not share your personal data with third parties for advertising or marketing purposes.
          </p>

          <h2>5. Cookies and Local Storage</h2>
          <p>StudySync uses the following browser storage mechanisms:</p>
          <ul>
            <li>
              <strong>HttpOnly Cookies</strong>: Used to store refresh tokens. These are not accessible
              to JavaScript and are cleared on logout.
            </li>
            <li>
              <strong>localStorage</strong>: Used to store your short-lived access token and theme preferences.
            </li>
          </ul>
          <p>
            We do not use third-party tracking cookies or advertising cookies.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. Expired authentication sessions
            are automatically deleted via database TTL indexes. OTP records expire after 5 minutes.
            When you delete your account, your personal data is permanently removed within 30 days.
          </p>

          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate personal data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Export your task and project data</li>
            <li>Withdraw consent at any time by deleting your account</li>
          </ul>

          <h2>8. Children's Privacy</h2>
          <p>
            StudySync is not intended for users under the age of 13. We do not knowingly collect
            personal data from children. If we become aware of such collection, we will promptly
            delete the account and associated data.
          </p>

          <h2>9. Third-Party Links</h2>
          <p>
            StudySync may contain links to external websites. We are not responsible for the privacy
            practices of third-party sites. We encourage you to review their privacy policies.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. We will notify you of significant changes
            by email or via in-app notification. Continued use of StudySync after changes constitutes
            acceptance of the updated policy.
          </p>

          <h2>11. Contact</h2>
          <p>
            If you have questions or concerns about this Privacy Policy or wish to exercise your
            data rights, please contact us at:{' '}
            <a href="mailto:privacy@studysync.app" className="text-powder-600 dark:text-powder-400 hover:underline">
              privacy@studysync.app
            </a>
          </p>
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
