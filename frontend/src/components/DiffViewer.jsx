import React from 'react';
import { ArrowRight, Sparkles, Check, BookOpen, Layers } from 'lucide-react';
import { ViTooltip } from './Tooltip';

export const DiffViewer = ({
  rewriteData,
  onAccept,
  isAccepting = false
}) => {
  if (!rewriteData) return null;

  const {
    original_text,
    improved_text,
    current_level,
    target_level,
    changes_explanation,
    vietnamese_coaching_notes,
    diff_chunks,
    key_expressions_added
  } = rewriteData;

  return (
    <div className="w-full glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-brand-500/30 shadow-lg dark:shadow-2xl flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Answer Upgrade Analysis</h3>
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
              {current_level} <ArrowRight className="w-3 h-3" /> {target_level}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Preserves your personal narrative while introducing paragraph cohesion, narrative complication, and advanced tenses.
          </p>
        </div>

        <button
          onClick={() => onAccept(improved_text)}
          disabled={isAccepting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 self-start sm:self-auto cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>{isAccepting ? 'Saving...' : 'Accept & Create Version'}</span>
        </button>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Original */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Your Original Version</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              Level {current_level}
            </span>
          </div>
          <div className="text-sm text-slate-800 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-wrap flex-1 pt-1">
            {original_text}
          </div>
        </div>

        {/* Upgraded with highlights */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-brand-300 dark:border-brand-500/40 flex flex-col">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Upgraded to Level {target_level}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
              Level {target_level}
            </span>
          </div>

          <div className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-normal whitespace-pre-wrap flex-1 pt-1">
            {diff_chunks && diff_chunks.length > 0 ? (
              diff_chunks.map((chunk, idx) => {
                if (chunk.type === 'insert') {
                  return (
                    <span key={idx} className="bg-emerald-100 dark:bg-emerald-500/25 text-emerald-900 dark:text-emerald-300 px-1 py-0.5 rounded border-b-2 border-emerald-500 font-semibold">
                      {chunk.text}
                    </span>
                  );
                }
                if (chunk.type === 'delete') {
                  return (
                    <span key={idx} className="line-through text-rose-700 dark:text-rose-400/80 bg-rose-100 dark:bg-rose-500/10 px-1 py-0.5 rounded mr-1 text-xs">
                      {chunk.text}
                    </span>
                  );
                }
                return <span key={idx}>{chunk.text}</span>;
              })
            ) : (
              improved_text
            )}
          </div>
        </div>
      </div>

      {/* Vietnamese Coaching Notes */}
      {vietnamese_coaching_notes && (
        <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-slate-950/80 border border-amber-300/80 dark:border-amber-500/30">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 mb-1.5">
            <span className="text-sm">🇻🇳</span>
            <span>Phân tích chiến thuật nâng cấp (Vietnamese Coaching):</span>
          </div>
          <p className="text-xs text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-normal">
            {vietnamese_coaching_notes}
          </p>
        </div>
      )}

      {/* Key Expressions Added */}
      {key_expressions_added && key_expressions_added.length > 0 && (
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-2 block">Key Expressions Injected:</span>
          <div className="flex flex-wrap gap-2">
            {key_expressions_added.map((expr, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-500/20 font-medium">
                "{expr}"
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
