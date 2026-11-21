import React, { useState, useEffect } from 'react';
import { historyApi, sessionApi, libraryApi } from '../api/client';
import {
  Filter,
  Trash2,
  Calendar,
  FileText,
  ArrowRight,
  ClipboardList,
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  Headphones,
  TrendingUp,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { notify } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

const LEVEL_BADGE_STYLE = {
  IH: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-500/40',
  IM: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/70 dark:border-sky-500/40',
  IL: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/70 dark:border-amber-500/40',
  below_IL: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/70 dark:border-rose-500/40',
};

export const HistoryPage = ({ onViewReport, onResumeSession, onDeleteSession }) => {
  const { isVi, pick } = useLanguage();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [examLibraryById, setExamLibraryById] = useState({});
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { startListening } = useAudioPlayer();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [histRes, statsRes, libRes] = await Promise.all([
        historyApi.getHistory(),
        historyApi.getStats().catch(() => ({ data: null })),
        libraryApi.get().catch(() => ({ data: [] })),
      ]);
      setSessions(histRes.data || []);
      setStats(statsRes.data || null);
      const map = {};
      (libRes.data || []).forEach((item) => {
        if (!item.is_study_pack) map[item.session_id] = item;
      });
      setExamLibraryById(map);
    } catch (err) {
      console.error('Failed to load history', err);
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
      if (onDeleteSession) onDeleteSession(sessionToDelete.id);
      setSessionToDelete(null);
      notify.success('Đã xóa bài thi khỏi lịch sử.');
      historyApi.getStats().then((r) => setStats(r.data)).catch(() => {});
    } catch (err) {
      console.error('Failed to delete session', err);
      notify.error('Không thể xóa phiên thi. Vui lòng thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (levelFilter !== 'ALL' && s.overall_level !== levelFilter) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  const latestLevel =
    sessions.length > 0
      ? sessions[0].overall_level === 'below_IL'
        ? pick('Dưới IL', 'Below IL')
        : sessions[0].overall_level || pick(`Mức ${sessions[0].self_assessment_level || 4}`, `Level ${sessions[0].self_assessment_level || 4}`)
      : '—';

  return (
    <div className="w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 lg:h-full lg:min-h-0 lg:overflow-hidden flex flex-col gap-3.5 sm:gap-5">
      {/* Header + Compact Filters on the same top line */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 shrink-0">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
            <TrendingUp className="w-3.5 h-3.5" />
            {pick('Thống kê & Báo cáo ACTFL', 'ACTFL Analytics & Reports')}
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
            {pick('Tiến độ & Lịch sử', 'Progress & History')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 glass-card rounded-xl px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-indigo-500 dark:text-sky-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none text-xs font-bold cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">{pick('Mọi trình độ', 'All levels')}</option>
              <option value="IH" className="bg-white dark:bg-slate-900">IH</option>
              <option value="IM" className="bg-white dark:bg-slate-900">IM</option>
              <option value="IL" className="bg-white dark:bg-slate-900">IL</option>
              <option value="below_IL" className="bg-white dark:bg-slate-900">{pick('Dưới IL', 'Below IL')}</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 glass-card rounded-xl px-3 py-1.5 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none text-xs font-bold cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">{pick('Mọi trạng thái', 'All statuses')}</option>
              <option value="completed" className="bg-white dark:bg-slate-900">{pick('Đã hoàn thành', 'Completed')}</option>
              <option value="in_progress" className="bg-white dark:bg-slate-900">{pick('Đang làm dở', 'In progress')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Unified Vibrant KPI Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          {[
            {
              label: pick('Tổng bài thi', 'Total Exams'),
              value: stats.total_sessions,
              sub: pick(`${stats.completed_sessions} hoàn thành`, `${stats.completed_sessions} completed`),
              icon: BarChart3,
              grad: 'from-indigo-500 to-sky-500',
            },
            {
              label: pick('Câu đã trả lời', 'Answers Recorded'),
              value: stats.total_answers,
              sub: pick('Lượt ghi âm', 'Voice takes'),
              icon: CheckCircle2,
              grad: 'from-emerald-500 to-teal-500',
            },
            {
              label: pick('Thời lượng nói', 'Speaking Time'),
              value: `${stats.total_speaking_minutes}${pick('p', 'm')}`,
              sub: pick('Tổng thời gian', 'Total time'),
              icon: Clock,
              grad: 'from-amber-500 to-orange-500',
            },
            {
              label: pick('Mức gần nhất', 'Latest Level'),
              value: latestLevel,
              sub: pick('Kết quả mới nhất', 'Most recent'),
              icon: Flame,
              grad: 'from-rose-500 to-pink-500',
            },
          ].map(({ label, value, sub, icon: Icon, grad }) => (
            <div key={label} className="glass-card rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
                <div className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-tight">
                  {value}
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400">{sub}</span>
              </div>
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center shadow-md shrink-0`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Independently Scrollable Exam History List */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        {loading ? (
          <div className="min-h-[30vh] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {pick('Đang tải lịch sử...', 'Loading history...')}
            </p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-sky-400 flex items-center justify-center">
              <ClipboardList className="w-7 h-7" />
            </div>
            <p className="text-base font-extrabold text-slate-800 dark:text-slate-200">
              {pick('Chưa có bài thi nào', 'No mock exams yet')}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md">
              {pick(
                'Hoàn thành một bài thi thử 15 câu để xem báo cáo chẩn đoán ACTFL và nghe lại bài mẫu tại đây.',
                'Complete a 15-question mock exam to view your ACTFL diagnostic report and model answers here.'
              )}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-2">
            {filteredSessions.map((session) => {
              const libSet = examLibraryById[session.id];
              const badgeStyle = LEVEL_BADGE_STYLE[session.overall_level] || LEVEL_BADGE_STYLE.IM;
              return (
                <div
                  key={session.id}
                  className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-300 dark:hover:border-sky-500/40 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                        {pick(`Bài thi #${session.session_number ?? session.id}`, `Exam #${session.session_number ?? session.id}`)}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          session.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-500/30'
                        }`}
                      >
                        {session.status === 'completed' ? pick('Hoàn thành', 'Completed') : pick('Đang dở', 'In Progress')}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {session.mode === 'exam' ? pick('Thi thật', 'Real Exam') : pick('Bộ đề', 'Study Pack')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        {new Date(session.started_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')}
                      </span>
                      <span>·</span>
                      <span>
                        {pick(
                          `Đã nói ${session.answered_count}/${session.total_questions || 15} câu`,
                          `Answered ${session.answered_count}/${session.total_questions || 15}`
                        )}
                      </span>
                    </div>

                    {session.topics && session.topics.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {session.topics.map((t, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300"
                          >
                            {t.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {session.overall_level && (
                      <span className={`text-sm font-extrabold px-3 py-1 rounded-xl border mr-1 ${badgeStyle}`}>
                        {session.overall_level === 'below_IL' ? pick('Dưới IL', 'Below IL') : session.overall_level}
                      </span>
                    )}

                    {libSet && libSet.questions?.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          startListening({
                            session: libSet,
                            questionsToPlay: libSet.questions,
                            title: `${pick('Bài thi', 'Exam')} #${session.session_number ?? session.id} · ${libSet.default_model_level}`,
                          })
                        }
                        title={pick('Nghe bài mẫu đề này', 'Listen to model answers')}
                        className="p-2.5 rounded-xl bg-indigo-50 dark:bg-sky-500/15 text-indigo-600 dark:text-sky-300 border border-indigo-200/80 dark:border-sky-500/30 hover:bg-indigo-100 dark:hover:bg-sky-500/25 cursor-pointer transition-colors"
                      >
                        <Headphones className="w-4 h-4" />
                      </button>
                    )}

                    {session.status === 'completed' ? (
                      <button
                        type="button"
                        onClick={() => onViewReport(session.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-brand-gradient text-xs font-extrabold cursor-pointer whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{pick('Báo cáo', 'Report')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onResumeSession(session.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-speak-gradient text-xs font-extrabold cursor-pointer whitespace-nowrap"
                      >
                        <span>{pick('Làm tiếp', 'Resume')}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSessionToDelete(session)}
                      title={pick('Xóa bài thi', 'Delete exam')}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
