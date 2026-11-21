import React from 'react';
import {
  Headphones,
  Home,
  BookOpen,
  Mic,
  TrendingUp,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  PanelLeftOpen,
  Languages,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const TEST_FLOW_TABS = ['mock_center', 'system_check', 'survey', 'self_assessment', 'topic_selection', 'pre_test', 'test'];

export const Navbar = ({ currentTab, setTab, collapsed = false, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { lang, setLang, toggleLang, pick } = useLanguage();

  if (!user) return null;

  const THEME_OPTIONS = [
    { key: 'light', label: pick('Sáng', 'Light'), icon: Sun },
    { key: 'dark', label: pick('Tối', 'Dark'), icon: Moon },
    { key: 'auto', label: pick('Tự động', 'Auto'), icon: Monitor },
  ];

  const navItems = [
    { key: 'dashboard', label: pick('Trang chủ', 'Home'), mobileLabel: pick('Trang chủ', 'Home'), icon: Home, active: currentTab === 'dashboard' || currentTab === 'daily' },
    { key: 'library', label: pick('Kho ôn tập', 'Study Hub'), mobileLabel: pick('Ôn tập', 'Study'), icon: BookOpen, active: currentTab === 'library' || currentTab === 'vocabulary' },
    { key: 'mock_center', label: pick('Thi thử', 'Mock Test'), mobileLabel: pick('Thi thử', 'Exam'), icon: Mic, active: TEST_FLOW_TABS.includes(currentTab) },
    { key: 'history', label: pick('Tiến độ', 'Progress'), mobileLabel: pick('Tiến độ', 'Progress'), icon: TrendingUp, active: currentTab === 'history' || currentTab === 'report' },
    { key: 'guide', label: pick('Hướng dẫn', 'Guide'), mobileLabel: pick('Hướng dẫn', 'Guide'), icon: HelpCircle, active: currentTab === 'guide' },
  ];

  const isDarkTheme = theme === 'dark';
  const MobileThemeIcon = isDarkTheme ? Moon : Sun;
  const mobileThemeLabel = isDarkTheme ? pick('Tối', 'Dark') : pick('Sáng', 'Light');
  const toggleMobileLightDark = () => setThemeMode(isDarkTheme ? 'light' : 'dark');
  const displayName = user.full_name || user.email || 'OPIc Candidate';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'OP';

  return (
    <>
      {/* Desktop Left Dark-Studio Sidebar (Collapsible with Edge Toggle Badge) */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 studio-surface border-y-0 border-l-0 border-r border-slate-800/80 flex-col justify-between px-4 py-5 select-none shadow-2xl shadow-slate-950/30 transition-transform duration-200 ${
          collapsed ? '-translate-x-full pointer-events-none' : 'translate-x-0'
        }`}
      >
        {/* Collapse Sidebar Badge protruding cleanly on the right edge */}
        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={pick('Đóng thanh bên', 'Collapse sidebar')}
            aria-label={pick('Đóng thanh bên', 'Collapse sidebar')}
            className="absolute top-6 -right-3.5 z-50 w-7 h-7 rounded-full bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-sky-300 hover:text-indigo-600 dark:hover:text-white hover:border-indigo-400 shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex flex-col gap-7">
          {/* Brand Emblem */}
          <button
            type="button"
            onClick={() => setTab('dashboard')}
            className="flex items-center gap-3 text-left px-1.5 py-1 rounded-2xl hover:bg-white/[0.04] transition-colors cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-teal-400 p-[2px] shadow-lg shadow-indigo-500/30 shrink-0 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0b1120] rounded-[10px] flex items-center justify-center">
                <Headphones className="w-5 h-5 text-sky-300" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="block font-display font-extrabold text-[15px] text-white tracking-tight truncate">
                OPIc Studio
              </span>
              <span className="block text-[11px] font-medium text-sky-300/80 truncate">
                {pick('Luyện nói cùng Eva AI', 'Speak with Eva AI')}
              </span>
            </div>
          </button>

          {/* 4 Clean Navigation Items */}
          <nav className="flex flex-col gap-1.5" aria-label={pick('Điều hướng chính', 'Main navigation')}>
            {navItems.map(({ key, label, icon: Icon, active }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer group ${
                  active
                    ? 'bg-gradient-to-r from-indigo-500/90 via-blue-500/85 to-sky-500/85 text-white shadow-lg shadow-indigo-600/30 border border-white/15'
                    : 'text-slate-300/90 hover:text-white hover:bg-white/[0.07] border border-transparent'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-teal-300 shadow-[0_0_8px_rgba(94,234,212,0.85)]" />
                )}
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 transition-transform group-hover:scale-105 ${
                    active ? 'text-white' : 'text-slate-400 group-hover:text-sky-300'
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar Bottom: VI/EN Language Switcher + 3-Way Theme Pill + User Profile Card */}
        <div className="flex flex-col gap-2.5 pt-4 border-t border-white/10">
          {/* Language Mode Switcher (Tiếng Việt / English) */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950/50 border border-white/10" role="group" aria-label={pick('Ngôn ngữ hiển thị', 'Display language')}>
            {[
              { key: 'vi', label: 'Tiếng Việt' },
              { key: 'en', label: 'English' },
            ].map((opt) => {
              const active = lang === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLang(opt.key)}
                  className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950/50 border border-white/10">
            {THEME_OPTIONS.map(({ key, label, icon: Icon }) => {
              const isSelected = themeMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setThemeMode(key)}
                  className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2.5 px-2 py-2 rounded-xl bg-white/[0.05] border border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 shadow-sm">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-100 truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title={pick('Đăng xuất', 'Sign out')}
              aria-label={pick('Đăng xuất', 'Sign out')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] leading-snug text-slate-500 px-1 text-center">
            {pick('Công cụ độc lập · Không trực thuộc ACTFL/LTI', 'Independent tool · Not affiliated with ACTFL/LTI')}
          </p>
        </div>
      </aside>

      {/* Desktop Re-Open Sidebar Dock Badge (visible only when sidebar is collapsed) */}
      {onToggleCollapse && collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          title={pick('Mở thanh bên', 'Expand sidebar')}
          aria-label={pick('Mở thanh bên', 'Expand sidebar')}
          className="hidden lg:inline-flex fixed left-0 top-4 z-40 items-center justify-center pl-2 pr-2.5 py-2.5 rounded-r-2xl studio-surface border-l-0 text-sky-300 hover:text-white hover:pl-3 shadow-lg shadow-indigo-950/30 transition-all cursor-pointer group"
        >
          <PanelLeftOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Mobile & Tablet Slim Top Bar (Optimized for iPhone 11 414px width!) */}
      <header className="lg:hidden sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0b1120]/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="px-3.5 h-14 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setTab('dashboard')}
            className="flex items-center gap-2 cursor-pointer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-teal-400 p-[2px] shrink-0 shadow-sm">
              <div className="w-full h-full bg-[#0b1120] rounded-[9px] flex items-center justify-center">
                <Headphones className="w-4 h-4 text-sky-300" />
              </div>
            </div>
            <span className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight truncate">
              OPIc Studio
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={pick('Chuyển sang Tiếng Anh', 'Switch to Vietnamese')}
              title={pick('Đổi ngôn ngữ hiển thị (VI / EN)', 'Switch display language (VI / EN)')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-500/35 text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
            >
              <Languages className="w-3.5 h-3.5 shrink-0" />
              <span>{lang.toUpperCase()}</span>
            </button>
            <button
              type="button"
              onClick={toggleMobileLightDark}
              aria-label={isDarkTheme ? pick('Chuyển sang chế độ sáng', 'Switch to light mode') : pick('Chuyển sang chế độ tối', 'Switch to dark mode')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-slate-800/80 text-indigo-700 dark:text-sky-300 border border-indigo-200/80 dark:border-slate-700 text-[11px] font-bold cursor-pointer whitespace-nowrap"
            >
              <MobileThemeIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{mobileThemeLabel}</span>
            </button>
            <button
              type="button"
              onClick={logout}
              title={pick('Đăng xuất', 'Sign out')}
              aria-label={pick('Đăng xuất', 'Sign out')}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Bottom 5-Tab Bar (Crisp non-wrapping layout on iPhone 11 414px!) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-6px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-5 h-16">
          {navItems.map(({ key, label, mobileLabel, icon: Icon, active }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1 px-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                active
                  ? 'text-indigo-600 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {active && (
                <span className="absolute top-0 w-7 h-0.5 rounded-b-full bg-gradient-to-r from-indigo-500 to-sky-400" />
              )}
              <Icon className="w-[19px] h-[19px] shrink-0" />
              <span className="whitespace-nowrap leading-tight">{mobileLabel || label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};
