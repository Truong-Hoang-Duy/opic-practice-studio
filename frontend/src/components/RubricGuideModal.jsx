import React from 'react';
import { X, Award, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const RubricGuideModal = ({ isOpen, onClose }) => {
  const { pick } = useLanguage();
  if (!isOpen) return null;

  const levels = [
    {
      badge: 'Below IL (Novice)',
      badgeCls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
      boxCls: 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800',
      title: pick('Câu trả lời rời rạc, từ đơn lẻ', 'Isolated words & fragments'),
      desc: pick(
        'Ngập ngừng kéo dài, dựa vào cụm từ học vẹt, chưa thể duy trì câu hoàn chỉnh.',
        'Frequent long pauses, memorized phrases, unable to sustain complete sentences.'
      ),
    },
    {
      badge: 'Intermediate Low (IL)',
      badgeCls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
      boxCls: 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800',
      title: pick('Câu đơn ngắn, thì hiện tại', 'Short simple sentences, present tense'),
      desc: pick(
        'Miêu tả đơn giản về bản thân, ngập ngừng thường xuyên khi cố gắng ghép câu.',
        'Basic personal descriptions with noticeable hesitation when linking ideas.'
      ),
    },
    {
      badge: 'Intermediate Mid (IM)',
      badgeCls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20',
      boxCls: 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800',
      title: pick('Câu nối, bắt đầu có đoạn văn cơ bản', 'Connected sentences, emerging paragraphs'),
      desc: pick(
        'Dùng liên từ cơ bản (and, but, because), có nỗ lực kể chuyện quá khứ nhưng còn sai động từ bất quy tắc.',
        'Uses connectors (and, but, because), attempts past narration with occasional irregular-verb slips.'
      ),
    },
    {
      badge: 'Intermediate High (IH)',
      badgeCls: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
      boxCls: 'bg-emerald-50/70 dark:bg-slate-950/60 border-emerald-300 dark:border-emerald-500/40',
      title: pick('Đoạn văn dài, 3 thì, kể chuyện có cao trào', 'Paragraph length, 3 time frames, clear complication'),
      desc: pick(
        'Nói lưu loát 60–120 giây, xử lý tình huống bất ngờ (Role-play), chuyển đổi linh hoạt quá khứ/hiện tại/tương lai.',
        'Sustained 60–120s speech, handles unexpected Role-play complications, shifts cleanly across past/present/future.'
      ),
    },
  ];

  const criteria = [
    {
      name: pick('1. Độ trôi chảy & Độ dài (60–120s)', '1. Fluency & Length (60–120s)'),
      desc: pick('Duy trì độ dài tối ưu 60–120 giây không bị khoảng lặng kéo dài.', 'Sustain 60–120s flow without awkward dead silences.'),
    },
    {
      name: pick('2. Kiểm soát thì (Tense Control)', '2. Tense Control'),
      desc: pick('Kiểm soát chuẩn xác thì Quá khứ, Hiện tại và Tương lai.', 'Switch accurately across past, present, and future frames.'),
    },
    {
      name: pick('3. Bố cục đoạn văn', '3. Paragraph Organization'),
      desc: pick('Cấu trúc rõ ràng: Mở đầu → Chi tiết → Sự cố bất ngờ → Kết luận.', 'Clear arc: Intro → Details → Unexpected event → Resolution.'),
    },
    {
      name: pick('4. Từ vựng phong phú', '4. Vocabulary Richness'),
      desc: pick('Dùng từ vựng theo chủ đề, collocations, phrasal verbs tự nhiên.', 'Topic-specific vocabulary, collocations, and phrasal verbs.'),
    },
    {
      name: pick('5. Độ chính xác ngữ pháp', '5. Grammar Accuracy'),
      desc: pick('Chia động từ chuẩn, không nuốt âm đuôi (-s, -ed).', 'Consistent subject-verb agreement and past-tense endings.'),
    },
    {
      name: pick('6. Hoàn thành yêu cầu', '6. Task Completion'),
      desc: pick('Hỏi đủ 3–4 câu trong Role-play, đề xuất 2–3 giải pháp xử lý sự cố.', 'Ask 3–4 relevant Role-play questions and propose 2–3 solutions.'),
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {pick('Thang điểm ACTFL / OPIc', 'ACTFL / OPIc Scoring Standard')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-400 mb-1">
              <ShieldCheck className="w-5 h-5" />
              <span>{pick('Tiêu chuẩn Đánh giá ACTFL OPIc', 'ACTFL OPIc Evaluation Framework')}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
              {pick(
                'Hệ thống đánh giá câu trả lời và đề xuất bài mẫu dựa trên chuẩn ACTFL OPIc tương ứng với mục tiêu bạn đã chọn: từ câu đơn (IL), đoạn nối (IM), đến kể chuyện có diễn biến & xử lý tình huống linh hoạt (IH/AL).',
                'Evaluations and model scripts follow ACTFL OPIc proficiency bands matching your chosen goal: from simple sentences (IL) and connected ideas (IM) to full paragraph narration and unexpected problem-solving (IH/AL).'
              )}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {pick('Phân cấp trình độ', 'Proficiency Levels Breakdown')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {levels.map((lvl) => (
                <div key={lvl.badge} className={`p-3.5 rounded-xl border ${lvl.boxCls}`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${lvl.badgeCls}`}>
                    {lvl.badge}
                  </span>
                  <p className="text-xs text-slate-900 dark:text-slate-200 mt-2 font-bold">{lvl.title}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{lvl.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {pick('6 tiêu chí chấm điểm cốt lõi (Thang 1–5)', '6 Core Evaluation Criteria (Scale 1–5)')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {criteria.map((c) => (
                <div key={c.name} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                  <strong className="text-sky-700 dark:text-sky-400 block mb-0.5 font-bold">{c.name}</strong>
                  <span className="text-slate-600 dark:text-slate-400">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl btn-brand-gradient text-xs font-bold cursor-pointer"
          >
            {pick('Đã hiểu thang điểm', 'Got It')}
          </button>
        </div>
      </div>
    </div>
  );
};
