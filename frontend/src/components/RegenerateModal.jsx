import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader2, RotateCcw } from 'lucide-react';

const QUICK_CHIPS = [
  'Ngắn gọn hơn (~45 giây)',
  'Từ vựng đơn giản, dễ học thuộc',
  'Đổi sang câu chuyện khác tự nhiên hơn',
  'Thêm 1 sự cố nhỏ cho tự nhiên',
];

export const RegenerateModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  title = 'Tạo lại bài mẫu mới',
  subtitle = 'Mô tả ý tưởng hoặc câu chuyện thật của bạn (tiếng Việt hay tiếng Anh đều được). Để trống nếu muốn AI tự viết một câu chuyện mới khác bản cũ.',
  levelLabel = 'IM',
}) => {
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    if (isOpen) setInstruction('');
  }, [isOpen]);

  if (!isOpen) return null;

  const appendChip = (chip) => {
    setInstruction((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.toLowerCase().includes(chip.toLowerCase())) return prev;
      return `${trimmed}. ${chip}`;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    onConfirm(instruction.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in"
      onClick={() => !loading && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-4"
      >
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              {levelLabel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                  Mức {levelLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{subtitle}</p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* One-tap Quick Chips for phones */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => appendChip(chip)}
              disabled={loading}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-brand-500/15 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
            >
              + {chip}
            </button>
          ))}
        </div>

        <textarea
          rows={4}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={loading}
          placeholder="Ví dụ: Nhà tôi ở chung cư 2 phòng ngủ với bố mẹ, thích nhất phòng ngủ vì yên tĩnh, cuối tuần hay nấu mì cùng gia đình... (Có thể để trống)"
          className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none outline-none"
        />

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-sm cursor-pointer disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            <span>{loading ? 'AI đang viết lại...' : instruction.trim() ? 'Tạo theo ý tôi' : 'Tạo bản mới khác'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
