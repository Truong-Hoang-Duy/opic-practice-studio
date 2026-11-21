import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationContext = createContext(null);

const TONE_META = {
  success: {
    icon: CheckCircle2,
    stripe: 'from-emerald-500 to-teal-400',
    iconBox: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    border: 'border-emerald-300/80 dark:border-emerald-500/35',
  },
  error: {
    icon: AlertCircle,
    stripe: 'from-rose-500 to-red-500',
    iconBox: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
    border: 'border-rose-300/80 dark:border-rose-500/35',
  },
  warning: {
    icon: AlertTriangle,
    stripe: 'from-amber-400 to-orange-500',
    iconBox: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
    border: 'border-amber-300/80 dark:border-amber-500/35',
  },
  info: {
    icon: Info,
    stripe: 'from-indigo-500 to-sky-500',
    iconBox: 'bg-indigo-500/15 text-indigo-600 dark:text-sky-300',
    border: 'border-indigo-300/80 dark:border-sky-500/35',
  },
};

const CONFIRM_BTN = {
  danger: 'bg-gradient-to-r from-rose-600 to-red-500 hover:brightness-105 text-white shadow-md shadow-rose-500/25',
  warning: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 text-white shadow-md shadow-amber-500/25',
  primary: 'btn-brand-gradient',
};

// Imperative bridge so any helper or component can trigger Studio toasts/confirms cleanly
let _bridge = {
  notify: () => {},
  confirm: async () => false,
};

export const notify = {
  success: (message, title = 'Thành công') => _bridge.notify({ type: 'success', title, message }),
  error: (message, title = 'Đã xảy ra lỗi') => _bridge.notify({ type: 'error', title, message }),
  warning: (message, title = 'Lưu ý') => _bridge.notify({ type: 'warning', title, message }),
  info: (message, title = 'Thông báo') => _bridge.notify({ type: 'info', title, message }),
};

export const confirmDialog = (options) => _bridge.confirm(options);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const dialogResolverRef = useRef(null);
  const idCounterRef = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ type = 'info', title = '', message = '', duration = 4200 }) => {
      if (!message && !title) return;
      const id = idCounterRef.current++;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);
      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const openConfirm = useCallback((options) => {
    const normalized =
      typeof options === 'string'
        ? { title: 'Xác nhận thao tác', message: options }
        : options || {};
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;
      setDialog({
        title: normalized.title || 'Xác nhận thao tác',
        message: normalized.message || '',
        confirmLabel: normalized.confirmLabel || 'Xác nhận',
        cancelLabel: normalized.cancelLabel || 'Hủy',
        tone: normalized.tone || 'primary',
      });
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    const resolver = dialogResolverRef.current;
    dialogResolverRef.current = null;
    setDialog(null);
    if (resolver) resolver(!!result);
  }, []);

  useEffect(() => {
    _bridge = { notify: pushToast, confirm: openConfirm };
  }, [pushToast, openConfirm]);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, closeConfirm]);

  return (
    <NotificationContext.Provider value={{ pushToast, confirm: openConfirm }}>
      {children}

      {/* Studio Floating Toast Stack (Top-Right, Non-blocking) */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[90] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      >
        {toasts.map((t) => {
          const meta = TONE_META[t.type] || TONE_META.info;
          const Icon = meta.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto glass-panel rounded-2xl overflow-hidden border ${meta.border} shadow-2xl shadow-slate-950/20 flex items-stretch animate-in fade-in slide-in-from-top-2 duration-200`}
            >
              <div className={`w-1.5 shrink-0 bg-gradient-to-b ${meta.stripe}`} />
              <div className="flex-1 p-3.5 flex items-start gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBox}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                      {t.title}
                    </p>
                  )}
                  {t.message && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug mt-0.5 break-words">
                      {t.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Đóng thông báo"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Studio Confirm Modal (Replaces native window.confirm everywhere) */}
      {dialog && (
        <div
          className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => closeConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md glass-panel rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700"
          >
            <div
              className={`h-1.5 w-full bg-gradient-to-r ${
                dialog.tone === 'danger'
                  ? 'from-rose-500 to-red-500'
                  : dialog.tone === 'warning'
                    ? 'from-amber-400 to-orange-500'
                    : 'from-indigo-500 via-blue-500 to-sky-400'
              }`}
            />
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    dialog.tone === 'danger'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                      : dialog.tone === 'warning'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                        : 'bg-indigo-500/15 text-indigo-600 dark:text-sky-300'
                  }`}
                >
                  {dialog.tone === 'danger' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : dialog.tone === 'warning' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                    {dialog.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5 whitespace-pre-line">
                    {dialog.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => closeConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  {dialog.cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={() => closeConfirm(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    CONFIRM_BTN[dialog.tone] || CONFIRM_BTN.primary
                  }`}
                >
                  {dialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};
