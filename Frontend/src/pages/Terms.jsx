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
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-powder-600 dark:hover:text-powder-400 transition mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to StudySync
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-powder-100 dark:bg-powder-900/40 text-powder-700 dark:text-powder-300 mb-3">
            Legal
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Terms & Conditions
          </h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Last Updated: {LAST_UPDATED}</p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 sm:p-10 prose prose-slate dark:prose-invert max-w-none">
          <p className="lead text-slate-600 dark:text-slate-300">
            Welcome to StudySync. By using our platform, you agree to the following Terms & Conditions.
            Please read them carefully before accessing or using the service.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account or otherwise accessing StudySync, you agree to be bound by these
            Terms & Conditions. If you do not agree, do not use the platform.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            StudySync is a productivity and task management platform designed to help users organize
            their academic, professional, and personal goals. Features include task management,
            project organization, and team collaboration tools.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            To access StudySync, you must register with a valid email address and create a password
            that meets our security requirements. You are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activity that occurs under your account</li>
            <li>Providing accurate and up-to-date registration information</li>
            <li>Notifying us immediately of any unauthorized use of your account</li>
          </ul>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to use StudySync to:</p>
          <ul>
            <li>Engage in any unlawful, harmful, or fraudulent activity</li>
            <li>Upload or transmit malware, spam, or any harmful content</li>
            <li>Attempt to gain unauthorized access to the service or its systems</li>
            <li>Violate the privacy or intellectual property rights of others</li>
            <li>Impersonate any person or entity</li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <p>
            All content, branding, and software within StudySync — including the StudySync name,
            logo, and interface design — are the intellectual property of StudySync and its creators.
            You may not copy, reproduce, or distribute this content without explicit written permission.
          </p>
          <p>
            Content you create within StudySync (tasks, notes, projects) remains your property.
            By using the service, you grant StudySync a limited license to process and store this
            content solely for the purpose of providing the service to you.
          </p>

          <h2>6. Privacy</h2>
          <p>
            Your use of StudySync is also governed by our{' '}
            <Link to="/privacy" className="text-powder-600 dark:text-powder-400 hover:underline">
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference.
          </p>

          <h2>7. Service Availability</h2>
          <p>
            StudySync aims to provide continuous service, but does not guarantee uninterrupted or
            error-free access. We reserve the right to modify, suspend, or discontinue the service
            at any time, with or without notice.
          </p>

          <h2>8. Account Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at any time for violation of
            these Terms, without prior notice. You may also delete your account at any time through
            your account settings.
          </p>

          <h2>9. Disclaimer of Warranties</h2>
          <p>
            StudySync is provided "as is" without warranties of any kind, express or implied.
            We do not warrant that the service will be error-free, secure, or meet your requirements.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, StudySync and its developers shall not be liable
            for any indirect, incidental, or consequential damages arising from your use of the platform.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of StudySync after changes
            constitutes acceptance of the updated Terms. We will make reasonable efforts to notify
            users of significant changes via email or in-app notification.
          </p>

          <h2>12. Contact</h2>
          <p>
            If you have questions about these Terms, please contact us at{' '}
            <a href="mailto:support@studysync.app" className="text-powder-600 dark:text-powder-400 hover:underline">
              support@studysync.app
            </a>
          </p>
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
