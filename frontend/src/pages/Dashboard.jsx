import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { historyApi, sessionApi } from '../api/client';
import { Play, Sparkles, Clock, CheckCircle, BarChart3, ArrowRight, ShieldCheck, Flame } from 'lucide-react';
import { ViTooltip } from '../components/Tooltip';

export const Dashboard = ({ onStartTest, onResumeSession, onViewReport }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-panel bg-gradient-to-r from-sky-50/90 via-emerald-50/40 to-slate-100/90 dark:from-slate-900 dark:via-slate-900/95 dark:to-sky-950/40 p-8 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl transition-colors">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-3">
            <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Mô phỏng Thi Thử Chuẩn ACTFL OPIc</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Welcome, <span className="text-brand-600 dark:text-brand-400">{user?.full_name || 'Candidate'}</span>!
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed font-medium">
            Ready to simulate the official 15-question OPIc interview flow with AI Examiner Eva? Focus on paragraph-length storytelling, past tense consistency, and handling unexpected complications to secure your IH rating.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <button
              onClick={() => onStartTest('practice')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white font-semibold text-sm shadow-xl shadow-sky-500/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Start Practice Mode (Coached)</span>
            </button>

            <button
              onClick={() => onStartTest('exam')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-200 font-semibold text-sm border border-slate-700 transition-all transform active:scale-95 cursor-pointer shadow-md"
            >
              <Play className="w-4 h-4 text-emerald-400" />
              <span>Take Full Exam Simulation</span>
            </button>
          </div>
        </div>

        {/* Decorative Badge */}
        <div className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 flex-col items-center justify-center w-48 h-48 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-sky-500/20 p-4 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Goal Rating</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">ACTFL IH</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-1">Paragraph Discourse & Tenses</span>
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
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
