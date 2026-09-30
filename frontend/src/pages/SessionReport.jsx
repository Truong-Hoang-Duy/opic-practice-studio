import React, { useState, useEffect } from 'react';
import { sessionApi } from '../api/client';
import { 
  Award, 
  Download, 
  Calendar, 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  FileText,
  ArrowRight,
  Flame
} from 'lucide-react';
import { RadarChart } from '../components/RadarChart';
import { ViTooltip } from '../components/Tooltip';

export const SessionReport = ({ sessionId, onReturnHome }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await sessionApi.getReport(sessionId);
        setReport(res.data);
      } catch (err) {
        console.error("Failed to load session report", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Compiling 15-question diagnostic analysis & generating PDF...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center text-slate-400">
        <p>No report available for this session.</p>
        <button onClick={onReturnHome} className="mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs">
          Return to Studio Home
        </button>
      </div>
    );
  }

  const {
    overall_level,
    justification,
    radar_scores,
    per_question_summary,
    frequent_mistakes,
    strengths,
    weaknesses,
    study_plan,
    pdf_path
  } = report;

  const isIH = overall_level === 'IH';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      
      {/* Top Banner with Overall Level */}
      <div className="glass-panel rounded-3xl p-8 border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-50/90 via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40 shadow-md dark:shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">OPIc Diagnostic Assessment</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-500">Session #{sessionId}</span>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Final Proficiency Assessment
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 max-w-xl mt-2 leading-relaxed font-medium">
            {justification}
          </p>

          <div className="flex items-center gap-3 mt-4">
            {pdf_path && (
              <a
                href={pdf_path}
                target="_blank"
                rel="noreferrer"
                download
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export PDF Diagnostic Report</span>
              </a>
            )}

            <button
              onClick={onReturnHome}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Studio Home
            </button>
          </div>
        </div>

        {/* Level Badge Circle */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-brand-500/30 shadow-lg dark:shadow-xl shrink-0 min-w-[180px]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Assessed Level</span>
          <div className={`text-4xl font-black ${isIH ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`}>
            {overall_level}
          </div>
          <span className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-semibold">
            {overall_level === 'IH' ? 'Intermediate High' : overall_level === 'IM' ? 'Intermediate Mid' : overall_level === 'IL' ? 'Intermediate Low' : overall_level === 'AL' ? 'Advanced Low' : overall_level}
          </span>
          <div className="mt-3 flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>ACTFL Compliant Rater</span>
          </div>
        </div>
      </div>

      {/* 2-Column: Radar Chart + Strengths & Areas for Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Radar Chart */}
        <div className="lg:col-span-6 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col items-center shadow-sm">
          <div className="w-full flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>6 Core Criteria Radar</span>
            </h2>
            <ViTooltip vi="Biểu đồ đa giác thể hiện 6 tiêu chí cốt lõi của ACTFL OPIc so với đường chuẩn (4.0).">
              <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold">Target Line: 4.0</span>
            </ViTooltip>
          </div>

          <RadarChart scores={radar_scores} size={300} />
        </div>

        {/* Observations: Strengths & Weaknesses */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Strengths */}
          <div className="glass-card bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl p-5 border border-emerald-300/80 dark:border-emerald-500/20 flex flex-col gap-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Key Strengths Observed</span>
            </h3>
            <div className="space-y-2">
              {strengths?.map((str, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                  <span>{str}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="glass-card bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl p-5 border border-amber-300/80 dark:border-amber-500/20 flex flex-col gap-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Primary Obstacles to Reach IH</span>
            </h3>
            <div className="space-y-2">
              {weaknesses?.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Per-Question Summary Table */}
      {per_question_summary && per_question_summary.length > 0 && (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>15-Question Performance Matrix</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Topic</th>
                  <th className="py-2.5 px-3">Level</th>
                  <th className="py-2.5 px-3 text-center">Fluency</th>
                  <th className="py-2.5 px-3 text-center">Tenses</th>
                  <th className="py-2.5 px-3 text-center">Org</th>
                  <th className="py-2.5 px-3 text-center">Vocab</th>
                  <th className="py-2.5 px-3 text-center">Grammar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-300">
                {per_question_summary.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">Q{row.question_num}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{row.topic}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        row.estimated_level === 'IH' 
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' 
                          : 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
                      }`}>
                        {row.estimated_level}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-medium">{row.score_fluency}/5</td>
                    <td className="py-2 px-3 text-center font-medium">{row.score_tenses}/5</td>
                    <td className="py-2 px-3 text-center font-medium">{row.score_organization}/5</td>
                    <td className="py-2 px-3 text-center font-medium">{row.score_vocabulary}/5</td>
                    <td className="py-2 px-3 text-center font-medium">{row.score_grammar}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suggested 4-Week Study Plan */}
      {study_plan && study_plan.weekly_focus && (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{study_plan.title || '4-Week Action Plan'}</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tailored for Vietnamese candidates</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {study_plan.weekly_focus.map((weekItem, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 shadow-xs">
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
                    Week {weekItem.week}
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-2 leading-snug">{weekItem.theme}</h3>
                  <div className="space-y-1 mt-2">
                    {weekItem.activities?.map((act, i) => (
                      <p key={i} className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight font-normal">• {act}</p>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  Goal: {weekItem.target_outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
