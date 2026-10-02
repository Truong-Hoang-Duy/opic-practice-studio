import React, { useEffect, useRef, useState } from 'react';
import { Flame, Timer, Zap, CheckCircle2, ArrowRight, EyeOff } from 'lucide-react';
import { dailyApi } from '../api/client';

const WEEKDAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const pad = (n) => String(n).padStart(2, '0');
export const formatCountdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

// Time left until the next challenge, on the server's clock (the day resets at 00:00 Vietnam time)
export const useResetCountdown = (resetsAt, serverNow, onExpire) => {
  const [left, setLeft] = useState(null);
  const expiredRef = useRef(false);
  useEffect(() => {
    if (!resetsAt) return undefined;
    expiredRef.current = false;
    const skew = serverNow ? new Date(serverNow).getTime() - Date.now() : 0;
    const target = new Date(resetsAt).getTime();
    const tick = () => {
      const ms = target - (Date.now() + skew);
      setLeft(ms);
      if (ms <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        if (onExpire) onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetsAt, serverNow]);
  return left;
};

export const WeekDots = ({ days = [] }) => (
  <div className="flex items-center gap-1.5" aria-label="7 ngày gần nhất">
    {days.map((d) => (
      <div key={d.date} className="flex flex-col items-center gap-1">
        <span
          title={d.date}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
            d.done
              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-orange-500/30'
              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
          }`}
        >
          {d.done ? '🔥' : ''}
        </span>
        <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">{WEEKDAYS_VI[new Date(`${d.date}T00:00:00`).getDay()]}</span>
      </div>
    ))}
  </div>
);

export const DailyChallengeCard = ({ onStart }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const load = () => {
    dailyApi.today()
      .then(res => { setData(res.data); setError(false); })
      .catch(err => { console.error('Failed to load daily challenge', err); setError(true); });
  };
  useEffect(load, []);

  const left = useResetCountdown(data?.resets_at, data?.server_now, load);

  if (error) return null;
  if (!data) {
    return <div className="h-44 rounded-3xl glass-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 animate-pulse" />;
  }

  const { workout, streak } = data;
  const done = workout.status === 'completed';

  return (
    <div className="relative overflow-hidden rounded-3xl glass-card border border-amber-300/70 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 via-white to-orange-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30 p-4 sm:p-6 shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Challenge */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-amber-300">
              <Zap className="w-4 h-4" />
              Daily Challenge hôm nay
            </span>
            {/* Question type and topic give the question away: shown only once it is answered */}
            {done && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">[{workout.badge}]</span>}
            {done && workout.topic_label && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {workout.topic_label}
              </span>
            )}
          </div>
          {done ? (
            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug line-clamp-3">
              "{workout.question_text}"
            </p>
          ) : (
            // Not shown before the answer: the learner only hears Eva, as in the real test
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <EyeOff className="w-4 h-4 shrink-0 text-slate-400" />
              Câu hỏi được ẩn - Eva sẽ đọc khi bạn bắt đầu, như thi thật.
            </p>
          )}
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            {workout.from_question_bank && 'Ôn lại từ Question Bank của bạn · '}10s chuẩn bị · nói 60–90s
          </p>
        </div>

        {/* Streak + action */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 lg:min-w-[260px]">
          <div className="flex items-center justify-between sm:justify-start gap-4 flex-1 lg:flex-none">
            <div className="flex items-center gap-2">
              <Flame className={`w-8 h-8 ${streak.current ? 'text-orange-500' : 'text-slate-300 dark:text-slate-600'}`} />
              <div className="leading-tight">
                <div className="text-2xl font-black text-slate-900 dark:text-white">{streak.current}</div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">ngày liên tục · kỷ lục {streak.best}</div>
              </div>
            </div>
            <WeekDots days={streak.last_7_days} />
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-1.5">
            {done ? (
              <button
                onClick={onStart}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md cursor-pointer active:scale-[0.98] transition-transform"
              >
                <CheckCircle2 className="w-4 h-4" />
                Đã hoàn thành{workout.estimated_level ? ` · ${workout.estimated_level}` : ''} - Xem lại
              </button>
            ) : (
              <button
                onClick={onStart}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 cursor-pointer active:scale-[0.98] transition-transform"
              >
                Luyện tập ngay (90s)
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {left != null && (
              <span className="flex items-center justify-center sm:justify-end gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Timer className="w-3.5 h-3.5" />
                Câu mới sau <span className="font-mono font-semibold">{formatCountdown(left)}</span>
                {!done && streak.current > 0 && ' - giữ chuỗi 🔥'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
