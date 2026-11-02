import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Volume2, Play, Pause, RotateCcw, Eye, GitCompare, Loader2 } from 'lucide-react';
import { speakPhrase, stopSpeaking } from '../utils/speakPhrase';

// Highlights key expressions inside a clean sentence for easy reading & shadowing
const HighlightedSentence = ({ text, expressions = [] }) => {
  if (!text || !expressions.length) return <>{text}</>;
  const validExprs = expressions.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!validExprs.length) return <>{text}</>;

  const escaped = validExprs.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = validExprs.some(e => e.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark
            key={idx}
            className="bg-emerald-100 dark:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 px-1 py-0.5 rounded font-semibold"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        );
      })}
    </>
  );
};

export const DiffViewer = ({
  rewriteData,
  onPracticeAgain,
}) => {
  if (!rewriteData) return null;

  const {
    original_text,
    improved_text,
    current_level,
    target_level,
    vietnamese_coaching_notes,
    diff_chunks,
    key_expressions_added,
    sentences: apiSentences,
  } = rewriteData;

  const [viewMode, setViewMode] = useState('practice'); // 'practice' (clean sentence-by-sentence) | 'diff' (word diff)
  const [speed, setSpeed] = useState(1.0);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(null);

  const sentences = apiSentences && apiSentences.length > 0
    ? apiSentences
    : (improved_text || '').split(/(?<=[.?!])\s+/).filter(Boolean);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [improved_text]);

  const handleTogglePlayAll = async () => {
    setPlayingIdx(null);
    if (isPlayingAll) {
      stopSpeaking();
      setIsPlayingAll(false);
      return;
    }
    setLoadingAudio(true);
    setIsPlayingAll(true);
    try {
      await speakPhrase(improved_text, {
        rate: speed,
        onEnd: () => setIsPlayingAll(false),
      });
    } finally {
      setLoadingAudio(false);
    }
  };

  const handlePlaySentence = async (idx, sent) => {
    setIsPlayingAll(false);
    if (playingIdx === idx) {
      stopSpeaking();
      setPlayingIdx(null);
      return;
    }
    setPlayingIdx(idx);
    await speakPhrase(sent, {
      rate: speed,
      onEnd: () => setPlayingIdx(null),
    });
  };

  return (
    <div className="w-full glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-brand-500/30 shadow-md flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Bài nói của bạn được nâng cấp
            </h3>
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
              {current_level === 'below_IL' ? 'Dưới IL' : current_level} <ArrowRight className="w-3 h-3" /> {target_level}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Giữ nguyên ý tưởng cá nhân của bạn, sửa lại ngữ pháp và nâng cấp cấu trúc câu chuẩn Mức {target_level}.
          </p>
        </div>

        {/* Audio Player & Speed */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
            {[0.85, 1.0].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-brand-500 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleTogglePlayAll}
            disabled={loadingAudio}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            {loadingAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPlayingAll ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isPlayingAll ? 'Dừng nghe' : 'Nghe cả bài'}</span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('practice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'practice'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Bản sạch để luyện nói ({sentences.length} câu)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'diff'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>So sánh chỗ sửa (Diff)</span>
          </button>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {viewMode === 'practice'
            ? '💡 Chạm vào từng câu để nghe Eva đọc mẫu và nhại lại'
            : '💡 Chữ gạch đỏ là phần bỏ đi, chữ xanh là phần nâng cấp'}
        </span>
      </div>

      {/* Mode 1: Clean Sentence-by-Sentence Practice */}
      {viewMode === 'practice' ? (
        <div className="flex flex-col gap-2.5">
          {sentences.map((sent, idx) => {
            const isSpeaking = playingIdx === idx;
            return (
              <div
                key={idx}
                onClick={() => handlePlaySentence(idx, sent)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isSpeaking
                    ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-300 dark:border-brand-500/40 text-slate-900 dark:text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                    isSpeaking
                      ? 'bg-brand-500 text-white font-bold'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-semibold'
                  }`}>
                    #{idx + 1}
                  </span>
                  <p className="text-sm leading-relaxed">
                    <HighlightedSentence text={sent} expressions={key_expressions_added} />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlaySentence(idx, sent);
                  }}
                  title="Nghe câu này"
                  className={`p-2 rounded-lg border transition-colors shrink-0 ${
                    isSpeaking
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Mode 2: Side-by-side comparison */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Bài nói gốc của bạn</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Mức {current_level}
              </span>
            </div>
            <div className="text-sm text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap flex-1 pt-1">
              {original_text}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-brand-300 dark:border-brand-500/40 flex flex-col">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Chi tiết chỉnh sửa lên Mức {target_level}
              </span>
            </div>

            <div className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap flex-1 pt-1">
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
      )}

      {/* Key Expressions Added (with audio buttons) */}
      {key_expressions_added && key_expressions_added.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Cụm từ ăn điểm đã thêm vào bài của bạn (Bấm để nghe):
          </span>
          <div className="flex flex-wrap gap-2">
            {key_expressions_added.map((expr, i) => (
              <button
                key={i}
                type="button"
                onClick={() => speakPhrase(expr, { rate: speed })}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>"{expr}"</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vietnamese Coaching Notes */}
      {vietnamese_coaching_notes && (
        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-slate-950/80 border border-amber-300/80 dark:border-amber-500/30">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">
            <span>🇻🇳 Tại sao bản nâng cấp này đạt điểm cao hơn?</span>
          </div>
          <p className="text-xs text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {vietnamese_coaching_notes}
          </p>
        </div>
      )}

      {/* Action CTA: Practice Speaking Again */}
      {onPracticeAgain && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            🎯 <strong>Cách học hiệu quả nhất:</strong> Sau khi nghe và đọc nhại theo các câu trên 1–2 lần, hãy bấm ghi âm nói lại bằng chính giọng của bạn!
          </p>
          <button
            type="button"
            onClick={onPracticeAgain}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ghi âm nói lại câu này</span>
          </button>
        </div>
      )}
    </div>
  );
};
