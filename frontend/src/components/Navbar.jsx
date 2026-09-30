import React from 'react';
import { Headphones, Award, History, BookOpen, LogOut, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const TEST_FLOW_TABS = ['system_check', 'survey', 'self_assessment', 'topic_selection', 'pre_test', 'test'];

export const Navbar = ({ currentTab, setTab, onOpenRubric }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { key: 'dashboard', label: 'Studio Home', shortLabel: 'Home', icon: Award, active: currentTab === 'dashboard', onClick: () => setTab('dashboard') },
    { key: 'test', label: 'Take Test', shortLabel: 'Test', icon: Headphones, active: TEST_FLOW_TABS.includes(currentTab), onClick: () => setTab('system_check') },
    { key: 'history', label: 'History', shortLabel: 'History', icon: History, active: currentTab === 'history', onClick: () => setTab('history') },
    { key: 'rubric', label: 'IH Rubric', shortLabel: 'Rubric', icon: BookOpen, active: false, onClick: onOpenRubric },
  ];

  return (
    <>
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md transition-colors pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">

        {/* Brand Logo */}
        <div
          onClick={() => setTab('dashboard')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
        >
          <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 p-0.5 shadow-lg shadow-sky-500/20 group-hover:shadow-sky-500/40 transition-shadow">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Headphones className="w-5 h-5 text-sky-400" />
            </div>
          </div>
          <div className="min-w-0">
            <span className="block font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white truncate">
              OPIc Practice Studio
            </span>
            <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">Vietnamese Learner Prep Simulation</p>
          </div>
        </div>

        {/* Navigation Tabs (tablet & desktop) */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {navItems.map(({ key, label, icon: Icon, active, onClick }) => (
              <button
                key={key}
                onClick={onClick}
                className={`flex items-center gap-2 px-3 lg:px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${key === 'rubric' && !active ? 'text-emerald-500 dark:text-emerald-400' : ''}`} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Right side: Theme Toggle + User Account / Logout */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all shadow-sm flex items-center justify-center cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 animate-pulse-subtle" />
            ) : (
              <Moon className="w-4 h-4 text-sky-600" />
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user.full_name || user.email}</span>
                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">ACTFL OPIc Simulation</span>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setTab('login')}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Candidate Sign In</span>
              <span className="sm:hidden">Sign In</span>
            </button>
          )}
        </div>

      </div>
    </header>

    {/* Bottom tab bar (phones) */}
    {user && (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 h-16">
          {navItems.map(({ key, shortLabel, icon: Icon, active, onClick }) => (
            <button
              key={key}
              onClick={onClick}
              aria-label={shortLabel}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{shortLabel}</span>
            </button>
          ))}
        </div>
      </nav>
    )}
    </>
  );
};
