import React from 'react';
import { Languages, ArrowRight, CheckCircle2 } from 'lucide-react';

// Feature 3: errors that come from thinking in Vietnamese (dropped endings, missing to-be, literal translations, confused pairs)
export const VietlishWarnings = ({ warnings = [] }) => (
  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <Languages className="w-4 h-4 text-rose-500" />
      <span>Vietlish Interference Detector</span>
      <span className="normal-case font-medium text-slate-500 dark:text-slate-400">· Lỗi tư duy tiếng Việt ({warnings.length})</span>
    </h3>

    {warnings.length === 0 ? (
      <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Không phát hiện lỗi dịch từ tiếng Việt trong câu trả lời này.</span>
      </p>
    ) : (
      <div className="flex flex-col gap-2.5">
        {warnings.map((w, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-1.5 text-xs">
            {w.issue_vi && (
              <span className="self-start text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                {w.issue_vi}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="line-through text-rose-700 dark:text-rose-300">{w.original_phrase}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{w.suggested_phrase}</span>
            </div>
            {w.explanation_vi && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">🇻🇳 {w.explanation_vi}</p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);
