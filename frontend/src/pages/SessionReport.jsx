import React, { useState, useEffect } from 'react';
import { sessionApi, resolveMediaUrl } from '../api/client';
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
  Flame,
  Trophy,
  XCircle
} from 'lucide-react';
import { RadarChart } from '../components/RadarChart';
import { ViTooltip } from '../components/Tooltip';
import { SpeakButton } from '../components/SpeakButton';
import { useLanguage } from '../context/LanguageContext';

export const SessionReport = ({ sessionId, onReturnHome }) => {
  const { lang, isVi, pick } = useLanguage();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await sessionApi.getReport(sessionId, lang);
        if (active) setReport(res.data);
      } catch (err) {
        console.error("Failed to load session report", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchReport();
    return () => { active = false; };
  }, [sessionId, lang]);

  if (loading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {pick(
            'Đang tổng hợp báo cáo chẩn đoán 15 câu & tạo PDF...',
            'Compiling 15-question diagnostic analysis & generating PDF...'
          )}
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center text-slate-500 dark:text-slate-400">
        <p>{pick('Không tìm thấy báo cáo cho bài thi này.', 'No report available for this session.')}</p>
        <button onClick={onReturnHome} className="mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold cursor-pointer">
          {pick('Về trang chủ', 'Return Home')}
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

  // The verdict is judged against the level the learner chose for this test (not a fixed IH goal)
  const LEVEL_RANK = { below_IL: 0, Novice: 0, IL: 1, IM: 2, IH: 3, AL: 4 };
  const LEVEL_NAME = isVi
    ? {
        Novice: 'Sơ cấp (Novice)',
        IL: 'Trung cấp Thấp (IL)',
        IM: 'Trung cấp Trung bình (IM)',
        IH: 'Trung cấp Cao (IH)',
        AL: 'Cao cấp (AL)',
        below_IL: 'Dưới IL',
      }
    : {
        Novice: 'Novice',
        IL: 'Intermediate Low (IL)',
        IM: 'Intermediate Mid (IM)',
        IH: 'Intermediate High (IH)',
        AL: 'Advanced Low (AL)',
        below_IL: 'Below IL',
      };
  const targetLevel = report.target_level || 'IM';
  const targetName = LEVEL_NAME[targetLevel] || targetLevel;
  const overallDisplay = overall_level === 'below_IL' ? pick('Dưới IL', 'Below IL') : overall_level;
  const overallFullName = LEVEL_NAME[overall_level] || overall_level;
  const isPassed = (LEVEL_RANK[overall_level] ?? 0) >= (LEVEL_RANK[targetLevel] ?? 2) || report.passed;

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col gap-4 sm:gap-6">
      
      {/* Big Impact Verdict: Pass / Fail Banner */}
      {isPassed ? (
        <div className="w-full rounded-3xl p-5 sm:p-7 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/15 border-2 border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-5 transition-all">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs sm:text-sm tracking-wide shadow-md">
                  {pick('KẾT QUẢ: ĐẠT', 'RESULT: PASSED')}
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {pick(`Đạt mức đã chọn: ${targetName}`, `Target met: ${targetName}`)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1.5 font-medium leading-relaxed">
                {pick(
                  `Chúc mừng bạn! Bạn đạt mức ${overallDisplay}, đáp ứng mục tiêu ${targetName} đã chọn cho bài thi này.`,
                  `Congratulations! You achieved ${overallDisplay}, meeting your chosen ${targetName} target for this exam.`
                )}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-center sm:text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {pick('Trạng thái', 'Status')}
            </span>
            <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {pick('ĐÃ ĐẠT MỤC TIÊU', 'TARGET ACHIEVED')}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full rounded-3xl p-5 sm:p-7 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 border-2 border-rose-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-5 transition-all">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 shrink-0">
              <XCircle className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-rose-600 text-white font-black text-xs sm:text-sm tracking-wide shadow-md">
                  {pick('KẾT QUẢ: CHƯA ĐẠT', 'RESULT: NOT YET MET')}
                </span>
                <span className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-400">
                  {pick(`Chưa đạt mức đã chọn: ${targetName}`, `Below target: ${targetName}`)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1.5 font-medium leading-relaxed">
                {pick(
                  `Bạn đạt mức ${overallFullName}, chưa đạt mục tiêu ${targetLevel} đã chọn. Xem phân tích lỗi và lộ trình 4 tuần bên dưới để cải thiện.`,
                  `You scored ${overallFullName}, below your chosen ${targetLevel} target. Review the diagnostic breakdown and 4-week plan below to level up.`
                )}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-center sm:text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              {pick('Trạng thái', 'Status')}
            </span>
            <div className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {pick('CẦN LUYỆN THÊM', 'NEEDS PRACTICE')}
            </div>
          </div>
        </div>
      )}

      {/* Top Banner with Overall Level */}
      <div className="glass-panel rounded-3xl p-5 sm:p-8 border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-50/90 via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40 shadow-md dark:shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {pick('Báo cáo chẩn đoán OPIc', 'OPIc Diagnostic Assessment')}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-500">
              {pick(`Bài thi #${report.session_number ?? sessionId}`, `Session #${report.session_number ?? sessionId}`)}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {pick('Đánh giá năng lực tổng kết', 'Final Proficiency Assessment')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-xl mt-2 leading-relaxed font-medium">
            {justification}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-4">
            {pdf_path && (
              <a
                href={pdf_path}
                target="_blank"
                rel="noreferrer"
                download
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-lg shadow-brand-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{pick('Xuất báo cáo PDF', 'Export PDF Report')}</span>
              </a>
            )}

            <button
              onClick={onReturnHome}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              {pick('Trang chủ', 'Home')}
            </button>
          </div>
        </div>

        {/* Level Badge Circle */}
        <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-brand-500/30 shadow-lg dark:shadow-xl shrink-0 min-w-[180px]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {pick('Mức đánh giá', 'Assessed Level')}
          </span>
          <div className={`text-4xl font-black ${isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {overallDisplay}
          </div>
          <span className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-semibold text-center">
            {overallFullName}
          </span>
          <span className={`mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
            isPassed 
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
          }`}>
            {isPassed ? pick('Đạt', 'Passed') : pick('Chưa đạt', 'Failed')}
          </span>
          <div className="mt-3 flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{pick('Chấm theo chuẩn ACTFL', 'ACTFL Rubric Rater')}</span>
          </div>
        </div>
      </div>

      {/* 2-Column: Radar Chart + Strengths & Areas for Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* Radar Chart */}
        <div className="lg:col-span-6 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 flex flex-col items-center shadow-sm">
          <div className="w-full flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>{pick('Biểu đồ 6 tiêu chí cốt lõi', '6 Core Criteria Radar')}</span>
            </h2>
            <ViTooltip vi={pick('Biểu đồ đa giác thể hiện 6 tiêu chí cốt lõi của ACTFL OPIc so với đường chuẩn (4.0).', 'Six ACTFL OPIc criteria plotted against the 4.0 benchmark.')}>
              <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold">
                {pick('Mốc chuẩn: 4.0', 'Target Line: 4.0')}
              </span>
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
              <span>{pick('Điểm mạnh nổi bật', 'Key Strengths Observed')}</span>
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
              <span>{pick(`Điểm cần khắc phục để đạt ${targetLevel}`, `Primary Obstacles to Reach ${targetLevel}`)}</span>
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
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{pick('Bảng chi tiết 15 câu hỏi', '15-Question Performance Matrix')}</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3 sm:min-w-[240px]">{pick('Câu hỏi', 'Question')}</th>
                  <th className="py-2.5 px-3">{pick('Mức', 'Level')}</th>
                  <th className="hidden sm:table-cell py-2.5 px-3 text-center">{pick('Trôi chảy', 'Fluency')}</th>
                  <th className="hidden sm:table-cell py-2.5 px-3 text-center">{pick('Thì', 'Tenses')}</th>
                  <th className="hidden sm:table-cell py-2.5 px-3 text-center">{pick('Bố cục', 'Org')}</th>
                  <th className="hidden sm:table-cell py-2.5 px-3 text-center">{pick('Từ vựng', 'Vocab')}</th>
                  <th className="hidden sm:table-cell py-2.5 px-3 text-center">{pick('Ngữ pháp', 'Grammar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-300">
                {per_question_summary.map((row, idx) => {
                  // Older reports have no status field: every row was a scored one
                  const status = row.status || 'scored';
                  const statusLabel = {
                    unscored: pick('Không chấm (khởi động)', 'Unscored (warm-up)'),
                    skipped: pick('Bỏ qua', 'Skipped'),
                    unanswered: pick('Chưa trả lời', 'Unanswered'),
                  }[status];
                  return (
                  <tr key={idx} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">Q{row.question_num}</td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-slate-900 dark:text-white">{row.topic}</div>
                        {row.question_text && (
                          <SpeakButton
                            text={row.question_text}
                            id={`report-q-${row.question_num}`}
                            label={pick('Nghe', 'Play')}
                            playingLabel={pick('Dừng', 'Stop')}
                          />
                        )}
                      </div>
                      {/* Question text ALWAYS remains in English */}
                      {row.question_text && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">"{row.question_text}"</p>
                      )}
                      {status === 'scored' && (
                        <p className="sm:hidden mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          {pick('TC', 'Flu')} {row.score_fluency} · {pick('Thì', 'Ten')} {row.score_tenses} · {pick('BC', 'Org')} {row.score_organization} · {pick('TV', 'Voc')} {row.score_vocabulary} · {pick('NP', 'Gra')} {row.score_grammar} <span className="text-slate-400">/5</span>
                        </p>
                      )}
                      {(row.transcript || row.audio_path) && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                            {pick('Câu trả lời của bạn', 'Your response')}
                          </summary>
                          {row.audio_path && (
                            <audio src={resolveMediaUrl(row.audio_path)} controls preload="none" className="mt-1 w-full max-w-sm h-8" />
                          )}
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                            {row.transcript || pick('Không nhận dạng được lời nói (chấm theo chuẩn: mức thấp nhất).', 'No speech detected (scored at the lowest band per OPIc rubric).')}
                          </p>
                        </details>
                      )}
                    </td>
                    {status === 'scored' ? (
                      <>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${
                            row.estimated_level === 'IH'
                              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                              : row.estimated_level === 'below_IL'
                              ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                              : 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
                          }`}>
                            {row.estimated_level === 'below_IL' ? pick('Dưới IL', 'Below IL') : row.estimated_level}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell py-2 px-3 text-center font-medium">{row.score_fluency}/5</td>
                        <td className="hidden sm:table-cell py-2 px-3 text-center font-medium">{row.score_tenses}/5</td>
                        <td className="hidden sm:table-cell py-2 px-3 text-center font-medium">{row.score_organization}/5</td>
                        <td className="hidden sm:table-cell py-2 px-3 text-center font-medium">{row.score_vocabulary}/5</td>
                        <td className="hidden sm:table-cell py-2 px-3 text-center font-medium">{row.score_grammar}/5</td>
                      </>
                    ) : (
                      <td colSpan={6} className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                          {statusLabel}
                        </span>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suggested 4-Week Study Plan */}
      {study_plan && study_plan.weekly_focus && (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{study_plan.title || pick('Lộ trình luyện tập 4 tuần', '4-Week Action Plan')}</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {pick('Cá nhân hóa cho học viên Việt Nam', 'Tailored for OPIc candidates')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {study_plan.weekly_focus.map((weekItem, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 shadow-xs">
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
                    {pick(`Tuần ${weekItem.week}`, `Week ${weekItem.week}`)}
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-2 leading-snug">{weekItem.theme}</h3>
                  <div className="space-y-1 mt-2">
                    {weekItem.activities?.map((act, i) => (
                      <p key={i} className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight font-normal">• {act}</p>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  {pick('Mục tiêu:', 'Goal:')} {weekItem.target_outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
