import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles, Layers, ShieldCheck, AlertCircle } from 'lucide-react';
import { sessionApi, formatApiError } from '../api/client';
import { ViTooltip } from '../components/Tooltip';

const TOPIC_CHOICES = [
  {
    id: "environment",
    title: "Environment",
    vietnamese: "Môi trường",
    description: "Climate change, recycling, air & plastic pollution, and eco-friendly daily lifestyle.",
    iconColor: "text-emerald-400"
  },
  {
    id: "human_rights",
    title: "Human Rights",
    vietnamese: "Quyền con người & Bình đẳng",
    description: "Workplace equality, fair treatment, freedom of expression, and mutual respect.",
    iconColor: "text-amber-400"
  },
  {
    id: "global_workplace",
    title: "Global Workplace",
    vietnamese: "Môi trường làm việc toàn cầu",
    description: "Cross-border remote work, multinational teams, time zone collaboration, and corporate culture.",
    iconColor: "text-sky-400"
  },
  {
    id: "socio_cultural",
    title: "Socio-Cultural Issues",
    vietnamese: "Vấn đề Văn hóa - Xã hội",
    description: "Generational differences between older and younger generations, modern vs traditional life.",
    iconColor: "text-purple-400"
  },
  {
    id: "communication_media",
    title: "Communication Media",
    vietnamese: "Phương tiện truyền thông",
    description: "Social media influence, messaging apps in daily routine, digital communication hurdles.",
    iconColor: "text-pink-400"
  }
];

export const TopicSelection = ({ sessionId, initialTopics = null, onTopicsConfirmed }) => {
  const [selectedTopics, setSelectedTopics] = useState(
    initialTopics?.length === 3 ? initialTopics : ['environment', 'socio_cultural', 'communication_media']
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleTopic = (id) => {
    setError('');
    if (selectedTopics.includes(id)) {
      setSelectedTopics(selectedTopics.filter(t => t !== id));
    } else {
      if (selectedTopics.length >= 3) {
        setError("You can only select exactly 3 topics. Please uncheck one topic first.");
        return;
      }
      setSelectedTopics([...selectedTopics, id]);
    }
  };

  const handleGenerateQuestions = async () => {
    if (selectedTopics.length !== 3) {
      setError("Please select exactly 3 topics before continuing.");
      return;
    }

    if (!sessionId) {
      setError("Phiên thi chưa được khởi tạo. Vui lòng quay lại màn hình chính để bắt đầu bài thi.");
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await sessionApi.submitTopics(sessionId, { topics: selectedTopics });
      onTopicsConfirmed();
    } catch (err) {
      console.error("Topics submit error:", err);
      setError(formatApiError(err, 'Không lưu được chủ đề.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Title */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-2">
          <Layers className="w-3.5 h-3.5" />
          <span>Step 2 of 5: Core Topic Focus</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Select Exactly 3 Topics</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl mx-auto">
          Choose exactly 3 of the 5 specific topics below. The test engine will combine your survey background and these 3 topics into your personalized 15-question OPIc exam.
        </p>
      </div>

      {/* Counter bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Selected Topics:</span>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
            selectedTopics.length === 3
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40'
          }`}>
            {selectedTopics.length} / 3 selected
          </span>
        </div>

        <ViTooltip vi="Bạn phải chọn đúng 3 chủ đề trong 5 chủ đề này trước khi Eva tạo bộ 15 câu hỏi chính thức.">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Rule: Exactly 3 Required</span>
        </ViTooltip>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* 5 Topic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOPIC_CHOICES.map((topic) => {
          const isSelected = selectedTopics.includes(topic.id);
          return (
            <div
              key={topic.id}
              onClick={() => toggleTopic(topic.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'bg-sky-50/80 dark:bg-slate-900 border-brand-500 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500'
                  : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{topic.title}</h2>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">({topic.vietnamese})</span>
                  </div>
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-brand-500 border-brand-400 text-white' : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                  {topic.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
                <span>Dạng câu: miêu tả, kể trải nghiệm, so sánh & sự cố</span>
                <span className={isSelected ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                  {isSelected ? '✓ Included in Test' : 'Click to select'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-4">
        {error && (
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400 sm:mr-auto">{error}</span>
        )}
        <button
          onClick={handleGenerateQuestions}
          disabled={selectedTopics.length !== 3 || submitting}
          className={`flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-xl ${
            selectedTopics.length === 3 && !submitting
              ? 'bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white shadow-sky-500/25 cursor-pointer transform active:scale-95'
              : 'bg-slate-200 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{submitting ? 'Saving Topics...' : 'Confirm 3 Topics & Proceed to Self-Assessment'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
