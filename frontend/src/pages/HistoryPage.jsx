import React, { useState, useEffect } from 'react';
import { historyApi, sessionApi } from '../api/client';
import { 
  History, 
  Filter, 
  Trash2, 
  RotateCcw, 
  Volume2, 
  Calendar, 
  FileText, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { ViTooltip } from '../components/Tooltip';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

export const HistoryPage = ({ onViewReport, onResumeSession, onDeleteSession }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await historyApi.getHistory();
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setDeleting(true);
    try {
      await sessionApi.delete(sessionToDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      if (onDeleteSession) {
        onDeleteSession(sessionToDelete.id);
      }
      setSessionToDelete(null);
    } catch (err) {
      console.error("Failed to delete session", err);
      alert("Không thể xóa phiên thi. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (levelFilter !== 'ALL' && s.overall_level !== levelFilter) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Practice History & Archives</h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Review past mock simulations, replay audio recordings, and inspect your diagnostic progress over time.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-1 text-xs shadow-sm">
            <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-2" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none pr-2 py-1 text-xs"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Levels</option>
              <option value="IH" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">IH (Intermediate High)</option>
              <option value="IM" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">IM (Intermediate Mid)</option>
              <option value="IL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">IL (Intermediate Low)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-1 text-xs shadow-sm">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none px-2 py-1 text-xs"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Statuses</option>
              <option value="completed" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Completed</option>
              <option value="in_progress" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">In Progress</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading candidate history...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center shadow-sm">
          <History className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">No matching test sessions found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try resetting the filters or complete a new test.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Session #{session.id}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                    session.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                  }`}>
                    {session.status}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">Mode: <strong className="capitalize text-slate-800 dark:text-slate-200">{session.mode}</strong></span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    {new Date(session.started_at).toLocaleString()}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="whitespace-nowrap">Answered: {session.answered_count} / {session.total_questions || 15} questions</span>
                </div>

                {session.topics && session.topics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Topics:</span>
                    {session.topics.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        {t.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Level & Action buttons */}
              <div className="flex items-center gap-3 self-end sm:self-center">
                {session.overall_level && (
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Awarded</span>
                    <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                      Level {session.overall_level}
                    </span>
                  </div>
                )}

                {session.status === 'completed' ? (
                  <button
                    onClick={() => onViewReport(session.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Report</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onResumeSession(session.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                  >
                    <span>Resume</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setSessionToDelete(session)}
                  title="Xóa bài thi này"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-500/15 dark:bg-slate-800 dark:hover:bg-rose-500/25 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700/60 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(sessionToDelete)}
        session={sessionToDelete}
        deleting={deleting}
        onClose={() => setSessionToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

    </div>
  );
};
