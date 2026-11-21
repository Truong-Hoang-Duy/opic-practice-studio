import React, { useState, useEffect } from 'react';
import { ArrowRight, Sliders, CheckCircle2, Loader2 } from 'lucide-react';
import { sessionApi, formatApiError } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

const ASSESSMENT_LEVELS = [
  {
    level: 3,
    labelEn: "Level 3 · Intermediate Low",
    labelVi: "Mức 3 · Trung cấp Thấp",
    target: "IL",
    en: "I can ask and answer simple questions, but I struggle to speak in connected sentences.",
    vi: "Tôi có thể hỏi và trả lời các câu hỏi đơn giản, nhưng gặp khó khăn khi nói câu ghép liên tục.",
    noteVi: "Gồm các câu hỏi miêu tả cơ bản và thói quen hằng ngày.",
    noteEn: "Covers basic descriptions and everyday routines.",
  },
  {
    level: 4,
    labelEn: "Level 4 · Intermediate Mid",
    labelVi: "Mức 4 · Trung cấp Trung bình",
    target: "IM",
    en: "I can speak in full sentences and describe my routine and past events with some errors.",
    vi: "Tôi có thể nói thành câu hoàn chỉnh, miêu tả thói quen và sự kiện quá khứ (vẫn có vài lỗi sai).",
    noteVi: "Gồm các câu hỏi miêu tả chi tiết, thói quen và trải nghiệm quá khứ.",
    noteEn: "Covers detailed descriptions, routines, and past experiences.",
  },
  {
    level: 5,
    labelEn: "Level 5 · Intermediate High",
    labelVi: "Mức 5 · Trung cấp Cao",
    target: "IH",
    en: "I can speak comfortably in paragraphs, narrate stories across past, present, and future, and handle unexpected situations.",
    vi: "Tôi nói tự tin thành từng đoạn văn, kể chuyện mượt mà ở các thì và xử lý được tình huống bất ngờ.",
    noteVi: "Gồm các câu hỏi kể chuyện, xử lý tình huống bất ngờ (Role-play) và so sánh.",
    noteEn: "Covers extended storytelling, role-play complications, and comparisons.",
  },
  {
    level: 6,
    labelEn: "Level 6 · Advanced",
    labelVi: "Mức 6 · Cao cấp",
    target: "AL",
    en: "I can speak fluently and in detail about complex abstract, social, and professional topics.",
    vi: "Tôi có thể nói lưu loát, chi tiết về các chủ đề trừu tượng, xã hội và chuyên môn phức tạp.",
    noteVi: "Gồm các câu hỏi thảo luận xã hội và các vấn đề thời sự phức tạp.",
    noteEn: "Covers abstract social discussions and complex professional topics.",
  },
];

// Local dev build only: generate the test from the curated bank to avoid LLM cost while checking the UI
const SHOW_NO_AI_OPTION = import.meta.env.DEV;

export const SelfAssessment = ({ sessionId, fromStudyPack = false, initialLevel = null, onAssessmentCompleted }) => {
  const { isVi, pick } = useLanguage();
  // Levels 1-2 are no longer offered; older sessions with those levels fall back to the default
  const [selectedLevel, setSelectedLevel] = useState(initialLevel >= 3 ? initialLevel : 4);
  const [submitting, setSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState(0);
  const [error, setError] = useState('');

  const loadingSteps = isVi
    ? [
        "Đang phân tích thông tin khảo sát & chủ đề cá nhân...",
        "Eva AI đang khởi tạo 15 câu hỏi chuẩn ACTFL...",
        "Đang phối hợp độ khó, thì thời gian & tình huống Role-play...",
        "Đang chuẩn bị âm thanh câu hỏi & phòng thi...",
      ]
    : [
        "Analyzing your survey profile and selected topics...",
        "Eva AI is crafting 15 personalized ACTFL questions...",
        "Balancing difficulty, tenses, and Role-play scenarios...",
        "Preparing question audio and exam studio...",
      ];

  // Block 1 (Real Exam) -> hidden prompts & end-of-exam scoring (strict_mode = true)
  // Block 2 (From Study Pack) -> filter 15 matching questions from pack, show prompts & score each question (strict_mode = false)
  const strictMode = !fromStudyPack;

  useEffect(() => {
    let interval = null;
    if (submitting) {
      setSubmittingStep(0);
      interval = setInterval(() => {
        setSubmittingStep((step) => (step < loadingSteps.length - 1 ? step + 1 : step));
      }, 2400);
    } else {
      setSubmittingStep(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [submitting]);

  const handleSubmit = async (e, useAi = true) => {
    if (e) e.preventDefault();
    if (!sessionId) {
      setError(pick('Phiên thi chưa được khởi tạo. Vui lòng quay lại trang chủ.', 'Session not initialized. Please return home to start.'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        level: selectedLevel,
        strict_mode: strictMode,
        from_study_pack: fromStudyPack,
      };
      if (!useAi) payload.use_ai = false;
      const res = await sessionApi.submitSelfAssessment(sessionId, payload);
      onAssessmentCompleted(res.data?.mode || (strictMode ? 'exam' : 'practice'));
    } catch (err) {
      console.error("Self-assessment submission failed:", err);
      setError(formatApiError(err, pick('Không tạo được bộ đề.', 'Failed to create question set.')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 overflow-y-auto overscroll-contain lg:static lg:inset-auto lg:z-auto lg:h-full lg:overflow-hidden w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[820px] lg:my-auto flex flex-col gap-2.5 sm:gap-4 lg:gap-5">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 sm:gap-2 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-300/60 dark:border-sky-500/30 text-indigo-700 dark:text-sky-300 text-[10px] sm:text-[11px] font-extrabold">
                <Sliders className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{pick('Bước 3/4 · Mức độ', 'Step 3/4 · Difficulty')}</span>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold border ${
                  fromStudyPack
                    ? 'bg-sky-500/15 border-sky-300/60 dark:border-sky-500/35 text-sky-700 dark:text-sky-300'
                    : 'bg-emerald-500/15 border-emerald-300/60 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {fromStudyPack
                  ? pick('Lọc từ bộ đề · Hiện đề & chấm ngay', 'Study Pack · Show prompt & grade each')
                  : pick('Thi thật · Ẩn đề & chấm cuối', 'Real Exam · Hidden prompts & final report')}
              </span>
            </div>
            <h1 className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {pick('Tự đánh giá trình độ', 'Self-Assessment')}
            </h1>
          </div>
          <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
            {fromStudyPack
              ? pick('Chọn mức độ để lọc 15 câu khớp nhất từ bộ đề sẵn có của bạn.', 'Select your target level to filter 15 matching questions from your Study Pack.')
              : pick('Chọn mức độ phù hợp để hệ thống điều chỉnh độ khó của 15 câu hỏi.', 'Choose the level that best matches your current speaking ability.')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-4">
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-2 sm:gap-3.5 lg:gap-4">
            {ASSESSMENT_LEVELS.map((item) => {
              const isSelected = selectedLevel === item.level;
              return (
                <div
                  key={item.level}
                  onClick={() => setSelectedLevel(item.level)}
                  className={`relative rounded-2xl p-2.5 sm:p-4 lg:p-5 border cursor-pointer transition-all flex flex-col justify-between gap-1.5 sm:gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-sky-500/20 border-indigo-500 dark:border-sky-400 ring-2 ring-indigo-500/30 shadow-md'
                      : 'glass-card hover:border-indigo-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                            isSelected
                              ? 'bg-gradient-to-br from-indigo-600 to-sky-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {item.level}
                        </div>
                        <h2 className="text-xs sm:text-sm lg:text-base font-extrabold text-slate-900 dark:text-white truncate">
                          {isVi ? item.labelVi : item.labelEn}
                        </h2>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] sm:text-[11px] font-extrabold shrink-0">
                        {item.target}
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs lg:text-[13px] text-slate-700 dark:text-slate-200 leading-snug sm:leading-relaxed">
                      {isVi ? item.vi : `"${item.en}"`}
                    </p>
                  </div>

                  <div className="hidden md:flex items-center justify-between pt-2.5 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>{isVi ? item.noteVi : item.noteEn}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-sky-400 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>

          {submitting && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-indigo-50 dark:bg-sky-950/40 border border-indigo-200 dark:border-sky-800/80 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 text-indigo-600 dark:text-sky-400 animate-spin shrink-0" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {fromStudyPack
                    ? pick('Đang lọc 15 câu phù hợp từ bộ đề của bạn...', 'Filtering 15 matching questions from your Study Pack...')
                    : loadingSteps[submittingStep]}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-600 to-sky-400 h-1.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(96, (submittingStep + 1) * 25)}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Row */}
          <div className="flex flex-row items-center justify-end gap-2 sm:gap-2.5 shrink-0">
            {error && (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400 mr-auto">{error}</span>
            )}
            {SHOW_NO_AI_OPTION && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(null, false)}
                title="Chỉ hiện khi chạy local (npm run dev). Giả lập toàn bộ: không gọi AI/STT."
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border border-dashed border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold text-xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <span>{pick('DEV · Giả lập', 'DEV · Mock')}</span>
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl btn-brand-gradient font-extrabold text-sm cursor-pointer whitespace-nowrap ${
                submitting ? 'opacity-80 cursor-wait' : ''
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{fromStudyPack ? pick('Đang lọc...', 'Filtering...') : pick('Đang tạo...', 'Creating...')}</span>
                </>
              ) : (
                <>
                  <span>{fromStudyPack ? pick('Lọc đề', 'Filter Set') : pick('Tạo đề', 'Build Test')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
