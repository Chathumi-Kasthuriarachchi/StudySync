import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  Globe,
  Mail,
  Bell,
  Shield,
  HelpCircle,
  BookOpen,
  AlertTriangle,
  Check,
  Info,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { updateUserPreferences } from '../services/userService';

// Tab Section Components
import ChangePasswordCard from '../components/settings/ChangePasswordCard';
import ActiveSessionsCard from '../components/settings/ActiveSessionsCard';
import HelpAndSupportSection from '../components/settings/HelpAndSupportSection';
import AboutAndLegalSection from '../components/settings/AboutAndLegalSection';
import DangerZoneCard from '../components/settings/DangerZoneCard';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English (United States)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
];

const SETTINGS_TABS = [
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Palette,
    badge: null,
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    badge: null,
  },
  {
    id: 'help',
    label: 'Help & Support',
    icon: HelpCircle,
    badge: null,
  },
  {
    id: 'about',
    label: 'About & Legal',
    icon: BookOpen,
    badge: null,
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: AlertTriangle,
    isDanger: true,
  },
];

/**
 * Settings Page (Phase 2)
 * 
 * Comprehensive settings dashboard organized into 5 primary sections:
 * 1. Preferences (Theme, Language, Email Notifications)
 * 2. Security (Change Password, Active Sessions & Logout All Devices)
 * 3. Help & Support (Quick Topics, Categorized FAQs, Contact Support Form)
 * 4. About & Legal (Platform Info v1.0.0, Tech Stack, Terms & Privacy modals)
 * 5. Danger Zone (Permanent Account Deletion with cascading cleanup)
 */
const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const validTabIds = SETTINGS_TABS.map((t) => t.id);
  const activeTab = validTabIds.includes(rawTab) ? rawTab : 'preferences';

  const { theme, setTheme } = useTheme();
  const { user, updateUser } = useAuth();

  const [language, setLanguage] = useState(
    () => user?.preferences?.language || 'en'
  );

  const [emailNotifications, setEmailNotifications] = useState(
    () => user?.preferences?.emailNotifications ?? true
  );

  const [isUpdatingLang, setIsUpdatingLang] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  // ── Theme Selection ──────────────────────────────────────────────────────────
  const handleThemeSelect = async (selectedTheme) => {
    if (selectedTheme === theme) return;
    try {
      await setTheme(selectedTheme, true);
      toast.success(
        `Theme set to ${selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)}.`
      );
    } catch (err) {
      console.error('Failed to change theme:', err);
      toast.error('Failed to update theme preference.');
    }
  };

  // ── Language Selection ───────────────────────────────────────────────────────
  const handleLanguageChange = async (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);

    try {
      setIsUpdatingLang(true);
      const res = await updateUserPreferences({ language: newLang });
      if (res.success && updateUser) {
        updateUser(res.data.user || {
          preferences: {
            ...(user?.preferences || {}),
            language: newLang,
          },
        });
        toast.success('Language preference updated.');
      }
    } catch (err) {
      console.error('Failed to update language:', err);
      toast.error('Failed to save language preference.');
    } finally {
      setIsUpdatingLang(false);
    }
  };

  // ── Email Notifications Toggle ──────────────────────────────────────────────
  const handleToggleEmailNotifications = async () => {
    const nextVal = !emailNotifications;
    setEmailNotifications(nextVal);

    try {
      setIsUpdatingEmail(true);
      const res = await updateUserPreferences({ emailNotifications: nextVal });
      if (res.success && updateUser) {
        updateUser(res.data.user || {
          preferences: {
            ...(user?.preferences || {}),
            emailNotifications: nextVal,
          },
        });
        toast.success(
          nextVal ? 'Email notifications enabled.' : 'Email notifications disabled.'
        );
      }
    } catch (err) {
      console.error('Failed to update email notification preference:', err);
      // Revert local state on failure
      setEmailNotifications(!nextVal);
      toast.error('Failed to update email notification setting.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const themeOptions = [
    {
      id: 'light',
      title: 'Light',
      description: 'Clean and crisp light appearance',
      icon: Sun,
    },
    {
      id: 'dark',
      title: 'Dark',
      description: 'Reduced eye strain with sleek dark surfaces',
      icon: Moon,
    },
    {
      id: 'system',
      title: 'System',
      description: 'Automatically synchronizes with your device settings',
      icon: Laptop,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings &amp; Preferences
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize your appearance, manage credentials and active sessions, access help, and review policies.
        </p>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          let tabStyle = 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent';
          if (isActive) {
            tabStyle = tab.isDanger
              ? 'text-red-600 dark:text-red-400 border-red-500 font-bold'
              : 'text-powder-600 dark:text-powder-400 border-powder-500 font-bold';
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer -mb-px ${tabStyle}`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive
                    ? tab.isDanger
                      ? 'text-red-500'
                      : 'text-powder-500'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: PREFERENCES ──────────────────────────────────────────────── */}
      {activeTab === 'preferences' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 1. Appearance & Theme */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Appearance &amp; Theme
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your preferred theme mode for StudySync across all devices.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleThemeSelect(opt.id)}
                    className={`relative p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-powder-500 dark:border-powder-400 bg-powder-50/50 dark:bg-powder-950/30 ring-2 ring-powder-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`p-2 rounded-xl ${
                          isSelected
                            ? 'bg-powder-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-powder-500 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {opt.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Language Preference */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Language &amp; Region
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Set your primary language for buttons, labels, and notifications.
                </p>
              </div>
            </div>

            <div className="max-w-md space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Interface Language
              </label>
              <div className="relative">
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  disabled={isUpdatingLang}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition cursor-pointer disabled:opacity-50"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                {isUpdatingLang && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-powder-500" />
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 shrink-0 text-powder-500" />
                Additional languages will be made available in future releases.
              </p>
            </div>
          </div>

          {/* 3. Email Notification Preference */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Email Notifications
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Control whether StudySync sends optional notification and activity emails.
                  </p>

                  <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 max-w-xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                    <Bell className="w-4 h-4 text-powder-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>In-app notifications continue automatically:</strong> The notification bell in your top navigation bar will always alert you to mentions, invitations, and due dates regardless of this setting.
                    </span>
                  </div>
                </div>
              </div>

              <div className="self-end sm:self-center shrink-0 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {emailNotifications ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailNotifications}
                  onClick={handleToggleEmailNotifications}
                  disabled={isUpdatingEmail}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-powder-500 disabled:opacity-50 ${
                    emailNotifications ? 'bg-mint-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      emailNotifications ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SECURITY ─────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Change Password Card */}
          <ChangePasswordCard />

          {/* Active Sessions Card */}
          <ActiveSessionsCard />
        </div>
      )}

      {/* ── TAB 3: HELP & SUPPORT ───────────────────────────────────────────── */}
      {activeTab === 'help' && (
        <div className="animate-fadeIn">
          <HelpAndSupportSection />
        </div>
      )}

      {/* ── TAB 4: ABOUT & LEGAL ────────────────────────────────────────────── */}
      {activeTab === 'about' && (
        <div className="animate-fadeIn">
          <AboutAndLegalSection />
        </div>
      )}

      {/* ── TAB 5: DANGER ZONE ──────────────────────────────────────────────── */}
      {activeTab === 'danger' && (
        <div className="animate-fadeIn">
          <DangerZoneCard />
        </div>
      )}
    </div>
  );
};

export default Settings;
