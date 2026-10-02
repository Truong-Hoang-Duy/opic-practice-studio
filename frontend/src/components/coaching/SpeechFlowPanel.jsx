import React from 'react';
import { Gauge, Timer, MessageCircle, Info } from 'lucide-react';

// Speaking-rate scale shown on the bar (WPM); zones match the backend bands
const SCALE_MAX = 200;
const ZONES = [
  { to: 90, className: 'bg-amber-400/70' },
  { to: 130, className: 'bg-emerald-500/80' },
  { to: 150, className: 'bg-sky-400/70' },
  { to: SCALE_MAX, className: 'bg-rose-500/70' },
];

const PACE_STYLES = {
  too_slow: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30',
  ideal: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30',
  slightly_fast: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/30',
  too_fast: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30',
};

const formatTime = (sec) => {
  if (sec == null) return '–';
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const Stat = ({ icon: Icon, label, value, sub }) => (
  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col gap-0.5 min-w-0">
    <span className="text-[10px] uppercase font-semibold tracking-wide text-slate-500 dark:text-slate-400 flex items-start gap-1 leading-tight">
      <Icon className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
      <span>{label}</span>
    </span>
    <span className="text-lg font-bold text-slate-900 dark:text-white">{value}</span>
    {sub && <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{sub}</span>}
  </div>
);

// Feature 1: speaking rate, dead-air pauses and filler words of the recorded take
export const SpeechFlowPanel = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 shadow-sm">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Phiên bản này không có bản ghi âm (bản viết lại hoặc chưa nhận dạng được lời nói) nên không phân tích được tốc độ nói và ngập ngừng.</span>
      </div>
    );
  }

  const { wpm, pace, pace_label_vi: paceLabel, pauses = [], fillers = {}, has_timing: hasTiming } = metrics;
  const markerLeft = wpm != null ? `${Math.min(100, (wpm / SCALE_MAX) * 100)}%` : null;
  const fillerCounts = Object.entries(fillers.counts || {});

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Gauge className="w-4 h-4 text-brand-500" />
        <span>Speech Flow & Hesitation</span>
        <span className="normal-case font-medium text-slate-500 dark:text-slate-400">· Tốc độ & ngập ngừng</span>
      </h3>

      {/* Speaking-rate bar */}
      {wpm != null && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{wpm}</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">từ/phút (WPM)</span>
            {paceLabel && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PACE_STYLES[pace] || ''}`}>{paceLabel}</span>
            )}
          </div>
          <div className="relative pt-1">
            <div className="flex h-2.5 rounded-full overflow-hidden">
              {ZONES.map((z, i) => {
                const from = i === 0 ? 0 : ZONES[i - 1].to;
                return <div key={z.to} className={z.className} style={{ width: `${((z.to - from) / SCALE_MAX) * 100}%` }} />;
              })}
            </div>
            <div
              className="absolute top-0 w-1 -ml-0.5 rounded-full bg-slate-900 dark:bg-white shadow ring-2 ring-white dark:ring-slate-900"
              style={{ left: markerLeft, height: '18px' }}
              aria-hidden="true"
            />
            <div className="relative h-4 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              {[90, 130, 150].map(v => (
                <span key={v} className="absolute -translate-x-1/2" style={{ left: `${(v / SCALE_MAX) * 100}%` }}>{v}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        <Stat
          icon={Timer}
          label="Thời gian nói"
          value={formatTime(metrics.speaking_time_sec)}
          sub={metrics.start_delay_sec != null ? `Bắt đầu nói sau ${metrics.start_delay_sec}s` : `${metrics.total_words} từ`}
        />
        <Stat
          icon={Timer}
          label="Khoảng lặng ≥ 2s"
          value={hasTiming ? metrics.pause_count : '–'}
          sub={hasTiming
            ? (metrics.pause_count ? `Dài nhất ${metrics.longest_pause_sec}s · tổng ${metrics.total_pause_sec}s` : 'Không có khoảng im lặng chết')
            : 'Không có mốc thời gian từng từ'}
        />
        <Stat
          icon={MessageCircle}
          label="Từ đệm"
          value={fillers.total ?? 0}
          sub={metrics.fillers_per_min != null ? `${metrics.fillers_per_min} lần/phút` : null}
        />
      </div>

      {pauses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Khoảng im lặng chết</span>
          <ul className="flex flex-col gap-1">
            {pauses.map((p, i) => (
              <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-mono text-amber-700 dark:text-amber-300">{formatTime(p.start_sec)} → {formatTime(p.end_sec)}</span>
                <span className="font-semibold">{p.duration_sec}s</span>
                <span className="text-slate-500 dark:text-slate-400">sau "<span className="italic">{p.after_word}</span>", trước "<span className="italic">{p.before_word}</span>"</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Mẹo: thay khoảng im lặng bằng cụm câu giữ nhịp như "Let me think...", "What I mean is..." để không bị mất điểm Fluency.
          </p>
        </div>
      )}

      {fillerCounts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Từ đệm đã dùng</span>
          <div className="flex flex-wrap gap-1.5">
            {fillerCounts.map(([word, count]) => (
              <span key={word} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                "{word}" <span className="font-bold">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
