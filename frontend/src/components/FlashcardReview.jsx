import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Mic,
  RotateCw,
  CheckCircle2,
  Languages,
  Loader2,
  Sparkles,
  RotateCcw,
  ThumbsUp,
  Award,
  Tag,
} from 'lucide-react';
import { libraryApi, formatApiError } from '../api/client';
import { SpeakButton } from './SpeakButton';
import { stopSpeaking } from '../utils/speakPhrase';
import { recordStudyActivity } from '../utils/studyStreak';
import { notify } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

const OFFICIAL_IDS = ['environment', 'human_rights', 'global_workplace', 'socio_cultural', 'communication_media'];

const CATEGORY_ACCENT = {
  home: {
    bar: 'from-amber-400 via-orange-500 to-amber-500',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/70 dark:border-amber-500/30',
  },
  leisure: {
    bar: 'from-violet-500 via-purple-500 to-fuchsia-500',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300/70 dark:border-violet-500/30',
  },
  official: {
    bar: 'from-emerald-500 via-teal-500 to-cyan-500',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-500/30',
  },
  role_play: {
    bar: 'from-sky-500 via-blue-500 to-indigo-500',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/70 dark:border-sky-500/30',
  },
  unexpected: {
    bar: 'from-rose-500 via-pink-500 to-orange-500',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/70 dark:border-rose-500/30',
  },
  custom: {
    bar: 'from-indigo-500 via-blue-500 to-cyan-500',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300/70 dark:border-indigo-500/30',
  },
};

const accentForCategory = (cat) => {
  if (OFFICIAL_IDS.includes(cat)) return CATEGORY_ACCENT.official;
  return CATEGORY_ACCENT[cat] || CATEGORY_ACCENT.custom;
};

export const FlashcardReview = ({
  questions,
  targetLevel = 'IM',
  onClose,
  onReviewed,
  onOpenVoicePractice,
}) => {
  const { isVi, pick } = useLanguage();
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

  const handleRate = useCallback(
    async (rating) => {
      if (saving || !q) return;
      setSaving(true);
      stopSpeaking();
      try {
        const { data } = await libraryApi.reviewQuestion(q.id, rating);
        recordStudyActivity();
        if (onReviewed) onReviewed(q.id, data);
        setCompletedCount((c) => c + 1);
        setIndex((i) => i + 1);
      } catch (err) {
        notify.error(formatApiError(err, 'Không lưu được kết quả ôn tập.'));
      } finally {
        setSaving(false);
      }
    },
    [saving, q, onReviewed]
  );

  // Desktop keyboard ergonomics: Space/Enter to flip, 1/2/3 to rate, Esc to exit
  useEffect(() => {
    if (isDone) return undefined;
    const onKeyDown = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (!flipped && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        setFlipped(true);
        return;
      }
      if (flipped && !saving) {
        if (e.key === '1') {
          e.preventDefault();
          handleRate('hard');
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate('good');
        } else if (e.key === '3') {
          e.preventDefault();
          handleRate('easy');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDone, flipped, saving, handleRate, onClose]);

  if (isDone) {
    return (
      <div className="min-h-[calc(100dvh-6rem)] w-full flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full glass-panel rounded-3xl p-8 text-center flex flex-col items-center gap-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {pick('Hoàn thành phiên ôn bài mẫu!', 'Script Recall Complete!')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
              {isVi ? (
                <>Bạn vừa ôn thuộc xong <strong className="text-emerald-600 dark:text-emerald-400">{completedCount}</strong> bài mẫu. Hệ thống đã tự lên lịch nhắc lại đúng lúc bạn sắp quên.</>
              ) : (
                <>You just reviewed <strong className="text-emerald-600 dark:text-emerald-400">{completedCount}</strong> full model answers. Your review schedule has been updated automatically.</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl btn-brand-gradient text-sm font-bold cursor-pointer"
          >
            {pick('Quay lại Kho ôn tập', 'Back to Study Hub')}
          </button>
        </div>
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
  const progressPct = Math.round(((index + 1) / Math.max(1, total)) * 100);
  const accent = accentForCategory(q.category);
  const storyTags = Array.isArray(q.story_tags) ? q.story_tags : [];

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 overflow-hidden overscroll-none bg-[#f3f6fc] dark:bg-[#090e1a] lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:dark:bg-transparent lg:h-full lg:min-h-0 w-full flex flex-col items-center px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6">
      {/* Unified Symmetrical Deck Container (Equal top & bottom padding on iPhone 11 & Laptop!) */}
      <div className="w-full max-w-2xl flex-1 min-h-0 lg:max-h-[760px] lg:my-auto flex flex-col justify-between gap-2.5 lg:gap-4">
        {/* Top Studio Progress Header */}
        <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center gap-3.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label={pick('Đóng ôn bài mẫu', 'Close script recall')}
            title={pick('Đóng (Esc)', 'Close (Esc)')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-extrabold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-sky-400" />
                <span>{pick('Ôn thuộc bài mẫu', 'Script Recall')}</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 font-extrabold text-[11px]">
                {index + 1} / {total}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {onOpenVoicePractice && (
            <button
              type="button"
              onClick={() => onOpenVoicePractice(q)}
              title={pick('Mở mic luyện nói câu này', 'Practice speaking this question')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-500/20 dark:to-sky-500/20 hover:from-indigo-100 hover:to-sky-100 dark:hover:from-indigo-500/30 dark:hover:to-sky-500/30 border border-indigo-200/80 dark:border-indigo-400/30 text-indigo-700 dark:text-sky-200 text-xs font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{pick('Luyện nói', 'Speak')}</span>
            </button>
          )}
        </div>

        {/* Layered Tactile Flashcard Deck Stack */}
        <div className="relative flex-1 min-h-0 pt-0.5 pb-1 lg:pt-1 lg:pb-2 flex flex-col">
          {/* Decorative stacked depth cards behind the active flashcard */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute inset-x-7 -bottom-1.5 h-10 rounded-3xl bg-indigo-100/80 dark:bg-slate-800/60 border border-indigo-200/60 dark:border-slate-700/50 -z-20"
          />
          <div
            aria-hidden="true"
            className="hidden sm:block absolute inset-x-3.5 bottom-0 h-10 rounded-3xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-sm -z-10"
          />

          <div
            onClick={() => !flipped && setFlipped(true)}
            className={`glass-panel rounded-3xl overflow-hidden flex-1 min-h-0 flex flex-col justify-between transition-all duration-200 ${
              !flipped ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.995]' : ''
            }`}
          >
            {/* Vivid Category Accent Top Ribbon */}
            <div className={`h-1.5 w-full shrink-0 bg-gradient-to-r ${accent.bar}`} />

            <div className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-5">
                {/* Card Header Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${accent.badge}`}>
                      <span>Q{q.order_index}</span>
                      <span className="opacity-50">·</span>
                      <span className="truncate">{q.topic || q.category_label}</span>
                    </span>
                    {model?.level && (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-extrabold">
                        {model.level}
                      </span>
                    )}
                  </div>

                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <SpeakButton
                      variant="question"
                      text={q.question_text}
                      audioUrl={q.audio_path}
                      id={`fc-q-${q.id}`}
                      label={pick('Nghe', 'Listen')}
                      playingLabel={pick('Đang đọc', 'Playing')}
                    />
                  </div>
                </div>

                {/* Front Prompt */}
                <div className="flex flex-col gap-2.5">
                  <p className="text-lg sm:text-[21px] font-extrabold text-slate-900 dark:text-white leading-relaxed tracking-tight">
                    {q.question_text}
                  </p>

                  {isVi && q.question_translation_vi && flipped && (
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {q.question_translation_vi}
                    </p>
                  )}

                  {storyTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {storyTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 text-[11px] font-semibold"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Back: Model Answer Section (Revealed on Flip) */}
                {flipped && (
                  <div className="mt-1 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/85 via-teal-50/40 to-white dark:from-emerald-950/35 dark:via-slate-900/80 dark:to-slate-900/90 border border-emerald-200/80 dark:border-emerald-500/30 flex flex-col gap-3.5 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {pick(`Bài mẫu ${model?.level || targetLevel}`, `${model?.level || targetLevel} Model Answer`)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isVi && viText && (
                          <button
                            type="button"
                            onClick={() => setShowVi((v) => !v)}
                            className={`h-7 inline-flex items-center justify-center px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
                              showVi
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            <span className="inline-grid items-center justify-items-center">
                              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showVi ? 'visible' : 'invisible pointer-events-none'}`}>
                                <Languages className="w-3.5 h-3.5 shrink-0" />
                                <span>Dịch</span>
                              </span>
                              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showVi ? 'visible' : 'invisible pointer-events-none'}`}>
                                <Languages className="w-3.5 h-3.5 shrink-0" />
                                <span>Ẩn dịch</span>
                              </span>
                            </span>
                          </button>
                        )}
                        {model && (
                          <SpeakButton
                            text={model.text}
                            audioUrl={model.audio_path}
                            id={`fc-a-${q.id}`}
                            label={pick('Nghe mẫu', 'Play model')}
                            playingLabel={pick('Đang phát', 'Playing')}
                          />
                        )}
                      </div>
                    </div>

                    {model ? (
                      <p className="text-[15px] sm:text-base text-slate-800 dark:text-slate-100 leading-[1.75] font-medium">
                        {model.text}
                      </p>
                    ) : (
                      <p className="text-xs italic text-slate-400">{pick('Câu này chưa có bài mẫu.', 'No model answer available yet.')}</p>
                    )}

                    {isVi && showVi && viText && (
                      <p className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-sky-200/80 dark:border-sky-500/30 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                        {viText}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {!flipped && (
                <div className="pt-5 border-t border-dashed border-slate-200 dark:border-slate-700/70 flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 dark:text-sky-400">
                  <RotateCw className="w-4 h-4" />
                  <span>{pick('Nhẩm nhanh 3 ý rồi chạm thẻ để lật đáp án', 'Mentally outline 3 points, then tap to reveal the model answer')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified Action Controls (Pinned neatly at bottom on BOTH Mobile & Desktop — Zero scroll, zero overlap!) */}
        <div className="w-full shrink-0">
          {!flipped ? (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="w-full h-11 lg:h-12 rounded-2xl btn-brand-gradient text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <RotateCw className="w-4 h-4 shrink-0" />
              <span>{pick('Lật đáp án', 'Reveal Answer')}</span>
              <span className="hidden lg:inline ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-bold">Space</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleRate('hard')}
                className="group py-2.5 lg:py-3.5 px-2 lg:px-4 rounded-2xl bg-gradient-to-b from-rose-50 to-rose-100/90 dark:from-rose-500/15 dark:to-rose-500/10 hover:from-rose-500 hover:to-rose-600 text-rose-700 dark:text-rose-200 hover:text-white border border-rose-300/90 dark:border-rose-500/40 hover:border-rose-500 shadow-sm hover:shadow-lg hover:shadow-rose-500/25 flex flex-col items-center gap-0.5 lg:gap-1 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-extrabold">
                  <RotateCcw className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
                  <span>{pick('Quên', 'Hard')}</span>
                </span>
                <span className="text-[10px] lg:text-[11px] font-semibold opacity-80">{pick('1 ngày', '1 day')}</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleRate('good')}
                className="group py-2.5 lg:py-3.5 px-2 lg:px-4 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/90 dark:from-amber-500/15 dark:to-amber-500/10 hover:from-amber-500 hover:to-orange-500 text-amber-800 dark:text-amber-200 hover:text-white border border-amber-300/90 dark:border-amber-500/40 hover:border-amber-500 shadow-sm hover:shadow-lg hover:shadow-amber-500/25 flex flex-col items-center gap-0.5 lg:gap-1 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-extrabold">
                  <ThumbsUp className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
                  <span>{pick('Nhớ sơ', 'Good')}</span>
                </span>
                <span className="text-[10px] lg:text-[11px] font-semibold opacity-80">{pick(`${goodNextDays} ngày`, `${goodNextDays} days`)}</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleRate('easy')}
                className="py-2.5 lg:py-3.5 px-2 lg:px-4 rounded-2xl btn-speak-gradient flex flex-col items-center justify-center gap-0.5 lg:gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin my-1" />
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-extrabold">
                      <Award className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
                      <span>{pick('Thuộc', 'Easy')}</span>
                    </span>
                    <span className="text-[10px] lg:text-[11px] font-semibold opacity-90">{pick(`${easyNextDays} ngày`, `${easyNextDays} days`)}</span>
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
