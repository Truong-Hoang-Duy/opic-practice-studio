import React, { useState } from 'react';
import { ArrowRight, Sliders, CheckCircle2, Star, Sparkles } from 'lucide-react';
import { sessionApi } from '../api/client';
import { ViTooltip } from '../components/Tooltip';

const ASSESSMENT_LEVELS = [
  {
    level: 1,
    label: "Level 1: Novice Low-Mid",
    target: "IL",
    en: "I can only say individual words and memorized phrases like greetings.",
    vi: "Tôi chỉ có thể nói các từ đơn lẻ và cụm từ quen thuộc học vẹt như lời chào hỏi.",
    difficultyNote: "Generates basic descriptive questions."
  },
  {
    level: 2,
    label: "Level 2: Novice High",
    target: "IL",
    en: "I can make simple sentences in the present tense about basic personal facts.",
    vi: "Tôi có thể nói các câu đơn giản thì hiện tại về thông tin cá nhân cơ bản.",
    difficultyNote: "Focuses on present-tense descriptions."
  },
  {
    level: 3,
    label: "Level 3: Intermediate Low",
    target: "IM",
    en: "I can ask and answer simple questions, but I struggle to speak in connected sentences.",
    vi: "Tôi có thể hỏi và trả lời các câu hỏi đơn giản, nhưng gặp khó khăn khi nói câu ghép liên tục.",
    difficultyNote: "Combines descriptions with basic routine questions."
  },
  {
    level: 4,
    label: "Level 4: Intermediate Mid (Recommended for IH Goal)",
    target: "IH",
    recommended: true,
    en: "I can speak in full sentences and describe my routine and past events with some errors.",
    vi: "Tôi có thể nói thành câu hoàn chỉnh, miêu tả thói quen và sự kiện quá khứ (vẫn có vài lỗi sai).",
    difficultyNote: "Optimal choice to unlock 15-question set targeting Intermediate High."
  },
  {
    level: 5,
    label: "Level 5: Intermediate High",
    target: "IH",
    en: "I can speak comfortably in paragraphs, narrate stories across past, present, and future, and handle unexpected situations.",
    vi: "Tôi nói tự tin thành từng đoạn văn, kể chuyện mượt mà ở các thì, và xử lý được tình huống bất ngờ.",
    difficultyNote: "Unlocks role-plays with complex complications and comparison tasks."
  },
  {
    level: 6,
    label: "Level 6: Advanced",
    target: "IH",
    en: "I can speak fluently and in detail about complex abstract, social, and professional topics.",
    vi: "Tôi có thể nói lưu loát, chi tiết về các chủ đề trừu tượng, xã hội và chuyên môn phức tạp.",
    difficultyNote: "Challenges candidate with abstract socio-cultural discourse."
  }
];

export const SelfAssessment = ({ sessionId, onAssessmentCompleted }) => {
  const [selectedLevel, setSelectedLevel] = useState(4); // Default level 4 for IH aspirants
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sessionApi.submitSelfAssessment(sessionId, { level: selectedLevel });
      onAssessmentCompleted();
    } catch (err) {
      console.error("Self-assessment submission failed:", err);
      onAssessmentCompleted();
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
          In OPIc, selecting your self-assessment level determines the complexity, topic depth, and role-play difficulty of the 15 questions generated.
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
                {item.recommended && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow">
                    <Sparkles className="w-3 h-3 fill-current" />
                    <span>Recommended for IH Target</span>
                  </div>
                )}

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
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Target: {item.target}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white font-semibold text-sm shadow-xl shadow-sky-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            <span>{submitting ? 'Applying Difficulty...' : 'Next: Topic Selection (Choose 3)'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </form>

    </div>
  );
};
