import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dailyApi, historyApi, libraryApi } from '../api/client';
import {
  Flame,
  BookOpen,
  ArrowRight,
  Mic,
  Sparkles,
  CheckCircle2,
  Headphones,
  Home,
  Music,
  Globe,
  MessageCircle,
  Wand2,
  ShieldCheck,
  Shuffle,
} from 'lucide-react';
import { WeekDots } from '../components/DailyChallengeCard';
import { computeUnifiedStreak } from '../utils/studyStreak';
import { useLanguage } from '../context/LanguageContext';

const OFFICIAL_IDS = ['environment', 'human_rights', 'global_workplace', 'socio_cultural', 'communication_media'];

const GROUP_CARDS = [
  { key: 'home', labelVi: 'Nền tảng', labelEn: 'Background', icon: Home, grad: 'from-amber-500 to-orange-500', bar: 'bg-amber-500', tint: 'hover:border-amber-300 dark:hover:border-amber-500/40' },
  { key: 'leisure', labelVi: 'Sở thích', labelEn: 'Leisure', icon: Music, grad: 'from-violet-500 to-fuchsia-500', bar: 'bg-violet-500', tint: 'hover:border-violet-300 dark:hover:border-violet-500/40' },
  { key: 'official', labelVi: 'Chủ đề chính', labelEn: 'Core Topics', icon: Globe, grad: 'from-emerald-500 to-teal-500', bar: 'bg-emerald-500', tint: 'hover:border-emerald-300 dark:hover:border-emerald-500/40' },
  { key: 'role_play', labelVi: 'Role-play', labelEn: 'Role-play', icon: MessageCircle, grad: 'from-sky-500 to-blue-600', bar: 'bg-sky-500', tint: 'hover:border-sky-300 dark:hover:border-sky-500/40' },
  { key: 'unexpected', labelVi: 'Đột xuất', labelEn: 'Unexpected', icon: Sparkles, grad: 'from-rose-500 to-pink-500', bar: 'bg-rose-500', tint: 'hover:border-rose-300 dark:hover:border-rose-500/40' },
  { key: 'custom', labelVi: 'Tự thêm', labelEn: 'Custom', icon: Wand2, grad: 'from-indigo-500 to-cyan-500', bar: 'bg-indigo-500', tint: 'hover:border-indigo-300 dark:hover:border-indigo-500/40' },
];

const groupOf = (cat) => {
  if (OFFICIAL_IDS.includes(cat)) return 'official';
  if (['home', 'leisure', 'role_play', 'unexpected', 'custom'].includes(cat)) return cat;
  return 'leisure';
};

const MasteryRing = ({ mastered, total }) => {
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative w-14 h-14 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_12px_rgba(45,212,191,0.35)]" viewBox="0 0 84 84">
        <defs>
          <linearGradient id="masteryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle cx="42" cy="42" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="7" fill="none" />
        <circle
          cx="42"
          cy="42"
          r={r}
          stroke="url(#masteryGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs sm:text-lg font-extrabold text-white leading-none">{pct}%</span>
        <span className="text-[9px] sm:text-[10px] text-sky-200/80 mt-0.5 font-semibold">
          {mastered}/{total}
        </span>
      </div>
    </div>
  );
};

export const Dashboard = ({
  onStartTest,
  onOpenLibrary,
  onOpenLibraryGroup,
  onOpenFlashcards,
  onOpenRandomPractice,
  onOpenMockCenter,
}) => {
  const { user } = useAuth();
  const { isVi, pick } = useLanguage();
  const [backendStreakDays, setBackendStreakDays] = useState([]);
  const [sessionDates, setSessionDates] = useState([]);
  const [masterQuestions, setMasterQuestions] = useState([]);
  const [masterLevel, setMasterLevel] = useState('IM');
  const [startingMode, setStartingMode] = useState(null);

  useEffect(() => {
    libraryApi
      .get()
      .then((res) => {
        const pack = (res.data || []).find((s) => s.is_study_pack);
        if (pack) {
          setMasterQuestions(pack.questions || []);
          setMasterLevel(pack.default_model_level || 'IM');
        }
      })
      .catch(() => {});

    dailyApi
      .today()
      .then((res) => setBackendStreakDays(res.data?.streak?.last_7_days || []))
      .catch(() => {});

    historyApi
      .getHistory()
      .then((res) => setSessionDates((res.data || []).map((s) => s.started_at)))
      .catch(() => {});
  }, []);

  const streak = useMemo(
    () => computeUnifiedStreak(backendStreakDays, sessionDates),
    [backendStreakDays, sessionDates]
  );

  const masterSummary = useMemo(() => {
    const total = masterQuestions.length;
    const mastered = masterQuestions.filter((q) => q.study_status === 'mastered').length;
    const due = masterQuestions.filter((q) => q.is_due_today).length;
    const byGroup = {};
    masterQuestions.forEach((q) => {
      const k = groupOf(q.category);
      if (!byGroup[k]) byGroup[k] = { total: 0, mastered: 0 };
      byGroup[k].total += 1;
      if (q.study_status === 'mastered') byGroup[k].mastered += 1;
    });
    return { total, mastered, due, level: masterLevel, byGroup };
  }, [masterQuestions, masterLevel]);

  const handleQuickTest = async (mode) => {
    if (startingMode) return;
    setStartingMode(mode);
    try {
      await onStartTest(mode);
    } finally {
      setStartingMode(null);
    }
  };

  const firstName = (user?.full_name || user?.email || 'bạn').split(' ').slice(-1)[0];
  const activeGroups = GROUP_CARDS.filter((g) => (masterSummary.byGroup[g.key]?.total || 0) > 0);
  const masteredPct = masterSummary.total > 0 ? Math.round((masterSummary.mastered / masterSummary.total) * 100) : 0;

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 overflow-y-auto overscroll-contain lg:static lg:inset-auto lg:z-auto lg:h-full lg:overflow-hidden w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[840px] lg:my-auto flex flex-col gap-2.5 sm:gap-4 lg:gap-5">
        {/* Compact Luminous Dark-Studio Hero Card */}
        <div className="studio-surface rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-xl shadow-indigo-950/20 relative overflow-hidden shrink-0">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-indigo-500/25 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 -bottom-20 w-56 h-56 rounded-full bg-teal-400/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="hidden sm:block relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-teal-400 p-[2px] shadow-lg shadow-sky-500/30 shrink-0">
                <div className="w-full h-full rounded-[14px] bg-[#0b1120] flex flex-col items-center justify-center">
                  <Headphones className="w-7 h-7 text-sky-300" />
                  <div className="flex items-end gap-0.5 mt-1 h-2.5">
                    <span className="w-0.5 bg-indigo-400 rounded-full h-1.5 animate-pulse" />
                    <span className="w-0.5 bg-sky-300 rounded-full h-2.5 animate-pulse" />
                    <span className="w-0.5 bg-teal-300 rounded-full h-1.5 animate-pulse" />
                    <span className="w-0.5 bg-emerald-300 rounded-full h-2 animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                  <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] sm:text-[11px] font-bold text-teal-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    {pick(`Mục tiêu ${masterSummary.level}`, `Target ${masterSummary.level}`)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[10px] sm:text-[11px] font-bold">
                    <Flame className="w-3 h-3 text-amber-400" />
                    {streak.current} {pick('ngày', 'days')}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[11px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {pick('Thuộc', 'Mastered')} {masterSummary.mastered}/{masterSummary.total}
                  </span>
                </div>
                <h1 className="text-base sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  {pick(`Chào ${firstName}`, `Hi ${firstName}`)}
                  <span className="hidden sm:inline">{pick(', hôm nay luyện gì?', ', ready to practice?')}</span>
                  <span className="sm:hidden">!</span>
                </h1>
                <p className="hidden sm:block text-xs text-slate-300 mt-1 leading-snug max-w-xl">
                  {masterSummary.total > 0
                    ? pick(
                        'Bấm nói ngẫu nhiên 1 câu để giữ phản xạ thật, ôn thuộc bài mẫu hoặc vào thi mô phỏng 15 câu cùng Eva.',
                        'Jump into random speaking practice, recall full model scripts, or run a 15-question mock exam with Eva.'
                      )
                    : pick(
                        'Bắt đầu chọn toàn bộ chủ đề cần thi trong Kho ôn tập hoặc vào ngay bài thi mô phỏng cùng Eva.',
                        'Build your personal topic bank in Study Hub or launch a 15-question mock simulation with Eva.'
                      )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex flex-col items-center gap-1 cursor-pointer group shrink-0"
              title={pick('Mở Kho ôn tập', 'Open Study Hub')}
            >
              <div className="group-hover:scale-105 transition-transform">
                <MasteryRing mastered={masterSummary.mastered} total={masterSummary.total} />
              </div>
              <span className="hidden sm:inline text-[11px] font-bold text-sky-300 group-hover:text-white transition-colors">
                {pick('Mở kho ôn tập →', 'Open Study Hub →')}
              </span>
            </button>
          </div>
        </div>

        {/* Symmetrical 2-Column Core Studio Cards (Zero-Scroll iPhone 11 + Balanced Laptop) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
          {/* Card 1: Master Curriculum + Random Blind Speaking + SRS Flashcards */}
          <div className="glass-card rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between gap-2.5 sm:gap-4">
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                        {pick('Kho ôn tập', 'Study Hub')}
                        <span className="hidden sm:inline">{pick(' & Phản xạ', ' & Drills')}</span>
                      </h2>
                      <span className="hidden sm:block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {pick('Nói ngẫu nhiên · Ôn thuộc bài mẫu · Nghe MP3', 'Random Speaking · Script Recall · MP3 Audio')}
                      </span>
                    </div>
                  </div>
                  {masterSummary.due > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-extrabold shadow-xs shrink-0">
                      {masterSummary.due} {pick('đến hạn', 'due')}
                    </span>
                  ) : (
                    <span className="sm:hidden px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-500/30 text-[10px] font-extrabold shrink-0">
                      {masterSummary.total} {pick('câu', 'Qs')}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="hidden sm:block">
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {masterSummary.total === 0
                        ? pick('Khởi tạo kho chủ đề', 'Create your topic bank')
                        : masterSummary.due > 0
                          ? pick(`${masterSummary.due} câu sắp quên`, `${masterSummary.due} cards due today`)
                          : pick(`${masterSummary.total - masterSummary.mastered} câu đang luyện`, `${masterSummary.total - masterSummary.mastered} in progress`)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                      {masterSummary.total === 0
                        ? pick('Chọn không giới hạn chủ đề — 1 bài mẫu gốc cân mọi cách hỏi.', 'Pick unlimited OPIc topics — one master script handles every prompt variant.')
                        : pick('Bốc 1 câu ngẫu nhiên ẩn đề để luyện phản xạ nói hoặc tự nhẩm ôn thuộc bài mẫu.', 'Draw a random blind question for speaking reflexes or practice recalling full model scripts.')}
                    </p>
                  </div>

                  <WeekDots days={streak.last_7_days} />
                </div>

                {masterSummary.total > 0 && (
                  <div className="hidden sm:flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>{pick('Tiến độ thuộc', 'Mastery progress')}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{masteredPct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${masteredPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={masterSummary.total > 0 && onOpenRandomPractice ? onOpenRandomPractice : onOpenLibrary}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/15 hover:bg-violet-100 dark:hover:bg-violet-500/25 text-violet-700 dark:text-violet-200 border border-violet-200/90 dark:border-violet-500/35 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Shuffle className="w-3.5 h-3.5 shrink-0" />
                  <span>{masterSummary.total === 0 ? pick('Chọn đề', 'Pick Topics') : pick('Ngẫu nhiên', 'Random')}</span>
                </button>
                <button
                  type="button"
                  onClick={masterSummary.total > 0 && onOpenFlashcards ? onOpenFlashcards : onOpenLibrary}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl btn-speak-gradient text-xs font-extrabold cursor-pointer whitespace-nowrap"
                >
                  <span>{masterSummary.total === 0 ? pick('Mở kho', 'Open Hub') : pick('Ôn bài mẫu', 'Script Recall')}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Full 15-Question OPIc Simulation */}
          <div className="glass-card rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-400" />
            <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between gap-2.5 sm:gap-4">
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                      <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                        {pick('Thi mô phỏng OPIc', 'OPIc Mock Exam')}
                      </h2>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-sky-400">
                        {pick('Chuẩn ACTFL · Chấm AI', 'ACTFL Rubric · AI Grading')}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-sky-300 border border-indigo-200 dark:border-sky-500/30 text-[10px] font-extrabold shrink-0">
                    {pick('15 câu', '15 Qs')}
                  </span>
                </div>

                <div className="hidden sm:block">
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {pick('Đánh giá năng lực toàn diện', 'Full Proficiency Simulation')}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                    {pick(
                      'Trải nghiệm đủ combo chủ đề, Role-play Q11–Q13 và câu đột xuất cùng giám khảo ảo Eva, kèm biểu đồ radar 6 tiêu chí và báo cáo PDF.',
                      'Experience topic combos, Q11–Q13 role-plays, and unexpected prompts with Eva, plus a 6-criteria radar chart and PDF report.'
                    )}
                  </p>
                </div>

                <div className="hidden sm:flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    {pick('Thi thật & Bộ đề', 'Real Exam & Study Pack')}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    {pick('Chấm & nâng cấp AI', 'AI Scoring & Coaching')}
                  </span>
                </div>
              </div>

              <div className="pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  disabled={!!startingMode}
                  onClick={() => (onOpenMockCenter ? onOpenMockCenter() : handleQuickTest('exam'))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl btn-brand-gradient text-xs font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <span>{pick('Thi thử', 'Mock Test')}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Topic Progress Strip: Strictly 4 compact tiles on Mobile (2x2), All groups on sm+/lg+ */}
        {activeGroups.length > 0 && (
          <div className="flex flex-col gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {pick('Nhóm chủ đề', 'Topic Groups')}
              </h2>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="text-xs font-bold text-indigo-600 dark:text-sky-400 hover:underline cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>{pick('Xem tất cả', 'View all')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              className={`grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 ${
                activeGroups.length <= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-6'
              }`}
            >
              {activeGroups.map((g, idx) => {
                const Icon = g.icon;
                const st = masterSummary.byGroup[g.key] || { total: 0, mastered: 0 };
                const pct = st.total > 0 ? Math.round((st.mastered / st.total) * 100) : 0;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => (onOpenLibraryGroup ? onOpenLibraryGroup(g.key) : onOpenLibrary())}
                    className={`${idx >= 4 ? 'hidden sm:flex' : 'flex'} glass-card rounded-2xl p-2 sm:p-3 text-left flex-row sm:flex-col items-center sm:items-stretch justify-between gap-2 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${g.tint}`}
                  >
                    <div className="flex items-center justify-between gap-2 shrink-0 sm:w-full">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br ${g.grad} text-white flex items-center justify-center shadow-sm shrink-0`}>
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <span className="hidden sm:inline text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                        {st.mastered}/{st.total}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{isVi ? g.labelVi : g.labelEn}</p>
                        <span className="sm:hidden text-[10px] font-extrabold text-slate-500 dark:text-slate-400 shrink-0">
                          {st.mastered}/{st.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${g.bar} transition-all duration-500`}
                          style={{ width: `${Math.max(pct, st.mastered > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
