import React from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';

export const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, session, deleting }) => {
  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col gap-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={deleting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex-shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 pr-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Xóa phiên thi này?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hành động này không thể hoàn tác.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Phiên thi:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">Session #{session.id}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Chế độ:</span>
            <span className="capitalize font-semibold text-slate-800 dark:text-slate-100">{session.mode || 'exam'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Số câu đã trả lời:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{session.answered_count ?? 0} câu</span>
          </div>
          {session.started_at && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Ngày tạo:</span>
              <span>{new Date(session.started_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Toàn bộ câu hỏi, bản ghi âm giọng nói và các lượt chấm điểm/bài mẫu liên quan đến phiên thi này sẽ bị xóa khỏi cơ sở dữ liệu.
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all shadow-md shadow-rose-600/20 disabled:opacity-60 cursor-pointer"
          >
            {deleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
