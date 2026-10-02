import React, { useEffect, useState } from 'react';
import { Flame, ChevronDown, ChevronRight, Loader2, Zap, Calendar, EyeOff, ArrowRight, Trophy } from 'lucide-react';
import { dailyApi, resolveMediaUrl } from '../api/client';
import { WeekDots } from './DailyChallengeCard';
import { QuickFeedback, VerdictBadge } from '../pages/DailyWorkout';

const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

// Full review of one workout: the question (now revealed), the learner's recording + transcript and the quick feedback
const WorkoutReview = ({ id }) => {
  const [workout, setWorkout] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    dailyApi.get(id).then(res => setWorkout(res.data)).catch(() => setError(true));
  }, [id]);

  if (error) return <p className="text-xs text-rose-600 dark:text-rose-400 px-1">Không tải được bài này.</p>;
  if (!workout) {
    return <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-3"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>;
  }
  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Câu hỏi · {workout.focus_label_vi}</span>
        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">"{workout.question_text}"</p>
      </div>
      {workout.audio_answer_path && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bản ghi của bạn{workout.duration_seconds ? ` · ${Math.round(workout.duration_seconds)}s` : ''}</span>
          <audio src={resolveMediaUrl(workout.audio_answer_path)} controls preload="none" className="w-full max-w-md h-9" />
        </div>
      )}
      <QuickFeedback workout={workout} />
    </div>
  );
};

export const DailyHistoryPanel = ({ onOpenDaily }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    dailyApi.history().then(res => setData(res.data)).catch(() => setError(true));
  }, []);

  if (error) return <p className="text-sm text-rose-600 dark:text-rose-400">Không tải được lịch sử Daily Workout.</p>;
  if (!data) {
    return (
      <div className="min-h-[30vh] flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Đang tải lịch sử Daily...
      </div>
    );
  }

  const { items, streak } = data;
  const today = streak.last_7_days?.[streak.last_7_days.length - 1]?.date;

  return (
    <div className="flex flex-col gap-4">
      {/* Streak overview */}
      <div className="glass-card rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-slate-900 dark:to-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid grid-cols-3 gap-4 sm:gap-8">
          {[
            { icon: Flame, label: 'Chuỗi hiện tại', value: `${streak.current} ngày`, cls: 'text-orange-500' },
            { icon: Trophy, label: 'Kỷ lục', value: `${streak.best} ngày`, cls: 'text-amber-500' },
            { icon: Zap, label: 'Đã hoàn thành', value: `${streak.total} bài`, cls: 'text-brand-500' },
          ].map(({ icon: Icon, label, value, cls }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Icon className={`w-3.5 h-3.5 ${cls}`} />{label}
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
        <WeekDots days={streak.last_7_days} />
      </div>

      {items.length === 0 ? (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
          <Zap className="w-10 h-10 text-amber-400" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Chưa có bài Daily Workout nào</p>
          {onOpenDaily && (
            <button onClick={onOpenDaily} className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold cursor-pointer">
              Làm thử thách hôm nay
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map(it => {
            const isToday = it.challenge_date === today;
            // Today's unfinished challenge stays hidden; a past attempt that was never graded can be reviewed
            const reviewable = it.status === 'completed' || (it.attempts > 0 && !isToday);
            const expanded = open === it.id;
            return (
              <div key={it.id} className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => reviewable && setOpen(expanded ? null : it.id)}
                    disabled={!reviewable}
                    aria-expanded={expanded}
                    className={`flex-1 min-w-0 flex items-start sm:items-center gap-2.5 text-left ${reviewable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {reviewable
                      ? (expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 mt-0.5 sm:mt-0" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 mt-0.5 sm:mt-0" />)
                      : <span className="w-4 shrink-0" />}
                    <span className="min-w-0 flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />{formatDate(it.challenge_date)}
                        </span>
                        {it.status === 'completed' && (
                          <>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300">{it.badge}</span>
                            {it.topic_label && <span className="text-[11px] text-slate-500 dark:text-slate-400">{it.topic_label}</span>}
                          </>
                        )}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {it.status === 'completed'
                          ? it.question_text
                          : <span className="inline-flex items-center gap-1 italic"><EyeOff className="w-3.5 h-3.5" />Câu hỏi ẩn (chưa hoàn thành)</span>}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                    {it.status === 'completed' ? (
                      <>
                        {it.estimated_level && <span className="text-sm font-black text-sky-700 dark:text-sky-300">{it.estimated_level}</span>}
                        {it.tense_verdict && <VerdictBadge verdict={it.tense_verdict} />}
                        {it.duration_seconds ? <span className="text-[11px] text-slate-500 dark:text-slate-400">{Math.round(it.duration_seconds)}s</span> : null}
                      </>
                    ) : isToday ? (
                      onOpenDaily && (
                        <button onClick={onOpenDaily} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer">
                          Làm ngay <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">{it.attempts > 0 ? 'Chưa chấm xong' : 'Bỏ lỡ'}</span>
                    )}
                  </div>
                </div>
                {expanded && <WorkoutReview id={it.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
