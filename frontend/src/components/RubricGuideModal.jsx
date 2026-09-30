import React from 'react';
import { X, Award, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const RubricGuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">ACTFL / OPIc Scoring Standard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          
          {/* ACTFL Framework Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-400 mb-1">
              <ShieldCheck className="w-5 h-5" />
              <span>Tiêu chuẩn Đánh giá ACTFL OPIc</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-normal">
              Hệ thống đánh giá câu trả lời và đề xuất bài mẫu dựa trên tiêu chuẩn ACTFL OPIc tương ứng với mức độ bạn đã chọn trong bài thi: từ khả năng tạo câu đơn giản (IL), kết nối đoạn (IM), đến kể chuyện có diễn biến và xử lý tình huống linh hoạt (IH/AL).
            </p>
          </div>

          {/* Level Comparison Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Proficiency Levels Breakdown</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Below IL */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                  Below IL (Novice)
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-300 mt-2 font-semibold">Câu trả lời rời rạc, từ đơn lẻ</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Ngập ngừng kéo dài, dựa vào cụm từ học vẹt, chưa thể duy trì câu hoàn chỉnh.
                </p>
              </div>

              {/* IL */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  Intermediate Low (IL)
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-300 mt-2 font-semibold">Câu đơn ngắn, thì hiện tại</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Miêu tả đơn giản về bản thân, ngập ngừng thường xuyên khi cố gắng ghép câu.
                </p>
              </div>

              {/* IM */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
                  Intermediate Mid (IM)
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-300 mt-2 font-semibold">Câu nối, bắt đầu có đoạn văn cơ bản</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Dùng liên từ cơ bản (and, but, because), đã có nỗ lực kể chuyện quá khứ nhưng còn sai sót ở động từ bất quy tắc.
                </p>
              </div>

              {/* IH */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-slate-950/60 border border-emerald-300 dark:border-emerald-500/40">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                  Intermediate High (IH)
                </span>
                <p className="text-xs text-slate-900 dark:text-slate-200 mt-2 font-bold">Đoạn văn dài, 3 thì, kể chuyện có cao trào</p>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 leading-relaxed font-normal">
                  Nói lưu loát 60-120 giây, xử lý tình huống bất ngờ (Role-play problem), chuyển đổi linh hoạt quá khứ/hiện tại/tương lai.
                </p>
              </div>
            </div>
          </div>

          {/* 6 Core ACTFL Criteria */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">6 Core Evaluation Criteria</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                <strong className="text-sky-700 dark:text-sky-400 block mb-0.5 font-bold">1. Fluency & Length (60-120s)</strong>
                <span className="text-slate-600 dark:text-slate-400 font-normal">Duy trì độ dài tối ưu 60-120s không bị khoảng lặng chết.</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                <strong className="text-sky-700 dark:text-sky-400 block mb-0.5 font-bold">2. Tense Control</strong>
                <span className="text-slate-600 dark:text-slate-400 font-normal">Kiểm soát chuẩn xác thì Quá khứ, Hiện tại và Tương lai.</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                <strong className="text-sky-700 dark:text-sky-400 block mb-0.5 font-bold">3. Paragraph Organization</strong>
                <span className="text-slate-600 dark:text-slate-400 font-normal">Cấu trúc: Mở đầu &rarr; Chi tiết &rarr; Sự cố bất ngờ &rarr; Kết luận.</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                <strong className="text-sky-700 dark:text-sky-400 block mb-0.5 font-bold">4. Vocabulary Richness</strong>
                <span className="text-slate-600 dark:text-slate-400 font-normal">Dùng từ vựng biểu cảm, phrasal verbs, tránh lặp từ đơn điệu.</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                <strong className="text-sky-700 dark:text-sky-400 block mb-0.5 font-bold">5. Grammar Accuracy</strong>
                <span className="text-slate-600 dark:text-slate-400 font-normal">Không nuốt âm đuôi (-s, -ed), chia động từ chuẩn.</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                <strong className="text-sky-700 dark:text-sky-400 block mb-0.5 font-bold">6. Task Completion</strong>
                <span className="text-slate-600 dark:text-slate-400 font-normal">Hỏi đủ 3-4 câu trong Role-play, đề xuất 2-3 giải pháp sự cố.</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
          >
            I Understand the Rubric
          </button>
        </div>

      </div>
    </div>
  );
};
