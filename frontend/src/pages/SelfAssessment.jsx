import React, { useState, useEffect } from 'react';
import { ArrowRight, Sliders, CheckCircle2, Star, Sparkles, Play, Loader2 } from 'lucide-react';
import { sessionApi, formatApiError } from '../api/client';
import { ViTooltip } from '../components/Tooltip';

const ASSESSMENT_LEVELS = [
  {
    level: 3,
    label: "Level 3: Intermediate Low",
    target: "IL",
    en: "I can ask and answer simple questions, but I struggle to speak in connected sentences.",
    vi: "Tôi có thể hỏi và trả lời các câu hỏi đơn giản, nhưng gặp khó khăn khi nói câu ghép liên tục.",
    difficultyNote: "Bao gồm các câu hỏi miêu tả cơ bản và thói quen hằng ngày."
  },
  {
    level: 4,
    label: "Level 4: Intermediate Mid",
    target: "IM",
    en: "I can speak in full sentences and describe my routine and past events with some errors.",
    vi: "Tôi có thể nói thành câu hoàn chỉnh, miêu tả thói quen và sự kiện quá khứ (vẫn có vài lỗi sai).",
    difficultyNote: "Bao gồm các câu hỏi miêu tả chi tiết, thói quen và trải nghiệm quá khứ."
  },
  {
    level: 5,
    label: "Level 5: Intermediate High",
    target: "IH",
    en: "I can speak comfortably in paragraphs, narrate stories across past, present, and future, and handle unexpected situations.",
    vi: "Tôi nói tự tin thành từng đoạn văn, kể chuyện mượt mà ở các thì, và xử lý được tình huống bất ngờ.",
    difficultyNote: "Bao gồm các câu hỏi kể chuyện, xử lý tình huống bất ngờ (role-play) và so sánh."
  },
  {
    level: 6,
    label: "Level 6: Advanced",
    target: "AL",
    en: "I can speak fluently and in detail about complex abstract, social, and professional topics.",
    vi: "Tôi có thể nói lưu loát, chi tiết về các chủ đề trừu tượng, xã hội và chuyên môn phức tạp.",
    difficultyNote: "Bao gồm các câu hỏi thảo luận xã hội và các vấn đề thời sự phức tạp."
  }
];

// Local dev build only: generate the test from the curated bank to avoid LLM cost while checking the UI
const SHOW_NO_AI_OPTION = import.meta.env.DEV;

const LOADING_STEPS = [
  "Đang phân tích thông tin khảo sát & chủ đề cá nhân...",
  "AI Examiner đang khởi tạo 15 câu hỏi ACTFL...",
  "Đang phối hợp độ khó, thì thời gian & tình huống Role-play...",
  "Đang chuẩn bị âm thanh câu hỏi & phòng thi..."
];

export const SelfAssessment = ({ sessionId, sessionMode = 'practice', defaultStrict = false, initialLevel = null, onAssessmentCompleted }) => {
  // Levels 1-2 are no longer offered; older sessions with those levels fall back to the default
  const [selectedLevel, setSelectedLevel] = useState(initialLevel >= 3 ? initialLevel : 4);
  const isPractice = sessionMode === 'practice';
  const [strictMode, setStrictMode] = useState(isPractice ? false : (defaultStrict ?? true));
  const [submitting, setSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let interval = null;
    if (submitting) {
      setSubmittingStep(0);
      interval = setInterval(() => {
        setSubmittingStep((step) => (step < LOADING_STEPS.length - 1 ? step + 1 : step));
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
      setError("Phiên thi chưa được khởi tạo. Vui lòng quay lại màn hình chính để bắt đầu bài thi.");
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = { level: selectedLevel, strict_mode: isPractice ? false : strictMode };
      if (!useAi) payload.use_ai = false;
      const res = await sessionApi.submitSelfAssessment(sessionId, payload);
      onAssessmentCompleted(res.data?.mode || (isPractice ? 'practice' : (strictMode ? 'exam' : 'practice')));
    } catch (err) {
      console.error("Self-assessment submission failed:", err);
      setError(formatApiError(err, 'Không tạo được bộ đề.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Title */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-2">
          <Sliders className="w-3.5 h-3.5" />
          <span>Step 3 of 5: Question Difficulty Matrix</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Self-Assessment</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl mx-auto">
          Chọn mức độ phù hợp để hệ thống điều chỉnh độ khó của 15 câu hỏi.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ASSESSMENT_LEVELS.map((item) => {
            const isSelected = selectedLevel === item.level;
            return (
              <div
                key={item.level}
                onClick={() => setSelectedLevel(item.level)}
                className={`relative rounded-2xl p-5 border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-sky-50/80 dark:bg-slate-900 border-brand-500 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500'
                    : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                      }`}>
                        {item.level}
                      </div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</h2>
                    </div>

                    <input
                      type="radio"
                      name="assessmentLevel"
                      checked={isSelected}
                      onChange={() => setSelectedLevel(item.level)}
                      className="text-brand-500 focus:ring-0"
                    />
                  </div>

                  {/* English description */}
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                    "{item.en}"
                  </p>

                  {/* Vietnamese translation */}
                  <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300">
                    <span className="text-brand-600 dark:text-brand-400 font-semibold mr-1">🇻🇳 Gợi ý:</span>
                    {item.vi}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>{item.difficultyNote}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Mức chấm: {item.target}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mode indicator */}
        {isPractice ? (
          <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/80 dark:bg-sky-950/30">
            <div className="p-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Chế độ Luyện tập (Coached)</p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                Xem đề bài, gợi ý tiếng Việt, chuyển câu tự do và nhận chấm chữa AI ngay sau mỗi câu.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex-shrink-0">
                <Play className="w-4 h-4 text-rose-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Chế độ Thi Thử (Strict Exam)</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                  Ẩn câu hỏi, giới hạn 5s nghe lại 1 lần, không lùi câu và chấm tổng kết cuối bài.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Progress State */}
        {submitting && (
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 flex flex-col gap-2.5 animate-fadeIn">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-spin flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Đang khởi tạo bài thi 15 câu hỏi
                </span>
                <span className="text-xs text-brand-600 dark:text-brand-400 font-medium transition-all duration-300">
                  {LOADING_STEPS[submittingStep]}
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-600 to-sky-400 h-1.5 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(96, (submittingStep + 1) * 25)}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-2">
          {error && (
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400 sm:mr-auto">{error}</span>
          )}
          {SHOW_NO_AI_OPTION && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(null, false)}
              title="Chỉ hiện khi chạy local (npm run dev). Giả lập toàn bộ: bộ đề mặc định, nhận dạng giọng nói, chấm điểm, bài mẫu, báo cáo — không gọi AI/STT."
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-dashed border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold text-xs cursor-pointer disabled:opacity-60"
            >
              <span>DEV: Giả lập toàn bộ (không gọi AI)</span>
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white font-semibold text-sm shadow-xl shadow-sky-500/25 transition-all transform active:scale-95 cursor-pointer ${
              submitting ? 'opacity-80 cursor-wait' : ''
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tạo bộ đề thi...</span>
              </>
            ) : (
              <>
                <span>Assemble 15-Question Test & Pre-Test</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};
