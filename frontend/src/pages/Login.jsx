import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Headphones, Mail, Lock, ArrowRight, ShieldCheck, Sun, Moon, Languages } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export const Login = ({ onLoginSuccess }) => {
  const { login, register, defaultLogin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, pick } = useLanguage();

  // Default candidate credentials pre-assigned
  const [email, setEmail] = useState('candidate@opicstudio.com');
  const [password, setPassword] = useState('OpicStudio@2026!IH');
  const [fullName, setFullName] = useState('OPIc Candidate');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (!email || !password) throw new Error(pick('Email và mật khẩu là bắt buộc.', 'Email and password are required.'));
        await register(email, password, fullName || undefined);
      } else {
        // Standard or default login
        if (email === 'candidate@opicstudio.com' && password === 'OpicStudio@2026!IH') {
          await defaultLogin();
        } else {
          await login(email, password);
        }
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || pick('Đăng nhập không thành công.', 'Sign-in failed.'));
    } finally {
      setLoading(false);
    }
  };

  // Allow pressing Enter anywhere on the page to log in immediately
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !loading && !isRegisterMode) {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, isRegisterMode, email, password]);

  return (
    // Full-screen, no header/footer: the card is sized to fit one screen at every size (no page scroll)
    <div className="relative h-dvh w-full overflow-y-auto flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-height:720px)]:pt-[max(0.5rem,env(safe-area-inset-top))] [@media(max-height:720px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleLang}
          title={pick('Chuyển sang Tiếng Anh', 'Switch to Vietnamese')}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/85 dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{lang.toUpperCase()}</span>
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? pick('Giao diện sáng', 'Light mode') : pick('Giao diện tối', 'Dark mode')}
          aria-label={pick('Đổi giao diện sáng / tối', 'Toggle light / dark theme')}
          className="p-2 rounded-xl bg-white/85 dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-600" />}
        </button>
      </div>

      <div className="w-full max-w-md glass-card bg-white dark:bg-slate-900/95 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl p-6 sm:p-8 [@media(max-height:720px)]:p-5 [@media(max-height:560px)]:py-4 flex flex-col [@media(max-height:500px)_and_(min-width:560px)]:max-w-3xl [@media(max-height:500px)_and_(min-width:560px)]:grid [@media(max-height:500px)_and_(min-width:560px)]:grid-cols-[1fr_1.3fr] [@media(max-height:500px)_and_(min-width:560px)]:gap-x-6 [@media(max-height:500px)_and_(min-width:560px)]:items-center [@media(max-height:500px)_and_(min-width:560px)]:py-3 [@media(max-height:340px)]:!py-2 transition-colors">

        {/* Logo & Headline */}
        <div className="text-center mb-5 [@media(max-height:720px)]:mb-3 [@media(max-height:500px)_and_(min-width:560px)]:mb-0 [@media(max-height:500px)_and_(min-width:560px)]:col-start-1 [@media(max-height:500px)_and_(min-width:560px)]:row-start-1">
          <div className="inline-flex w-14 h-14 [@media(max-height:720px)]:w-11 [@media(max-height:720px)]:h-11 [@media(max-height:560px)_and_(max-width:559px)]:hidden rounded-2xl bg-gradient-to-tr from-sky-500 to-emerald-400 p-0.5 shadow-xl shadow-sky-500/20 mb-3 [@media(max-height:720px)]:mb-2">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Headphones className="w-7 h-7 [@media(max-height:720px)]:w-5 [@media(max-height:720px)]:h-5 text-sky-400" />
            </div>
          </div>
          <h1 className="text-2xl [@media(max-height:720px)]:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">OPIc Practice Studio</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 [@media(max-height:720px)]:mt-1 [@media(max-height:560px)_and_(max-width:559px)]:hidden font-medium">
            {pick('Luyện thi OPIc chuyên sâu • Đánh giá chuẩn ', 'Intensive OPIc speaking prep • Graded by ')}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">ACTFL OPIc</span>
          </p>
        </div>

        {/* Form Credentials (Pre-filled) */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 [@media(max-height:720px)]:gap-3 [@media(max-height:500px)_and_(min-width:560px)]:gap-2 [@media(max-height:340px)]:!gap-1.5 [@media(max-height:500px)_and_(min-width:560px)]:col-start-2 [@media(max-height:500px)_and_(min-width:560px)]:row-start-1 [@media(max-height:500px)_and_(min-width:560px)]:row-span-2">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {pick('Họ và tên thí sinh', 'Candidate full name')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyen Van A"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 [@media(max-height:720px)]:py-2 [@media(max-height:500px)_and_(min-width:560px)]:py-1.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 [@media(max-height:500px)_and_(min-width:560px)]:mb-1">
              <label className="block shrink-0 whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-300">
                {pick('Email thí sinh', 'Candidate email')}
              </label>
              <span className="min-w-0 truncate text-right text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {pick('Mặc định:', 'Default:')} candidate@opicstudio.com
              </span>
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="candidate@opicstudio.com"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 [@media(max-height:720px)]:py-2 [@media(max-height:500px)_and_(min-width:560px)]:py-1.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 [@media(max-height:500px)_and_(min-width:560px)]:mb-1">
              <label className="block shrink-0 whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-300">
                {pick('Mật khẩu', 'Password')}
              </label>
              <span className="min-w-0 truncate text-right text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {pick('Mặc định:', 'Default:')} OpicStudio@2026!IH
              </span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 [@media(max-height:720px)]:py-2 [@media(max-height:500px)_and_(min-width:560px)]:py-1.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs mt-1">
            <button
              type="button"
              onClick={() => {
                if (isRegisterMode) {
                  setIsRegisterMode(false);
                  setEmail('candidate@opicstudio.com');
                  setPassword('OpicStudio@2026!IH');
                } else {
                  setIsRegisterMode(true);
                  setEmail('');
                  setPassword('');
                }
              }}
              className="text-brand-600 dark:text-brand-400 font-medium hover:underline cursor-pointer"
            >
              {isRegisterMode
                ? pick('← Quay lại tài khoản mặc định', '← Back to default account')
                : pick('Tạo tài khoản cá nhân mới', 'Create personal account')}
            </button>

            <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {pick('Nhấn ↵ Enter để vào', 'Press ↵ Enter to continue')}
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            autoFocus
            className="w-full mt-1 [@media(max-height:720px)]:mt-0 py-3 [@media(max-height:720px)]:py-2.5 [@media(max-height:340px)]:!py-2 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-bold text-sm shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span>
              {loading
                ? pick('Đang vào studio...', 'Entering studio...')
                : isRegisterMode
                  ? pick('Đăng ký & Bắt đầu', 'Sign Up & Start')
                  : pick('Đăng nhập & Bắt đầu', 'Sign In & Start')}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>

        </form>

        {/* Replaces the footer on this screen: keeps the ACTFL/LTI non-affiliation notice */}
        <div className="mt-5 pt-3 [@media(max-height:720px)]:mt-3 [@media(max-height:720px)]:pt-2 [@media(max-height:500px)_and_(min-width:560px)]:col-start-1 [@media(max-height:500px)_and_(min-width:560px)]:row-start-2 [@media(max-height:500px)_and_(min-width:560px)]:self-start [@media(max-height:500px)_and_(min-width:560px)]:mt-2 border-t border-slate-200 dark:border-slate-800 flex items-start sm:items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            {pick(
              'Công cụ luyện thi độc lập · Không liên kết với ACTFL hay LTI',
              'Independent prep tool · Not affiliated with ACTFL or LTI'
            )}
          </span>
        </div>

      </div>
    </div>
  );
};
