import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { historyApi, sessionApi } from '../api/client';
import { Play, Sparkles, Clock, CheckCircle, BarChart3, ArrowRight, Flame, Trash2 } from 'lucide-react';
import { ViTooltip } from '../components/Tooltip';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

export const Dashboard = ({ onStartTest, onResumeSession, onViewReport, onDeleteSession }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          historyApi.getStats(),
          historyApi.getHistory()
        ]);
        setStats(statsRes.data);
        setRecentSessions(historyRes.data.slice(0, 4));
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setDeleting(true);
    try {
      await sessionApi.delete(sessionToDelete.id);
      setRecentSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      if (onDeleteSession) {
        onDeleteSession(sessionToDelete.id);
      }
      setSessionToDelete(null);
      try {
        const statsRes = await historyApi.getStats();
        setStats(statsRes.data);
      } catch (e) {
        console.warn("Failed to refresh stats:", e);
      }
    } catch (err) {
      console.error("Failed to delete session", err);
      alert("Không thể xóa phiên thi. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-panel bg-gradient-to-r from-sky-50/90 via-emerald-50/40 to-slate-100/90 dark:from-slate-900 dark:via-slate-900/95 dark:to-sky-950/40 p-5 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl transition-colors">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-3">
            <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Mô phỏng Thi Thử Chuẩn ACTFL OPIc</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Welcome, <span className="text-brand-600 dark:text-brand-400">{user?.full_name || 'Candidate'}</span>!
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed font-medium">
            Ready to simulate the official 15-question OPIc interview flow with AI Examiner Eva? Focus on paragraph-length storytelling, past tense consistency, and handling unexpected complications to reach your target level.
          </p>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-6">
            <button
              onClick={() => onStartTest('practice')}
              className="group relative flex flex-col text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-brand-600 via-sky-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white shadow-xl shadow-sky-500/25 border border-sky-400/30 transition-all transform active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <span className="font-bold text-base text-white">Start Practice Mode</span>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-md">
                  Coached
                </span>
              </div>
              <p className="text-xs text-sky-100 leading-relaxed font-normal mt-1">
                Luyện tập có hướng dẫn: Bỏ qua kiểm tra hệ thống & survey, vào thẳng chọn chủ đề, xem đề bài & gợi ý tiếng Việt, nhảy câu tự do và nhận phân tích sửa lỗi / bài mẫu AI ngay sau mỗi câu.
              </p>
            </button>

            <button
              onClick={() => onStartTest('exam')}
              className="group relative flex flex-col text-left p-4 sm:p-5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20 border border-slate-700/80 transition-all transform active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <Play className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="font-bold text-base text-white">Take Full Exam Simulation</span>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Strict OPIc
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal mt-1">
                Mô phỏng thi thật 100%: Đầy đủ 5 bước kiểm tra thiết bị, khảo sát cá nhân, quy chế thi nghiêm ngặt (ẩn câu hỏi, đếm ngược 5s để nghe lại), kết thúc bài thi mới nhận báo cáo tổng thể chuẩn ACTFL.
              </p>
            </button>
          </div>
        </div>

      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
              <span>Total Tests</span>
              <BarChart3 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_sessions}</div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{stats.completed_sessions} completed</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
              <span>Answers Recorded</span>
              <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_answers}</div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Questions answered</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
              <span>Speaking Practice</span>
              <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_speaking_minutes} min</div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Total duration spoken</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
              <span>Mức Thi Gần Nhất</span>
              <Flame className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {recentSessions.length > 0 ? (recentSessions[0].session_report?.overall_level || `Level ${recentSessions[0].self_assessment_level || 4}`) : 'OPIc'}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {recentSessions.length > 0 ? 'Mức bài thi gần nhất' : 'Sẵn sàng thi thử'}
            </span>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Test Sessions</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Click a session to review diagnostic report or continue</span>
        </div>

        {recentSessions.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col items-center shadow-sm">
            <Clock className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No test sessions recorded yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Start your first practice test to experience the full 15-question flow and receive your diagnostic report.
            </p>
            <button
              onClick={() => onStartTest('practice')}
              className="mt-5 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs transition-colors cursor-pointer shadow-md"
            >
              Start Practice Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Session #{session.id}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                      session.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {session.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 mt-1">
                    <span>Mode: <strong className="capitalize text-slate-900 dark:text-white font-semibold">{session.mode}</strong></span>
                    <span>•</span>
                    <span>Answered: <strong className="text-slate-900 dark:text-white font-semibold">{session.answered_count} / {session.total_questions || 15}</strong></span>
                  </div>

                  {session.overall_level && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Awarded Level:</span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                        {session.overall_level}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(session.started_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSessionToDelete(session)}
                      title="Xóa phiên thi này"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {session.status === 'completed' ? (
                      <button
                        onClick={() => onViewReport(session.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                      >
                        <span>View Diagnostic Report</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onResumeSession(session.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        <span>Continue Test</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
