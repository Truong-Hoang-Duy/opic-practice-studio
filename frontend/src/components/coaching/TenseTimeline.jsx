import React from 'react';
import { History, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

// Past -> blue, present -> green, future/hypothetical -> purple
const TENSES = {
  past: { label: 'Quá khứ', en: 'Past', bar: 'bg-blue-500', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', chip: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' },
  present: { label: 'Hiện tại', en: 'Present', bar: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', chip: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' },
  future: { label: 'Tương lai', en: 'Future', bar: 'bg-violet-500', dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', chip: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30' },
  mixed: { label: 'Kết hợp', en: 'Mixed', bar: 'bg-slate-400', dot: 'bg-gradient-to-b from-blue-500 via-emerald-500 to-violet-500', text: 'text-slate-600 dark:text-slate-300', chip: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

// IH needs a real past-tense story on narrative prompts; below this share the answer usually stays at IM
const NARRATIVE_PAST_MIN_PCT = 30;

// Feature 2: sentence-by-sentence tense map + past/present/future share
export const TenseTimeline = ({ timeline = [], distribution, narrativeExpected = false }) => {
  if (!timeline.length && !distribution) return null;

  const shares = distribution
    ? [
        { key: 'past', pct: distribution.past_pct || 0 },
        { key: 'present', pct: distribution.present_pct || 0 },
        { key: 'future', pct: distribution.future_pct || 0 },
      ]
    : [];
  const missingNarrative = narrativeExpected && distribution && (distribution.past_pct || 0) < NARRATIVE_PAST_MIN_PCT;
  const wrongCount = timeline.filter(t => t.status === 'incorrect').length;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <History className="w-4 h-4 text-blue-500" />
        <span>Tense Timeline Map</span>
        <span className="normal-case font-medium text-slate-500 dark:text-slate-400">· Bản đồ 3 thì</span>
        {wrongCount > 0 && (
          <span className="ml-auto normal-case text-[11px] font-semibold text-rose-600 dark:text-rose-400">{wrongCount} câu chia sai thì</span>
        )}
      </h3>

      {shares.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800" role="img"
            aria-label={shares.map(s => `${TENSES[s.key].label} ${s.pct}%`).join(', ')}>
            {shares.filter(s => s.pct > 0).map(s => (
              <div key={s.key} className={`${TENSES[s.key].bar} h-full`} style={{ width: `${s.pct}%` }} title={`${TENSES[s.key].label}: ${s.pct}%`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {shares.map(s => (
              <span key={s.key} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className={`w-2.5 h-2.5 rounded-full ${TENSES[s.key].dot}`} />
                <span>{TENSES[s.key].label} ({TENSES[s.key].en})</span>
                <span className="font-bold">{s.pct}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {missingNarrative && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Thiếu yếu tố kể chuyện ở thì quá khứ</strong> - Đây là lý do chính khiến bài bị giữ ở band IM.
            {' '}Câu hỏi này cần một câu chuyện cụ thể (khi nào, ở đâu, chuyện gì xảy ra, bạn cảm thấy thế nào), kể bằng thì quá khứ.
          </span>
        </div>
      )}

      {timeline.length > 0 && (
        <ol className="flex flex-col">
          {timeline.map((t, i) => {
            const style = TENSES[t.tense] || TENSES.mixed;
            const wrong = t.status === 'incorrect';
            return (
              <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                {/* Vertical timeline rail */}
                {i < timeline.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />}
                <span className={`relative mt-1.5 w-[11px] h-[11px] rounded-full shrink-0 ${style.dot} ring-2 ring-white dark:ring-slate-900`} />
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${style.chip} ${style.text}`}>{style.label}</span>
                    {wrong ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400"><XCircle className="w-3.5 h-3.5" />Sai thì</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Đúng</span>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${wrong ? 'text-rose-800 dark:text-rose-200' : 'text-slate-800 dark:text-slate-200'}`}>"{t.sentence}"</p>
                  {t.note_vi && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">🇻🇳 {t.note_vi}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
