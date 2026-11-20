import React, { useState, useEffect } from 'react';
import { X, Mic, RotateCw, CheckCircle2, Languages, Loader2 } from 'lucide-react';
import { libraryApi, formatApiError } from '../api/client';
import { SpeakButton } from './SpeakButton';
import { stopSpeaking } from '../utils/speakPhrase';

export const FlashcardReview = ({
  questions,
  targetLevel = 'IM',
  onClose,
  onReviewed,
  onOpenVoicePractice,
}) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const q = questions[index] || null;
  const total = questions.length;
  const isDone = index >= total || !q;

  useEffect(() => {
    stopSpeaking();
    setFlipped(false);
    setShowVi(false);
  }, [index]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  if (isDone) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Xong phiên ôn hôm nay!
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
          Bạn vừa ôn xong <strong>{completedCount}</strong> thẻ. Hệ thống đã tự lên lịch nhắc lại đúng lúc bạn sắp quên.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold cursor-pointer"
        >
          Quay lại Bộ đề
        </button>
      </div>
    );
  }

  const model =
    (q.model_answers || []).find((m) => m.level === targetLevel) ||
    (q.model_answers || [])[0] ||
    null;

  const viText =
    Array.isArray(model?.sentences_vi) && model.sentences_vi.some(Boolean)
      ? model.sentences_vi.filter(Boolean).join(' ')
      : '';

  const prevDays = q.review_interval_days || 0;
  const goodNextDays = prevDays < 3 ? 3 : Math.min(14, Math.round(prevDays * 1.8));
  const easyNextDays = prevDays < 7 ? 7 : Math.min(30, Math.round(prevDays * 2));

  const handleRate = async (rating) => {
    if (saving) return;
    setSaving(true);
    stopSpeaking();
    try {
      const { data } = await libraryApi.reviewQuestion(q.id, rating);
      if (onReviewed) onReviewed(q.id, data);
      setCompletedCount((c) => c + 1);
      setIndex((i) => i + 1);
    } catch (err) {
      alert(formatApiError(err, 'Không lưu được kết quả ôn tập.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-36 md:pb-24 flex flex-col gap-4 min-h-[75dvh]">
      {/* Slim 1-line top bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng Flashcard"
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>Ôn nhanh SRS</span>
            <span>{index + 1} / {total}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${Math.round(((index + 1) / Math.max(1, total)) * 100)}%` }}
            />
          </div>
        </div>

        {onOpenVoicePractice && (
          <button
            type="button"
            onClick={() => onOpenVoicePractice(q)}
            title="Mở mic luyện nói câu này"
            className="p-2 rounded-xl bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30 text-brand-600 dark:text-brand-300 cursor-pointer"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Single Clean Flashcard */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        className={`flex-1 glass-card bg-white dark:bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-5 ${
          !flipped ? 'cursor-pointer active:scale-[0.995] transition-transform' : ''
        }`}
      >
        <div className="flex flex-col gap-4">
          {/* Card header */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Q{q.order_index} · {q.topic || q.category_label}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <SpeakButton
                variant="question"
                text={q.question_text}
                audioUrl={q.audio_path}
                id={`fc-q-${q.id}`}
                label="Nghe"
                playingLabel="Đang đọc"
              />
            </div>
          </div>

          {/* Front: Question */}
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
            {q.question_text}
          </p>

          {q.question_translation_vi && flipped && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {q.question_translation_vi}
            </p>
          )}

          {/* Back: Model Answer (only when flipped) */}
          {flipped && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3 animate-in fade-in">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Bài mẫu {model?.level || targetLevel}
                </span>
                <div className="flex items-center gap-1.5">
                  {viText && (
                    <button
                      type="button"
                      onClick={() => setShowVi((v) => !v)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        showVi
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span>{showVi ? 'Ẩn dịch' : 'Dịch'}</span>
                    </button>
                  )}
                  {model && (
                    <SpeakButton
                      text={model.text}
                      audioUrl={model.audio_path}
                      id={`fc-a-${q.id}`}
                      label="Nghe mẫu"
                      playingLabel="Đang phát"
                    />
                  )}
                </div>
              </div>

              {model ? (
                <p className="text-sm sm:text-[15px] text-slate-800 dark:text-slate-100 leading-relaxed">
                  {model.text}
                </p>
              ) : (
                <p className="text-xs italic text-slate-400">Câu này chưa có bài mẫu.</p>
              )}

              {showVi && viText && (
                <p className="p-3 rounded-xl bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {viText}
                </p>
              )}
            </div>
          )}
        </div>

        {!flipped && (
          <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <RotateCw className="w-3.5 h-3.5" />
            <span>Nhẩm 3 ý rồi chạm thẻ để xem đáp án</span>
          </div>
        )}
      </div>

      {/* Bottom 3-Button SRS Rating Bar (thumb-friendly, fixed above nav) */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="max-w-xl mx-auto px-4 py-2.5">
          {!flipped ? (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold cursor-pointer"
            >
              Lật xem đáp án
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleRate('hard')}
                className="py-2.5 px-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 flex flex-col items-center cursor-pointer disabled:opacity-50"
              >
                <span className="text-xs font-bold">Quên</span>
                <span className="text-[10px] opacity-80">1 ngày</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleRate('good')}
                className="py-2.5 px-2 rounded-xl bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex flex-col items-center cursor-pointer disabled:opacity-50"
              >
                <span className="text-xs font-bold">Nhớ sơ</span>
                <span className="text-[10px] opacity-80">{goodNextDays} ngày</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleRate('easy')}
                className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex flex-col items-center cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin my-1" />
                ) : (
                  <>
                    <span className="text-xs font-bold">Thuộc</span>
                    <span className="text-[10px] opacity-90">{easyNextDays} ngày</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
