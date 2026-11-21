import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  BookOpen,
  ArrowRight,
  Loader2,
  Headphones,
  Clock,
  CheckCircle2,
  Mic,
  FileBarChart2,
} from 'lucide-react';
import { libraryApi, sessionApi, formatApiError } from '../api/client';
import { notify } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { USER_DEFAULT_PRESET } from './Survey';

export const MockTestCenter = ({ onStartTest, onStartPackExam, onOpenLibrary }) => {
  const { pick } = useLanguage();
  const [masterPack, setMasterPack] = useState(null);
  const [starting, setStarting] = useState(null);

  useEffect(() => {
    libraryApi
      .get()
      .then((res) => {
        const pack = (res.data || []).find((s) => s.is_study_pack);
        setMasterPack(pack || null);
      })
      .catch(() => {});
  }, []);

  const handleStartBlock = async (blockKey) => {
    if (starting) return;
    setStarting(blockKey);
    try {
      if (blockKey === 'pack') {
        await onStartTest('practice', 'pack');
      } else {
        await onStartTest('exam', 'ai');
      }
    } finally {
      setStarting(null);
    }
  };

  // Local DEV shortcut: create a full 15-question mock session in 1 click without calling OpenAI
  const handleDevInstantTest = async (blockKey) => {
    if (!import.meta.env.DEV || starting || !onStartPackExam) return;
    setStarting(`dev_${blockKey}`);
    try {
      if (blockKey === 'pack' && masterPack) {
        const { data } = await libraryApi.startExamFromPack(masterPack.session_id, 'practice');
        notify.success('Đã lọc nhanh 15 câu từ Kho ôn tập (chế độ hiện đề & chấm từng câu).');
        onStartPackExam(data.session_id, 'practice');
        return;
      }
      const mode = blockKey === 'pack' ? 'practice' : 'exam';
      const { data: created } = await sessionApi.create({ mode, survey_data: USER_DEFAULT_PRESET });
      await sessionApi.submitTopics(created.id, {
        topics: ['environment', 'socio_cultural', 'communication_media'],
      });
      await sessionApi.submitSelfAssessment(created.id, {
        level: 4,
        strict_mode: mode === 'exam',
        use_ai: false,
      });
      notify.success(`Đã tạo nhanh đề thi giả lập (${mode === 'exam' ? 'Thi thật' : 'Bộ đề'}).`);
      onStartPackExam(created.id, mode);
    } catch (err) {
      notify.error(formatApiError(err, 'Không tạo được phiên DEV giả lập.'));
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 overflow-y-auto overscroll-contain lg:static lg:inset-auto lg:z-auto lg:h-full lg:overflow-hidden w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[820px] lg:my-auto flex flex-col gap-3 sm:gap-4 lg:gap-5">
        {/* Crisp Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 shrink-0">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
              <Mic className="w-3.5 h-3.5" />
              {pick('Phòng thi mô phỏng Eva AI', 'Eva AI Exam Studio')}
            </span>
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              {pick('Thi thử OPIc', 'OPIc Mock Test')}
            </h1>
          </div>
          <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
            {pick('Chọn thi đề AI mới chuẩn phòng thi hoặc thi kiểm tra độ thuộc từ bộ đề của bạn.', 'Take a full AI exam simulation or test yourself with 15 filtered questions from your Study Pack.')}
          </p>
        </div>

        {/* Clean 2-Block Core Layout: 1 Unified Button Per Block */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
          {/* Block 1: Real OPIc Simulation */}
          <div className="studio-surface rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-left flex flex-col justify-between gap-3.5 sm:gap-5 shadow-xl shadow-indigo-950/20 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight truncate">
                      {pick('Thi thật', 'Real Exam')}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300/90">
                      <Clock className="w-3 h-3 shrink-0" />
                      {pick('Đề AI mới · 15 câu · ~30 phút', 'Fresh AI Set · 15 Qs · ~30m')}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 text-[10px] sm:text-[11px] font-extrabold shrink-0 whitespace-nowrap">
                  {pick('Ẩn đề · Chấm cuối', 'Blind · Final Score')}
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                {pick(
                  'Chọn khảo sát, 3 chủ đề & mức độ để Eva tạo đề 15 câu mới. Câu hỏi được ẩn như phòng thi thật và chấm điểm chi tiết từng câu ở cuối bài.',
                  'Complete the survey, 3 topics, and level check so Eva builds a fresh 15-question exam. Prompts stay hidden and every answer is graded in your final report.'
                )}
              </p>

              <div className="hidden sm:flex flex-wrap gap-1.5">
                {(pick(
                  ['Ẩn chữ câu hỏi', 'Nghe lại 5 giây', 'Chấm từng câu ở cuối', 'Báo cáo PDF'],
                  ['Hidden prompts', '5s replay window', 'End-of-exam grading', 'PDF report']
                )).map((feat) => (
                  <span
                    key={feat}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 text-[11px] font-semibold"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    {feat}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative z-10 pt-3 border-t border-white/15">
              <button
                type="button"
                disabled={!!starting}
                onClick={() => handleStartBlock('exam')}
                className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl btn-speak-gradient text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {starting === 'exam' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{pick('Bắt đầu', 'Start')}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Block 2: Filter 15 Questions from Learner's Study Pack */}
          <div className="glass-card rounded-2xl sm:rounded-3xl overflow-hidden text-left flex flex-col justify-between transition-all hover:shadow-xl border-indigo-200/80 dark:border-sky-500/30">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-400" />
            <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between gap-3.5 sm:gap-5">
              <div className="flex flex-col gap-2.5 sm:gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                      <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                        {pick('Thi từ bộ đề', 'From Study Pack')}
                      </h2>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-sky-400">
                        {masterPack
                          ? pick(`Lọc 15/${masterPack.questions.length} câu đã học`, `Filter 15/${masterPack.questions.length} saved Qs`)
                          : pick('Chưa tạo bộ đề', 'No study pack yet')}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-200 dark:border-sky-500/30 text-indigo-700 dark:text-sky-300 text-[10px] sm:text-[11px] font-extrabold shrink-0 whitespace-nowrap">
                    {pick('Hiện đề · Chấm ngay', 'Visible · Instant Grade')}
                  </span>
                </div>

                <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {masterPack
                    ? pick(
                        'Đi qua các bước chọn khảo sát, chủ đề & mức độ để lọc đúng 15 câu khớp nhất từ bộ đề sẵn có. Hiện câu hỏi, dịch và chấm chữa ngay sau từng câu.',
                        'Walk through the same survey, topic, and level steps to filter 15 matching questions from your Study Pack. Prompts stay visible with instant per-question AI grading.'
                      )
                    : pick(
                        'Tạo Kho ôn tập chủ đề trước để lọc bộ đề thi 15 câu sát 100% những câu bạn đang học.',
                        'Create a Study Pack in Study Hub first to filter 15 exam questions directly from what you study.'
                      )}
                </p>

                <div className="hidden sm:flex flex-wrap gap-1.5">
                  {(pick(
                    ['Chọn bước như thi thật', 'Lọc từ kho có sẵn', 'Hiện đề & Dịch', 'Chấm ngay từng câu'],
                    ['Same setup steps', 'Filtered from Study Pack', 'Visible prompts', 'Instant AI grading']
                  )).map((feat) => (
                    <span
                      key={feat}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                    >
                      <CheckCircle2 className="w-3 h-3 text-indigo-500 dark:text-sky-400 shrink-0" />
                      {feat}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/60">
                {masterPack ? (
                  <button
                    type="button"
                    disabled={!!starting}
                    onClick={() => handleStartBlock('pack')}
                    className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl btn-brand-gradient text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {starting === 'pack' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>{pick('Bắt đầu', 'Start')}</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenLibrary}
                    className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl btn-brand-gradient text-xs sm:text-sm font-extrabold cursor-pointer whitespace-nowrap"
                  >
                    <span>{pick('Mở kho', 'Open Hub')}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Compact 3-Step Exam Structure Overview (Desktop / Tablet only) */}
        <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-3.5 shrink-0">
          {[
            {
              step: '01',
              title: pick('Khảo sát & Mức độ', 'Survey & Level'),
              desc: pick('Chọn chủ đề khảo sát và mức tự đánh giá Level 3–6 để Eva tạo hoặc lọc đề.', 'Pick survey topics and Level 3–6 so Eva builds or filters your set.'),
              icon: Headphones,
              grad: 'from-indigo-500 to-blue-500',
            },
            {
              step: '02',
              title: pick('15 câu Combo + Role-play', '15 Combo + Role-play Qs'),
              desc: pick('Q1 tự giới thiệu (không chấm), 3 combo chủ đề, Role-play Q11–Q13 và 2 câu đột xuất.', 'Unscored Q1 intro, 3 topic combos, Q11–Q13 role-play, and 2 unexpected questions.'),
              icon: Mic,
              grad: 'from-sky-500 to-teal-500',
            },
            {
              step: '03',
              title: pick('Chẩn đoán ACTFL & PDF', 'ACTFL Diagnosis & PDF'),
              desc: pick('Biểu đồ radar 6 tiêu chí, phân tích thì, sự cố bất ngờ và lộ trình cải thiện.', '6-criteria radar chart, tense tracking, complications check, and 4-week study plan.'),
              icon: FileBarChart2,
              grad: 'from-emerald-500 to-teal-500',
            },
          ].map(({ step, title, desc, icon: Icon, grad }) => (
            <div key={step} className="glass-card rounded-2xl p-3.5 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-extrabold text-indigo-600 dark:text-sky-400">{step}</span>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{title}</h3>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Local-Only DEV Instant Simulation Bar (compiled out in production builds) */}
        {import.meta.env.DEV && (
          <div className="rounded-2xl px-3.5 py-2 border border-dashed border-amber-400/80 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] sm:text-xs font-bold text-amber-900 dark:text-amber-200">
              <span className="sm:hidden">DEV · Tạo nhanh 15 câu</span>
              <span className="hidden sm:inline">DEV (chỉ hiện ở local): Tạo nhanh bài thi 15 câu giả lập toàn bộ để kiểm tra giao diện</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!!starting}
                onClick={() => handleDevInstantTest('exam')}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {starting === 'dev_exam' ? 'Đang tạo...' : 'DEV · Thi thật'}
              </button>
              <button
                type="button"
                disabled={!!starting}
                onClick={() => handleDevInstantTest('pack')}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {starting === 'dev_pack' ? 'Đang tạo...' : 'DEV · Bộ đề'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
