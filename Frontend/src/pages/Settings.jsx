import React from 'react';
import { Settings as SettingsIcon, Bell, Palette, Lock, Sliders } from 'lucide-react';

/**
 * Settings Page (Phase 2 Navigation Placeholder)
 * 
 * Future Phase: User preferences, notifications configuration, security settings.
 */
const Settings = () => {
  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings & Preferences
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize your workspace experience, appearance, and notification rules.
        </p>
      </div>

      {/* Settings Sections Grid */}
      <div className="space-y-4">
        {/* Appearance Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
              <Palette className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Appearance & Theme
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Current theme: Powder Blue + Mint accents with Light and Dark mode options.
              </p>
              <p className="text-xs text-slate-400 mt-2 italic">
                Use the sun/moon button in the top bar to toggle themes anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Notifications Settings Placeholder */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Notifications (Coming Soon)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure browser reminders, upcoming task alerts, and daily morning digests.
              </p>
            </div>
          </div>
        </div>

        {/* Security & Passwords Placeholder */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Account Security & Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Password updates and active session revocation will be introduced in subsequent phases.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
