import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles, Layers, AlertCircle } from 'lucide-react';
import { sessionApi, formatApiError } from '../api/client';
import { ViTooltip } from '../components/Tooltip';
import { useLanguage } from '../context/LanguageContext';

const TOPIC_CHOICES = [
  {
    id: 'environment',
    en: 'Environment',
    vi: 'Môi trường & Sinh thái',
    descVi: 'Biến đổi khí hậu, tái chế, ô nhiễm không khí/rác thải nhựa và lối sống xanh.',
    descEn: 'Climate change, recycling, air & plastic pollution, and eco-friendly daily lifestyle.',
  },
  {
    id: 'human_rights',
    en: 'Human Rights',
    vi: 'Quyền con người & Bình đẳng',
    descVi: 'Bình đẳng nơi làm việc, đối xử công bằng, tự do bày tỏ ý kiến và tôn trọng lẫn nhau.',
    descEn: 'Workplace equality, fair treatment, freedom of expression, and mutual respect.',
  },
  {
    id: 'global_workplace',
    en: 'Global Workplace',
    vi: 'Môi trường làm việc toàn cầu',
    descVi: 'Làm việc từ xa xuyên biên giới, đội nhóm đa quốc gia, khác múi giờ và văn hóa công ty.',
    descEn: 'Cross-border remote work, multinational teams, time zone collaboration, and corporate culture.',
  },
  {
    id: 'socio_cultural',
    en: 'Socio-Cultural Issues',
    vi: 'Vấn đề Văn hóa - Xã hội',
    descVi: 'Khác biệt thế hệ giữa người lớn tuổi và giới trẻ, lối sống hiện đại và truyền thống.',
    descEn: 'Generational differences between older and younger generations, modern vs traditional life.',
  },
  {
    id: 'communication_media',
    en: 'Communication Media',
    vi: 'Phương tiện truyền thông',
    descVi: 'Ảnh hưởng mạng xã hội, ứng dụng nhắn tin hằng ngày và giao tiếp thời đại số.',
    descEn: 'Social media influence, messaging apps in daily routine, and digital communication.',
  },
];

export const TopicSelection = ({ sessionId, initialTopics = null, onTopicsConfirmed }) => {
  const { isVi, pick } = useLanguage();
  const [selectedTopics, setSelectedTopics] = useState(
    initialTopics?.length === 3 ? initialTopics : ['environment', 'socio_cultural', 'communication_media']
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleTopic = (id) => {
    setError('');
    if (selectedTopics.includes(id)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== id));
    } else {
      if (selectedTopics.length >= 3) {
        setError(pick('Chỉ được chọn đúng 3 chủ đề. Hãy bỏ chọn 1 chủ đề trước.', 'You can only select 3 topics. Please uncheck one topic first.'));
        return;
      }
      setSelectedTopics([...selectedTopics, id]);
    }
  };

  const handleGenerateQuestions = async () => {
    if (selectedTopics.length !== 3) {
      setError(pick('Vui lòng chọn đúng 3 chủ đề trước khi tiếp tục.', 'Please select exactly 3 topics before continuing.'));
      return;
    }

    if (!sessionId) {
      setError(pick('Phiên thi chưa được khởi tạo. Vui lòng quay lại trang chủ.', 'Session not initialized. Please return home to start.'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await sessionApi.submitTopics(sessionId, { topics: selectedTopics });
      onTopicsConfirmed();
    } catch (err) {
      console.error('Topics submit error:', err);
      setError(formatApiError(err, pick('Không lưu được chủ đề.', 'Could not save topics.')));
    } finally {
      setSubmitting(false);
    }
  };

  const labelOf = (topicId) => {
    const t = TOPIC_CHOICES.find((x) => x.id === topicId);
    return t ? (isVi ? t.vi : t.en) : null;
  };

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 overflow-y-auto overscroll-contain lg:static lg:inset-auto lg:z-auto lg:h-full lg:overflow-hidden w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[820px] lg:my-auto flex flex-col gap-2.5 sm:gap-4 lg:gap-5">
        {/* Compact Header + Live Counter Bar */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-300/60 dark:border-sky-500/30 text-indigo-700 dark:text-sky-300 text-[10px] sm:text-[11px] font-extrabold mb-0.5 sm:mb-1">
              <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{pick('Bước 2/4 · Chủ đề chính', 'Step 2/4 · Core Topics')}</span>
            </div>
            <h1 className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {pick('Chọn đúng 3 chủ đề', 'Select Exactly 3 Topics')}
            </h1>
            <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {pick('Chọn đúng 3 chủ đề bên dưới để tạo hoặc lọc bộ 15 câu hỏi cá nhân hóa.', 'Choose exactly 3 topics below to build or filter your 15-question exam.')}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs font-extrabold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border whitespace-nowrap ${
                selectedTopics.length === 3
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40'
              }`}
            >
              {selectedTopics.length} / 3
            </span>
            <span className="hidden sm:inline">
              <ViTooltip vi={pick('Bạn phải chọn đúng 3 chủ đề trong 5 chủ đề này trước khi tiếp tục.', 'You must pick exactly 3 of these 5 topics before continuing.')}>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{pick('Bắt buộc 3', '3 required')}</span>
              </ViTooltip>
            </span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Balanced 3x2 Desktop Matrix (5 Topic Cards + 1 Live Exam Mapping Card) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-2 sm:gap-3.5 lg:gap-4">
          {TOPIC_CHOICES.map((topic) => {
            const isSelected = selectedTopics.includes(topic.id);
            return (
              <div
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                className={`p-2.5 sm:p-4 lg:p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-1.5 sm:gap-2.5 ${
                  isSelected
                    ? 'bg-indigo-50/90 dark:bg-sky-500/20 border-indigo-500 dark:border-sky-400 ring-2 ring-indigo-500/30 shadow-md'
                    : 'glass-card hover:border-indigo-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1 sm:mb-1.5">
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm lg:text-base font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                        {isVi ? topic.vi : topic.en}
                      </h2>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-br from-indigo-600 to-sky-500 border-transparent text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-snug sm:leading-relaxed line-clamp-1 sm:line-clamp-none">
                    {isVi ? topic.descVi : topic.descEn}
                  </p>
                </div>

                <div className="hidden sm:flex pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 items-center justify-between font-semibold">
                  <span>{pick('Miêu tả · Trải nghiệm · So sánh', 'Description · Experience · Comparison')}</span>
                  <span className={isSelected ? 'text-indigo-600 dark:text-sky-300 font-bold' : ''}>
                    {isSelected ? pick('✓ Đã chọn', '✓ Selected') : pick('Chạm để chọn', 'Click to select')}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Desktop 6th Symmetrical Summary Card */}
          <div className="hidden lg:flex rounded-2xl p-5 border border-dashed border-indigo-300/70 dark:border-sky-500/30 bg-indigo-50/40 dark:bg-sky-950/20 flex-col justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
                {pick('Phân bổ trong đề 15 câu', '15-Question Distribution')}
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                {pick('3 chủ đề bạn chọn sẽ được gắn trực tiếp vào bộ câu hỏi chính thức:', 'Your 3 selected topics map directly into these exam slots:')}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              {[
                { slot: 'Q8–Q10', label: labelOf(selectedTopics[0]) || pick('Chưa chọn chủ đề 1', 'Topic 1 not selected') },
                { slot: 'Q14', label: labelOf(selectedTopics[1]) || pick('Chưa chọn chủ đề 2', 'Topic 2 not selected') },
                { slot: 'Q15', label: labelOf(selectedTopics[2]) || pick('Chưa chọn chủ đề 3', 'Topic 3 not selected') },
              ].map((row, idx) => (
                <div
                  key={row.slot}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800"
                >
                  <span className="font-extrabold text-indigo-600 dark:text-sky-400 shrink-0">{row.slot}</span>
                  <span className={`truncate font-semibold ${selectedTopics[idx] ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 italic'}`}>
                    {row.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end shrink-0">
          <button
            onClick={handleGenerateQuestions}
            disabled={selectedTopics.length !== 3 || submitting}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-sm transition-all whitespace-nowrap ${
              selectedTopics.length === 3 && !submitting
                ? 'btn-brand-gradient cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{submitting ? pick('Đang lưu...', 'Saving...') : pick('Tiếp tục', 'Next')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
