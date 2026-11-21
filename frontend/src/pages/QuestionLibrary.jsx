import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  Sparkles,
  Headphones,
  Download,
  Loader2,
  ArrowLeft,
  X,
  Trash2,
  RotateCcw,
  CheckCircle,
  FileText,
  Eye,
  EyeOff,
  BookOpen,
  Volume2,
  Play,
  Plus,
  Flame,
  Search,
  Pencil,
  Check,
  RefreshCw,
  AlertCircle,
  Clock,
  Home,
  Music,
  Globe,
  MessageCircle,
  Wand2,
  Layers,
  Tag,
  ChevronDown,
  Languages,
  Shuffle,
} from 'lucide-react';
import {
  libraryApi,
  questionApi,
  answerApi,
  resolveMediaUrl,
  formatApiError,
  recordingFileName,
} from '../api/client';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { AnswerCoaching } from './AnswerCoaching';
import { SpeakButton, SoundWaveMini } from '../components/SpeakButton';
import { TranslatableText } from '../components/TranslatableText';
import { RegenerateModal } from '../components/RegenerateModal';
import { FlashcardReview } from '../components/FlashcardReview';
import { VocabularyNotebook } from './VocabularyNotebook';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { speakPhrase, stopSpeaking } from '../utils/speakPhrase';
import { scrollPageToTop } from '../components/ScrollToTopButton';
import { recordStudyActivity } from '../utils/studyStreak';
import { confirmDialog, notify } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

const LEVELS = ['IL', 'IM', 'IH'];
const POLL_MS = 3000;
const SHOW_DEV_MOCK = import.meta.env.DEV;
const OFFICIAL_TOPIC_IDS = ['environment', 'human_rights', 'global_workplace', 'socio_cultural', 'communication_media'];

const TOPIC_GROUPS = [
  {
    key: 'home',
    label: 'Nền tảng',
    labelEn: 'Basics',
    icon: Home,
    grad: 'from-amber-400 to-orange-500',
    ribbon: 'from-amber-400 via-orange-500 to-amber-500',
    cardBg: 'bg-white/95 dark:bg-[#141e33]/90 border-slate-200/80 dark:border-slate-700/60 hover:border-amber-300 dark:hover:border-amber-500/40',
    activeRing: 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/90 dark:bg-amber-500/20',
    stroke: '#f59e0b',
  },
  {
    key: 'leisure',
    label: 'Sở thích',
    labelEn: 'Hobbies',
    icon: Music,
    grad: 'from-violet-500 to-fuchsia-500',
    ribbon: 'from-violet-500 via-purple-500 to-fuchsia-500',
    cardBg: 'bg-white/95 dark:bg-[#141e33]/90 border-slate-200/80 dark:border-slate-700/60 hover:border-violet-300 dark:hover:border-violet-500/40',
    activeRing: 'ring-2 ring-violet-400 border-violet-400 bg-violet-50/90 dark:bg-violet-500/20',
    stroke: '#8b5cf6',
  },
  {
    key: 'official',
    label: 'Chủ đề chính',
    labelEn: 'Core Topics',
    icon: Globe,
    grad: 'from-emerald-500 to-teal-500',
    ribbon: 'from-emerald-500 via-teal-500 to-cyan-500',
    cardBg: 'bg-white/95 dark:bg-[#141e33]/90 border-slate-200/80 dark:border-slate-700/60 hover:border-emerald-300 dark:hover:border-emerald-500/40',
    activeRing: 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50/90 dark:bg-emerald-500/20',
    stroke: '#10b981',
  },
  {
    key: 'role_play',
    label: 'Role-play',
    labelEn: 'Role-play',
    icon: MessageCircle,
    grad: 'from-sky-500 to-blue-600',
    ribbon: 'from-sky-500 via-blue-500 to-indigo-500',
    cardBg: 'bg-white/95 dark:bg-[#141e33]/90 border-slate-200/80 dark:border-slate-700/60 hover:border-sky-300 dark:hover:border-sky-500/40',
    activeRing: 'ring-2 ring-sky-400 border-sky-400 bg-sky-50/90 dark:bg-sky-500/20',
    stroke: '#0ea5e9',
  },
  {
    key: 'unexpected',
    label: 'Đột xuất',
    labelEn: 'Unexpected',
    icon: Sparkles,
    grad: 'from-rose-500 to-pink-500',
    ribbon: 'from-rose-500 via-pink-500 to-orange-500',
    cardBg: 'bg-white/95 dark:bg-[#141e33]/90 border-slate-200/80 dark:border-slate-700/60 hover:border-rose-300 dark:hover:border-rose-500/40',
    activeRing: 'ring-2 ring-rose-400 border-rose-400 bg-rose-50/90 dark:bg-rose-500/20',
    stroke: '#f43f5e',
  },
  {
    key: 'custom',
    label: 'Tự thêm',
    labelEn: 'Custom',
    icon: Wand2,
    grad: 'from-indigo-500 to-cyan-500',
    ribbon: 'from-indigo-500 via-blue-500 to-cyan-500',
    cardBg: 'bg-white/95 dark:bg-[#141e33]/90 border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-500/40',
    activeRing: 'ring-2 ring-indigo-400 border-indigo-400 bg-indigo-50/90 dark:bg-indigo-500/20',
    stroke: '#6366f1',
  },
];

const LEVEL_COVER_GRAD = {
  IH: 'from-emerald-500 to-teal-500',
  IM: 'from-indigo-500 to-sky-500',
  IL: 'from-amber-400 to-orange-500',
};

const QUESTION_TYPE_VI = {
  description: 'Miêu tả',
  routine: 'Thói quen',
  past_experience: 'Kỷ niệm & Sự cố',
  comparison: 'So sánh',
  role_play_ask: 'Đóng vai · Đặt câu hỏi',
  role_play_problem: 'Đóng vai · Xử lý sự cố',
  role_play_experience: 'Trải nghiệm thực tế',
  unexpected_situation: 'Tình huống bất ngờ',
};

const QUESTION_TYPE_EN = {
  description: 'Description',
  routine: 'Routine',
  past_experience: 'Past Experience',
  comparison: 'Comparison',
  role_play_ask: 'Role-play · Ask Questions',
  role_play_problem: 'Role-play · Problem Solving',
  role_play_experience: 'Real-life Experience',
  unexpected_situation: 'Unexpected Situation',
};

const STUDY_STATUS_META = {
  unlearned: {
    label: 'Chưa học',
    labelEn: 'New',
    next: 'learning',
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  learning: {
    label: 'Đang học',
    labelEn: 'Learning',
    next: 'mastered',
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
  },
  mastered: {
    label: 'Đã thuộc',
    labelEn: 'Mastered',
    next: 'unlearned',
    dot: 'bg-emerald-500',
    cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
  },
};

const groupKeyOf = (category) => {
  if (OFFICIAL_TOPIC_IDS.includes(category)) return 'official';
  if (['home', 'leisure', 'role_play', 'unexpected', 'custom'].includes(category)) return category;
  return 'leisure';
};

const formatDurationVi = (sec) => {
  if (!sec || sec <= 0) return '';
  const totalSec = Math.round(sec);
  const mins = Math.floor(totalSec / 60);
  const rem = totalSec % 60;
  if (mins >= 60) return `${Math.floor(mins / 60)}g ${mins % 60}p`;
  if (mins > 0) return rem > 0 ? `${mins}p ${rem}s` : `${mins} phút`;
  return `${rem}s`;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const formatShortDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return '';
  }
};

const MiniRing = ({ done, total, stroke = '#0ea5e9' }) => {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg className="w-8 h-8 -rotate-90 shrink-0" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r={r} stroke="currentColor" className="text-slate-300/60 dark:text-slate-700" strokeWidth="3.5" fill="none" />
      <circle
        cx="16"
        cy="16"
        r={r}
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
      />
    </svg>
  );
};

const CLOZE_CONNECTORS = new Set([
  'because', 'however', 'although', 'when', 'while', 'after', 'before', 'since',
  'usually', 'always', 'often', 'sometimes', 'recently', 'especially', 'finally',
  'suddenly', 'luckily', 'actually', 'instead', 'therefore', 'moreover', 'besides',
]);

const ClozeSentence = ({ text }) => {
  const [revealed, setRevealed] = useState({});
  const tokens = useMemo(() => (text || '').split(/(\s+)/), [text]);
  useEffect(() => { setRevealed({}); }, [text]);

  const blankIndexes = useMemo(() => {
    const picked = new Set();
    const fallback = [];
    tokens.forEach((tok, idx) => {
      const clean = tok.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').toLowerCase();
      if (!clean || clean.length < 3) return;
      if (CLOZE_CONNECTORS.has(clean)) picked.add(idx);
      else if (clean.length >= 6 || /ed$|ing$/.test(clean)) fallback.push(idx);
    });
    for (let i = 0; i < fallback.length && picked.size < 4; i += 2) picked.add(fallback[i]);
    return picked;
  }, [tokens]);

  return (
    <p className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">
      {tokens.map((tok, idx) => {
        if (!blankIndexes.has(idx)) return <span key={idx}>{tok}</span>;
        const isShown = !!revealed[idx];
        const m = tok.match(/^([^a-zA-Z']*)([a-zA-Z']+)([^a-zA-Z']*)$/);
        const prefix = m ? m[1] : '';
        const word = m ? m[2] : tok;
        const suffix = m ? m[3] : '';
        return (
          <span key={idx}>
            {prefix}
            <button
              type="button"
              onClick={() => setRevealed((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              className={`inline-block px-1.5 py-0.5 mx-0.5 rounded-md border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                isShown
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/50'
                  : 'bg-brand-500/10 text-brand-700 dark:text-sky-300 border-dashed border-brand-400 min-w-[48px] text-center'
              }`}
            >
              {isShown ? word : '_____'}
            </button>
            {suffix}
          </span>
        );
      })}
    </p>
  );
};

const ViToEnSentence = ({ enText, viText }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => { setShown(false); }, [enText]);
  return (
    <button
      type="button"
      onClick={() => setShown((v) => !v)}
      className="w-full text-left flex flex-col gap-1.5 cursor-pointer group"
    >
      <p className="text-sm leading-relaxed text-sky-800 dark:text-sky-200 font-medium">
        {viText || 'Chạm để lật xem câu tiếng Anh'}
      </p>
      {shown ? (
        <p className="text-[15px] leading-relaxed text-emerald-700 dark:text-emerald-300 font-semibold pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700">
          {enText}
        </p>
      ) : (
        <span className="text-[11px] text-slate-400 group-hover:text-brand-500">Chạm để lật đáp án</span>
      )}
    </button>
  );
};

// ---------- Screen 2B: Focused Speaking Practice & Blind Random Reflex Drill ----------
const FocusPracticeView = ({
  question,
  session,
  model,
  startInRecordMode = true,
  randomMode = false,
  onPickAnotherRandom = null,
  studyStatus,
  onUpdateStudyStatus,
  onReviewRating,
  onAnswerSaved,
  onBackToStudy,
  onNextQuestion,
  hasNext,
}) => {
  const { isVi, pick } = useLanguage();
  const [answer, setAnswer] = useState(question?.existing_answer || null);
  const [isRecording, setIsRecording] = useState(startInRecordMode || !question?.existing_answer);
  const [submitting, setSubmitting] = useState(false);
  const [devMockLastAnswer, setDevMockLastAnswer] = useState(false);
  const [autoStartRecord, setAutoStartRecord] = useState(false);
  const [showPromptText, setShowPromptText] = useState(!randomMode);
  const [showPromptVi, setShowPromptVi] = useState(false);
  const [showModelHint, setShowModelHint] = useState(false);

  useEffect(() => {
    scrollPageToTop('instant');
    setAnswer(question?.existing_answer || null);
    setIsRecording(startInRecordMode || !question?.existing_answer);
    setDevMockLastAnswer(false);
    setShowPromptText(!randomMode);
    setShowPromptVi(false);
    setShowModelHint(false);
    setAutoStartRecord(false);
  }, [question?.id, startInRecordMode, randomMode]);

  const handleRecordingComplete = async ({ audioBlob, durationSeconds, devMock = false }) => {
    setSubmitting(true);
    const useDevMock = Boolean(import.meta.env.DEV && devMock);
    try {
      const formData = new FormData();
      formData.append('question_id', question.id);
      formData.append('session_id', session.session_id);
      formData.append('duration_seconds', durationSeconds);
      if (useDevMock) formData.append('dev_mock', 'true');
      if (audioBlob) formData.append('audio_file', audioBlob, recordingFileName(audioBlob, `study_q${question.id}`));
      const res = await answerApi.submit(formData);
      recordStudyActivity();
      setDevMockLastAnswer(useDevMock);
      setAnswer(res.data);
      if (onAnswerSaved) onAnswerSaved(question.id, res.data);
      if ((studyStatus || 'unlearned') === 'unlearned' && onUpdateStudyStatus) {
        onUpdateStudyStatus('learning');
      }
      setIsRecording(false);
    } catch (err) {
      notify.error(formatApiError(err, 'Không lưu được câu trả lời. Vui lòng ghi âm lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (answer && !isRecording) {
    return (
      <div className="w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 lg:h-full lg:min-h-0 lg:overflow-hidden flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackToStudy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>{pick('Quay lại', 'Back')}</span>
          </button>
          {randomMode && onPickAnotherRandom && (
            <button
              type="button"
              onClick={onPickAnotherRandom}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/35 text-violet-700 dark:text-violet-200 text-xs font-extrabold cursor-pointer hover:bg-violet-100 whitespace-nowrap"
            >
              <Shuffle className="w-3.5 h-3.5 shrink-0" />
              <span>{pick('Câu khác', 'Another')}</span>
            </button>
          )}
        </div>
        <AnswerCoaching
          answerId={answer.id}
          answer={answer}
          question={question}
          devMock={devMockLastAnswer || Boolean(session?.dev_mock)}
          assessmentLevel={session.self_assessment_level || 4}
          studyStatus={studyStatus}
          onUpdateStudyStatus={onUpdateStudyStatus}
          onReviewRating={onReviewRating}
          nextLabel={
            randomMode && onPickAnotherRandom
              ? pick('Câu khác', 'Another')
              : hasNext
                ? pick('Câu tiếp', 'Next')
                : pick('Quay lại', 'Back')
          }
          onNextQuestion={() => {
            if (randomMode && onPickAnotherRandom) {
              onPickAnotherRandom();
            } else if (hasNext && onNextQuestion) {
              onNextQuestion();
            } else {
              onBackToStudy();
            }
          }}
          onTranscriptEdited={(newText) => {
            const updated = { ...answer, transcript_edited: newText };
            setAnswer(updated);
            if (onAnswerSaved) onAnswerSaved(question.id, updated);
          }}
          onRetryQuestion={() => {
            setIsRecording(true);
            setAutoStartRecord(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 overflow-hidden bg-[#f3f6fc] dark:bg-[#090e1a] lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:dark:bg-transparent w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 lg:h-full flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[840px] lg:my-auto flex flex-col justify-between gap-2.5 sm:gap-3.5 lg:gap-4">
        {/* Single Non-Wrapping Top Bar */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={onBackToStudy}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl glass-card text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>{pick('Quay lại', 'Back')}</span>
            </button>

            {randomMode && (
              <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-violet-500/15 border border-violet-300/70 dark:border-violet-500/35 text-violet-700 dark:text-violet-200 text-[11px] font-extrabold whitespace-nowrap">
                <Shuffle className="w-3 h-3 shrink-0" />
                <span>{pick('Ngẫu nhiên', 'Random')}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {randomMode && onPickAnotherRandom && (
              <button
                type="button"
                onClick={onPickAnotherRandom}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-500/15 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span>{pick('Đổi câu', 'Switch')}</span>
              </button>
            )}
            {answer && (
              <button
                type="button"
                onClick={() => setIsRecording(false)}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl btn-speak-gradient text-xs font-extrabold cursor-pointer whitespace-nowrap"
              >
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pick('Xem điểm', 'View Score')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Listening + Recording Workspace: Flex col on mobile, Balanced Full-Height 6/6 Grid on Desktop */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2.5 lg:gap-5 items-stretch">
          {/* Eva Examiner + Spacious Inline Question/Translation/Model Card */}
          <div className="flex-1 min-h-0 lg:col-span-6 glass-panel rounded-2xl p-3 sm:p-4 lg:p-5 flex flex-col justify-between gap-2.5 lg:gap-3.5 h-full overflow-hidden">
            <div className="w-full shrink-0">
              <EvaAvatar
                key={question.id}
                layout="horizontal"
                audioUrl={question.audio_path}
                text={question.question_text}
                autoPlay
                maxReplays={1}
                onSecondReadEnded={() => setAutoStartRecord(true)}
              />
            </div>

            {/* Spacious Inline Prompt & Model Answer Area */}
            <div className="flex-1 min-h-0 flex flex-col gap-2 pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  {showModelHint ? pick('Gợi ý bài mẫu', 'Model Hint') : showPromptText ? question.topic : pick('Đề bài đang ẩn', 'Prompt Hidden')}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isVi && showPromptText && !showModelHint && (
                    <button
                      type="button"
                      onClick={() => setShowPromptVi((v) => !v)}
                      className={`h-7 inline-flex items-center justify-center px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                        showPromptVi
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      <span className="inline-grid items-center justify-items-center">
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showPromptVi ? 'visible' : 'invisible pointer-events-none'}`}>
                          <Languages className="w-3.5 h-3.5 shrink-0" />
                          <span>Dịch</span>
                        </span>
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showPromptVi ? 'visible' : 'invisible pointer-events-none'}`}>
                          <Languages className="w-3.5 h-3.5 shrink-0" />
                          <span>Ẩn dịch</span>
                        </span>
                      </span>
                    </button>
                  )}
                  {model && (
                    <button
                      type="button"
                      onClick={() => setShowModelHint((v) => !v)}
                      className={`lg:hidden h-7 inline-flex items-center justify-center px-2 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                        showModelHint
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-indigo-50 dark:bg-sky-500/15 text-indigo-700 dark:text-sky-300 border-indigo-200/80 dark:border-sky-500/30'
                      }`}
                    >
                      <span className="inline-grid items-center justify-items-center">
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showModelHint ? 'visible' : 'invisible pointer-events-none'}`}>
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>{pick('Bài mẫu', 'Model')}</span>
                        </span>
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showModelHint ? 'visible' : 'invisible pointer-events-none'}`}>
                          <EyeOff className="w-3 h-3 shrink-0" />
                          <span>{pick('Ẩn mẫu', 'Hide')}</span>
                        </span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowModelHint(false);
                      setShowPromptText((v) => !v);
                    }}
                    className="h-7 inline-flex items-center justify-center px-2 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-sky-400 hover:bg-indigo-50 dark:hover:bg-sky-500/10 transition-colors cursor-pointer shrink-0"
                  >
                    <span className="inline-grid items-center justify-items-center">
                      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showPromptText ? 'visible' : 'invisible pointer-events-none'}`}>
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                        <span>{pick('Ẩn đề', 'Hide')}</span>
                      </span>
                      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showPromptText ? 'visible' : 'invisible pointer-events-none'}`}>
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span>{pick('Hiện đề', 'Show')}</span>
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 lg:p-5 rounded-2xl theme-surface-subtle flex flex-col">
                {showModelHint && model ? (
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line my-auto lg:hidden">
                    {model.text}
                  </p>
                ) : null}
                <div className={`w-full my-auto ${showModelHint && model ? 'hidden lg:block' : ''}`}>
                  {showPromptText ? (
                    <TranslatableText
                      text={question.question_text}
                      preTranslatedVi={question.question_translation_vi}
                      className="text-sm sm:text-[15px] lg:text-base text-slate-900 dark:text-slate-100 leading-relaxed font-semibold text-left"
                      showControls={false}
                      externalShowTranslation={isVi && showPromptVi}
                    />
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 italic text-center py-4">
                      {pick(
                        'Lắng nghe Eva đọc câu hỏi và trả lời tự nhiên như thi thật. Bấm "Hiện đề" nếu cần xem chữ & dịch.',
                        'Listen to Eva and respond naturally like in the real test. Click "Show" if you want to read the prompt.'
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {model && (
              <div className="hidden lg:flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModelHint((v) => !v)}
                  className="w-full h-9 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-sky-500/15 hover:bg-indigo-100 dark:hover:bg-sky-500/25 border border-indigo-200/80 dark:border-sky-500/30 text-xs font-bold text-indigo-700 dark:text-sky-300 cursor-pointer transition-colors"
                >
                  <span className="inline-grid items-center justify-items-center">
                    <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap ${!showModelHint ? 'visible' : 'invisible pointer-events-none'}`}>
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>{pick('Bài mẫu', 'Model Answer')}</span>
                    </span>
                    <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap ${showModelHint ? 'visible' : 'invisible pointer-events-none'}`}>
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      <span>{pick('Ẩn mẫu', 'Hide Model')}</span>
                    </span>
                  </span>
                </button>
                {showModelHint && (
                  <div className="p-3 rounded-xl bg-emerald-50/85 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed max-h-36 overflow-y-auto">
                    {model.text}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audio Recorder Area: Balanced 6 Cols on Desktop, Compact on Mobile */}
          <div className="shrink-0 lg:col-span-6 relative flex flex-col">
            <AudioRecorder
              key={question.id}
              onRecordingComplete={handleRecordingComplete}
              isPracticeMode
              autoStart={autoStartRecord}
              targetDurationMin={question.timing?.target_min_sec || 45}
              targetDurationMax={question.timing?.time_limit_sec || 90}
            />
            {submitting && (
              <div className="absolute inset-0 z-20 rounded-2xl bg-slate-950/80 flex items-center justify-center gap-2 text-sky-400 text-sm font-semibold">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{pick('Đang nhận dạng & chấm điểm AI...', 'Transcribing & grading with AI...')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Master Script Study Card (Shared between Desktop Split-View & Mobile Focus View) ----------
const MasterScriptCard = ({
  question,
  session,
  onCycleStatus,
  onOpenRegenerate,
  onPrioritize,
  prioritizing,
  onAddVariant,
  onDeleteSlot,
  onOpenPractice,
  isMobileFocus = false,
  onBackMobile,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  positionLabel,
}) => {
  const { isVi, pick } = useLanguage();
  const [playingIdx, setPlayingIdx] = useState(null);
  const [studyMode, setStudyMode] = useState('read'); // 'read' | 'cloze' | 'vi2en'
  const [showVi, setShowVi] = useState(false);
  const [activeVariantIdx, setActiveVariantIdx] = useState(-1); // -1 = core prompt, >= 0 = variant
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newVariantText, setNewVariantText] = useState('');
  const [newVariantBridge, setNewVariantBridge] = useState('');
  const [savingVariant, setSavingVariant] = useState(false);

  const targetLevel = session?.default_model_level || 'IM';
  const model = useMemo(() => {
    if (!question?.model_answers?.length) return null;
    return question.model_answers.find((m) => m.level === targetLevel) || question.model_answers[0];
  }, [question, targetLevel]);

  const sentences = useMemo(() => {
    if (!model) return [];
    if (Array.isArray(model.sentences) && model.sentences.length > 0) return model.sentences;
    return (model.text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  }, [model]);
  const sentencesVi = Array.isArray(model?.sentences_vi) ? model.sentences_vi : [];
  const variants = Array.isArray(question?.prompt_variants) ? question.prompt_variants : [];
  const storyTags = Array.isArray(question?.story_tags) ? question.story_tags : [];

  useEffect(() => {
    stopSpeaking();
    setPlayingIdx(null);
    setActiveVariantIdx(-1);
    setShowAddVariant(false);
    setNewVariantText('');
    setNewVariantBridge('');
  }, [question?.id]);

  useEffect(() => () => stopSpeaking(), []);

  if (!question) {
    return (
      <div className="glass-card rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-3 min-h-[360px]">
        <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Chọn một chủ đề bên trái để học</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
          Mỗi ô giữ duy nhất 1 bài mẫu gốc và gộp toàn bộ cách hỏi tương tự để bạn học ít mà trả lời được mọi đề.
        </p>
      </div>
    );
  }

  const stMeta = STUDY_STATUS_META[question.study_status || 'unlearned'] || STUDY_STATUS_META.unlearned;
  const activeVariant = activeVariantIdx >= 0 ? variants[activeVariantIdx] : null;
  const displayedPrompt = activeVariant ? activeVariant.question : question.question_text;
  const groupMeta = TOPIC_GROUPS.find((g) => g.key === groupKeyOf(question.category)) || TOPIC_GROUPS[5];

  const handlePlaySentence = async (idx, sent) => {
    if (playingIdx === idx) {
      stopSpeaking();
      setPlayingIdx(null);
      return;
    }
    setPlayingIdx(idx);
    await speakPhrase(sent, {
      id: `ms-${question.id}-${idx}`,
      onEnd: () => setPlayingIdx(null),
    });
  };

  const handleSubmitVariant = async (e) => {
    e.preventDefault();
    if (!newVariantText.trim() || savingVariant) return;
    setSavingVariant(true);
    try {
      await onAddVariant(question.id, {
        question: newVariantText.trim(),
        bridge: newVariantBridge.trim() || undefined,
      });
      setNewVariantText('');
      setNewVariantBridge('');
      setShowAddVariant(false);
    } finally {
      setSavingVariant(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-2 lg:gap-3">
      {isMobileFocus && (
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackMobile}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-card text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>{pick('Danh sách', 'List')}</span>
          </button>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{positionLabel}</span>
          <button
            type="button"
            onClick={() => onCycleStatus(question)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer whitespace-nowrap ${stMeta.cls}`}
          >
            <span className={`w-2 h-2 rounded-full ${stMeta.dot}`} />
            <span>{pick(stMeta.label, stMeta.labelEn)}</span>
          </button>
        </div>
      )}

      {/* Full-Height Bounded Paper-Like Study Studio Card (Header + Scrollable Body + Pinned Footer) */}
      <div className="flex-1 min-h-0 glass-panel rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col">
        <div className={`h-1.5 w-full shrink-0 bg-gradient-to-r ${groupMeta.ribbon}`} />

        {/* Compact Studio Header (Always Pinned) */}
        <div className="px-3.5 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3.5 border-b border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {question.topic}
              </h2>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-sky-300 border border-indigo-200/70 dark:border-indigo-500/30 text-[11px] font-bold shrink-0">
                {isVi ? (QUESTION_TYPE_VI[question.question_type] || question.question_type) : (QUESTION_TYPE_EN[question.question_type] || question.question_type)}
              </span>
              {storyTags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-teal-200/70 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 text-[10px] font-semibold shrink-0"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!isMobileFocus && (
                <button
                  type="button"
                  onClick={() => onCycleStatus(question)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${stMeta.cls}`}
                >
                  <span className={`w-2 h-2 rounded-full ${stMeta.dot}`} />
                  <span>{pick(stMeta.label, stMeta.labelEn)}</span>
                </button>
              )}
              {onDeleteSlot && (
                <button
                  type="button"
                  onClick={() => onDeleteSlot(question)}
                  title={pick('Xóa câu này khỏi kho', 'Remove question from study hub')}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Compact Warm Prompt & Eva Variant Switcher */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-50/90 via-orange-50/35 to-white dark:from-[#0f172a]/90 dark:via-[#111c36]/80 dark:to-[#0f172a]/70 border border-amber-200/80 dark:border-slate-700/70 px-3 sm:px-3.5 py-2 sm:py-2.5 flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto flex-nowrap">
                <button
                  type="button"
                  onClick={() => setActiveVariantIdx(-1)}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    activeVariantIdx === -1
                      ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                >
                  {pick('Câu chuẩn', 'Core Prompt')}
                </button>
                {variants.map((v, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveVariantIdx(idx)}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      activeVariantIdx === idx
                        ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    {v.label || pick(`Cách hỏi ${idx + 1}`, `Variant ${idx + 1}`)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddVariant((v) => !v)}
                  title={pick('Thêm cách Eva có thể hỏi khác', 'Add another prompt variation')}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-bold border border-dashed border-amber-400/80 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer inline-flex items-center gap-0.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>{pick('Thêm', 'Add')}</span>
                </button>
              </div>

              <SpeakButton
                variant="question"
                text={displayedPrompt}
                audioUrl={activeVariant ? null : question.audio_path}
                id={`ms-q-${question.id}-${activeVariantIdx}`}
                label={pick('Nghe', 'Listen')}
                playingLabel={pick('Dừng', 'Stop')}
                className="!h-7 !px-2.5 !text-[11px]"
              />
            </div>

            <TranslatableText
              text={displayedPrompt}
              preTranslatedVi={activeVariant ? null : question.question_translation_vi}
              showControls={false}
              externalShowTranslation={isVi && showVi}
              className="text-[13.5px] sm:text-sm font-bold text-slate-900 dark:text-white leading-snug"
            />

            {activeVariant?.bridge && (
              <div className="rounded-xl bg-white/95 dark:bg-slate-800/85 border border-emerald-200/80 dark:border-emerald-500/30 px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300 mr-1.5">{pick('Câu dẫn nối bài gốc:', 'Bridge to master script:')}</span>
                <span className="italic">"{activeVariant.bridge}"</span>
              </div>
            )}

            {showAddVariant && (
              <form onSubmit={handleSubmitVariant} className="flex flex-col gap-2 pt-2 border-t border-amber-200/60 dark:border-slate-700">
                <input
                  type="text"
                  value={newVariantText}
                  onChange={(e) => setNewVariantText(e.target.value)}
                  placeholder={pick('Nhập câu hỏi tương tự bằng tiếng Anh...', 'Enter a similar English prompt...')}
                  className="w-full theme-input rounded-xl px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={newVariantBridge}
                  onChange={(e) => setNewVariantBridge(e.target.value)}
                  placeholder={pick('Câu dẫn chuyển ý 1 dòng (tùy chọn)...', 'Optional 1-line transition sentence...')}
                  className="w-full theme-input rounded-xl px-3 py-1.5 text-xs"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddVariant(false)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    {pick('Hủy', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingVariant}
                    className="px-3.5 py-1 rounded-lg btn-brand-gradient text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {savingVariant ? pick('Đang lưu...', 'Saving...') : pick('Lưu biến thể', 'Save Variant')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Single Compact Toolbar: Study Modes + Global Translate Toggle + Audio + Rewrite */}
          {model && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex p-0.5 rounded-xl bg-slate-100/90 dark:bg-[#0b1120] border border-slate-200/90 dark:border-slate-700/60">
                {[
                  { key: 'read', label: pick('Đọc', 'Read') },
                  { key: 'cloze', label: pick('Điền khuyết', 'Cloze') },
                  ...(isVi ? [{ key: 'vi2en', label: 'Việt → Anh' }] : []),
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setStudyMode(m.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      studyMode === m.key
                        ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {isVi && studyMode === 'read' && (
                  <button
                    type="button"
                    onClick={() => setShowVi((v) => !v)}
                    className={`h-7 inline-flex items-center justify-center px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                      showVi
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    <span className="inline-grid items-center justify-items-center">
                      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showVi ? 'visible' : 'invisible pointer-events-none'}`}>
                        <Languages className="w-3.5 h-3.5 shrink-0" />
                        <span>Dịch</span>
                      </span>
                      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showVi ? 'visible' : 'invisible pointer-events-none'}`}>
                        <Languages className="w-3.5 h-3.5 shrink-0" />
                        <span>Ẩn dịch</span>
                      </span>
                    </span>
                  </button>
                )}
                <SpeakButton
                  text={model.text}
                  audioUrl={model.audio_path}
                  id={`ms-full-${question.id}-${model.level}`}
                  label={pick('Nghe', 'Play')}
                  playingLabel={pick('Dừng', 'Stop')}
                />
                <button
                  type="button"
                  onClick={() => onOpenRegenerate(question, model.level)}
                  className="h-7 inline-flex items-center justify-center gap-1 px-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  <span>{pick('Viết lại', 'Rewrite')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Independent Scrollable Sentences Pane (fits all normal IM/IH sentences without scroll!) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {model ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {sentences.map((sent, idx) => {
                const isSpeaking = playingIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`px-5 py-2.5 flex items-start gap-3 transition-colors ${
                      isSpeaking
                        ? 'bg-indigo-50/75 dark:bg-sky-500/10'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-extrabold mt-0.5 shrink-0 transition-colors ${
                        isSpeaking
                          ? 'bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="flex-1 min-w-0">
                      {studyMode === 'cloze' ? (
                        <ClozeSentence text={sent} />
                      ) : studyMode === 'vi2en' ? (
                        <ViToEnSentence enText={sent} viText={sentencesVi[idx] || ''} />
                      ) : (
                        <TranslatableText
                          text={sent}
                          preTranslatedVi={sentencesVi[idx] || null}
                          showControls={false}
                          externalShowTranslation={showVi}
                          className="text-[14.5px] leading-[1.6] text-slate-900 dark:text-slate-100 font-medium"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlaySentence(idx, sent)}
                      aria-label="Nghe câu này"
                      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                        isSpeaking
                          ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-sm'
                          : 'bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-sky-300'
                      }`}
                    >
                      {isSpeaking ? <SoundWaveMini light /> : <Volume2 className="w-4 h-4 shrink-0" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-3 h-full">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bài mẫu chuẩn {targetLevel} của ô này đang nằm trong hàng đợi sinh nền.
              </p>
              <button
                type="button"
                onClick={() => onPrioritize(question.id, targetLevel)}
                disabled={prioritizing}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl btn-brand-gradient text-xs font-extrabold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {prioritizing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" />}
                <span>{prioritizing ? 'Đang tạo...' : 'Tạo ngay'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Always-Visible Pinned Speak Footer (Crisp 2-word buttons, NEVER wraps!) */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-slate-50/90 dark:bg-[#0b1120]/70 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2 shrink-0">
          {isMobileFocus && (
            <button
              type="button"
              disabled={!hasPrev}
              onClick={onPrev}
              aria-label="Câu trước"
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl glass-card text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenPractice(true)}
            className="flex-1 h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl btn-speak-gradient text-xs sm:text-sm font-extrabold cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-4 h-4 shrink-0" />
            <span>{pick('Luyện nói', 'Speak')}</span>
          </button>
          {question.existing_answer && (
            <button
              type="button"
              onClick={() => onOpenPractice(false)}
              className="h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/80 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>{question.last_level || pick(`${question.practice_count} lần`, `${question.practice_count}x`)}</span>
            </button>
          )}
          {isMobileFocus && (
            <button
              type="button"
              disabled={!hasNext}
              onClick={onNext}
              aria-label="Câu sau"
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl glass-card text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- Unlimited Anti-Duplicate Topic Curriculum Picker Modal ----------
const CurriculumModal = ({ isOpen, onClose, onSynced, currentLevel = 'IM' }) => {
  const [catalog, setCatalog] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [customTopics, setCustomTopics] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [targetLevel, setTargetLevel] = useState(currentLevel || 'IM');
  const [personalProfile, setPersonalProfile] = useState('');
  const [devMock, setDevMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setTargetLevel(currentLevel || 'IM');
    setLoading(true);
    libraryApi
      .getCatalog()
      .then((res) => {
        setCatalog(res.data);
        const owned = res.data.topics.filter((t) => t.owned).map((t) => t.id);
        const defaults = res.data.topics.filter((t) => t.default_selected).map((t) => t.id);
        setSelectedIds(owned.length > 0 ? owned : defaults);
      })
      .catch((err) => setError(formatApiError(err, 'Không tải được danh mục chủ đề.')))
      .finally(() => setLoading(false));
  }, [isOpen, currentLevel]);

  const totalSlots = useMemo(() => {
    if (!catalog) return 0;
    const byId = Object.fromEntries(catalog.topics.map((t) => [t.id, t]));
    const catalogSlots = selectedIds.reduce((acc, id) => acc + (byId[id]?.slot_count || 3), 0);
    return catalogSlots + customTopics.length * 3;
  }, [catalog, selectedIds, customTopics]);

  if (!isOpen) return null;

  const toggleTopic = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllInGroup = (groupKey) => {
    if (!catalog) return;
    const ids = catalog.topics.filter((t) => t.group === groupKey).map((t) => t.id);
    const allIn = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allIn ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const addCustomTopic = () => {
    const clean = customInput.trim();
    if (!clean) return;
    if (!customTopics.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setCustomTopics((prev) => [...prev, clean]);
    }
    setCustomInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIds.length && !customTopics.length) {
      setError('Hãy chọn ít nhất một chủ đề để thêm vào kho.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await libraryApi.syncCurriculum({
        target_level: targetLevel,
        topic_ids: selectedIds,
        custom_topics: customTopics,
        personal_profile: personalProfile.trim() || undefined,
        dev_mock: devMock,
      });
      onSynced(data);
      onClose();
    } catch (err) {
      setError(formatApiError(err, 'Không đồng bộ được kho chủ đề.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
      onClick={() => !submitting && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1a2438] border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col gap-5"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Chọn chủ đề ôn tập
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chọn bao nhiêu chủ đề tùy thích — các ô đã có sẽ tự giữ nguyên bài mẫu và tiến độ thuộc, không bị trùng lặp.
            </p>
          </div>
          <button type="button" disabled={submitting} onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Mức bài mẫu</label>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setTargetLevel(lvl)}
                className={`py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                  targetLevel === lvl
                    ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-sm'
                    : 'bg-slate-50 dark:bg-[#0b1120]/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Unlimited Categorized Catalog */}
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh mục chủ đề...
          </div>
        ) : catalog ? (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Tìm nhanh chủ đề (khách sạn, thuê xe, ngân hàng, cắm trại...)"
                className="w-full theme-input rounded-xl pl-8 pr-3 py-2 text-xs"
              />
            </div>

            {catalog.groups.map((grp) => {
              const qLow = catalogQuery.trim().toLowerCase();
              const grpItems = catalog.topics.filter(
                (t) =>
                  t.group === grp.key &&
                  (!qLow || `${t.title_vi} ${t.title_en}`.toLowerCase().includes(qLow))
              );
              if (!grpItems.length) return null;
              const allSelected = grpItems.every((t) => selectedIds.includes(t.id));
              return (
                <div key={grp.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{grp.label}</span>
                    <button
                      type="button"
                      onClick={() => selectAllInGroup(grp.key)}
                      className="text-[11px] font-bold text-brand-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {allSelected ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {grpItems.map((t) => {
                      const active = selectedIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTopic(t.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                            active
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-400'
                              : 'bg-slate-50 dark:bg-[#0f172a]/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                          <span>{t.title_vi}</span>
                          {t.owned && (
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" title="Đã có trong kho" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Custom Unlimited Topics */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Chủ đề tự nhập</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTopic();
                    }
                  }}
                  placeholder="Ví dụ: Làm việc ở Samsung, Nuôi con nhỏ, Du lịch Đà Lạt..."
                  className="flex-1 theme-input rounded-xl px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomTopic}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
              {customTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customTopics.map((ct) => (
                    <span
                      key={ct}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-semibold"
                    >
                      {ct}
                      <button
                        type="button"
                        onClick={() => setCustomTopics((prev) => prev.filter((x) => x !== ct))}
                        className="cursor-pointer hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Optional Personal Profile */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Hồ sơ cá nhân hóa bài mẫu</label>
          <textarea
            rows={2}
            value={personalProfile}
            onChange={(e) => setPersonalProfile(e.target.value)}
            placeholder="Ví dụ: Sống ở chung cư cùng gia đình tại TP.HCM, hay nấu ăn đơn giản..."
            className="w-full theme-input rounded-xl p-3 text-xs resize-none"
          />
        </div>

        {SHOW_DEV_MOCK && (
          <label className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 cursor-pointer">
            <input type="checkbox" checked={devMock} onChange={(e) => setDevMock(e.target.checked)} />
            <span>DEV giả lập không gọi AI</span>
          </label>
        )}

        {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}

        {/* Sticky Footer Counter + Sync Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {selectedIds.length + customTopics.length} chủ đề · {totalSlots} ô chuẩn
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || (!selectedIds.length && !customTopics.length)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold btn-brand-gradient cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{submitting ? 'Đang đồng bộ...' : 'Tạo & Đồng bộ'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// ---------- Main Page: Unified 3-SubTab Master Study Hub ("Kho ôn tập") ----------
export const QuestionLibrary = ({
  initialSubTab = 'topics',
  initialGroupFilter = null,
  autoOpenFlashcards = false,
  autoOpenRandom = false,
  onConsumeIntent,
  onOpenDaily,
}) => {
  const { isVi, pick } = useLanguage();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState(initialSubTab); // 'topics' | 'listening' | 'vocab'
  const [groupFilter, setGroupFilter] = useState(initialGroupFilter || 'all');
  const [subTopicFilter, setSubTopicFilter] = useState('all');
  const [onlyUnmastered, setOnlyUnmastered] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');

  // Desktop split-view active slot + Mobile focus/practice/flashcard state
  const [desktopSelectedId, setDesktopSelectedId] = useState(null);
  const [mobileFocusIds, setMobileFocusIds] = useState(null);
  const [mobileFocusIdx, setMobileFocusIdx] = useState(0);
  const [practiceTarget, setPracticeTarget] = useState(null); // { question, startInRecordMode }
  const [flashcardCtx, setFlashcardCtx] = useState(null);

  // Listening tab builder state
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [builderSource, setBuilderSource] = useState('pack_all');
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderIncludeQ, setBuilderIncludeQ] = useState(true);
  const [builderShadowing, setBuilderShadowing] = useState(false);
  const [editingPlId, setEditingPlId] = useState(null);
  const [editingPlTitle, setEditingPlTitle] = useState('');

  // Modals & background jobs
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);
  const [regenTarget, setRegenTarget] = useState(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [prioritizingQId, setPrioritizingQId] = useState(null);
  const [packProgressMap, setPackProgressMap] = useState({});

  const {
    savedPlaylists,
    cachedKeys,
    player,
    startListening,
    playSavedPlaylist,
    rebuildSavedPlaylist,
    renameSavedPlaylist,
    deleteSavedPlaylist,
    refreshPlaylists,
  } = useAudioPlayer();

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (initialGroupFilter) {
      setGroupFilter(initialGroupFilter);
      setSubTopicFilter('all');
      if (onConsumeIntent) onConsumeIntent();
    }
  }, [initialGroupFilter]);

  const handleSelectGroup = (nextGroup) => {
    setGroupFilter(nextGroup);
    setSubTopicFilter('all');
  };

  const load = async () => {
    try {
      const res = await libraryApi.get();
      setSets(res.data || []);
      const nextProgress = {};
      (res.data || []).forEach((s) => {
        if (s.study_progress) nextProgress[s.session_id] = s.study_progress;
      });
      setPackProgressMap(nextProgress);
    } catch (err) {
      console.error('Failed to load question library', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Poll any running study pack background job
  useEffect(() => {
    const runningIds = Object.values(packProgressMap)
      .filter((p) => p && p.running && p.done < p.total)
      .map((p) => p.session_id);
    if (!runningIds.length) return;
    const t = setTimeout(async () => {
      let changed = false;
      for (const sid of runningIds) {
        try {
          const { data } = await libraryApi.studyPackProgress(sid);
          const prev = packProgressMap[sid];
          if (!prev || prev.done !== data.done || prev.running !== data.running) changed = true;
          setPackProgressMap((m) => ({ ...m, [sid]: data }));
        } catch {}
      }
      if (changed) await load();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [packProgressMap]);

  const masterPack = useMemo(() => sets.find((s) => s.is_study_pack) || null, [sets]);
  const examSets = useMemo(() => sets.filter((s) => !s.is_study_pack), [sets]);

  const pickSmartRandomQuestion = (sourceList, excludeId = null) => {
    const base = (sourceList || []).filter((q) => q.question_type !== 'self_intro');
    if (!base.length) return null;
    const withoutPrev = base.length > 1 && excludeId ? base.filter((q) => q.id !== excludeId) : base;
    const due = withoutPrev.filter((q) => q.is_due_today);
    const unmastered = withoutPrev.filter((q) => q.study_status !== 'mastered');
    const pool = due.length ? due : unmastered.length ? unmastered : withoutPrev;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Honor dashboard quick jump to SRS flashcards or Random Speaking Practice
  useEffect(() => {
    if (!masterPack) return;
    const qs = masterPack.questions || [];
    if (autoOpenRandom && qs.length > 0) {
      const picked = pickSmartRandomQuestion(qs);
      if (picked) {
        setDesktopSelectedId(picked.id);
        setPracticeTarget({ question: picked, startInRecordMode: true, randomMode: true });
      }
      if (onConsumeIntent) onConsumeIntent();
      return;
    }
    if (autoOpenFlashcards) {
      const due = qs.filter((q) => q.is_due_today);
      const unmastered = qs.filter((q) => q.study_status !== 'mastered' && (q.model_answers || []).length > 0);
      const list = due.length ? due : (unmastered.length ? unmastered : qs).slice(0, 12);
      if (list.length > 0) setFlashcardCtx({ session: masterPack, questions: list });
      if (onConsumeIntent) onConsumeIntent();
    }
  }, [autoOpenFlashcards, autoOpenRandom, masterPack]);

  const allPackQuestions = masterPack?.questions || [];

  const groupStats = useMemo(() => {
    const stats = {};
    TOPIC_GROUPS.forEach((g) => {
      stats[g.key] = { total: 0, mastered: 0 };
    });
    allPackQuestions.forEach((q) => {
      const k = groupKeyOf(q.category);
      if (!stats[k]) stats[k] = { total: 0, mastered: 0 };
      stats[k].total += 1;
      if (q.study_status === 'mastered') stats[k].mastered += 1;
    });
    return stats;
  }, [allPackQuestions]);

  const subTopicsInGroup = useMemo(() => {
    if (groupFilter === 'all') return [];
    const map = new Map();
    allPackQuestions.forEach((q) => {
      if (groupKeyOf(q.category) !== groupFilter) return;
      const key = (q.topic || '').trim();
      if (!key) return;
      if (!map.has(key)) map.set(key, { topic: key, total: 0, mastered: 0 });
      const entry = map.get(key);
      entry.total += 1;
      if (q.study_status === 'mastered') entry.mastered += 1;
    });
    return Array.from(map.values());
  }, [allPackQuestions, groupFilter]);

  useEffect(() => {
    if (subTopicFilter !== 'all' && !subTopicsInGroup.some((t) => t.topic === subTopicFilter)) {
      setSubTopicFilter('all');
    }
  }, [subTopicsInGroup, subTopicFilter]);

  const filteredQuestions = useMemo(() => {
    const qStr = topicSearch.trim().toLowerCase();
    return allPackQuestions.filter((q) => {
      if (groupFilter !== 'all' && groupKeyOf(q.category) !== groupFilter) return false;
      if (subTopicFilter !== 'all' && (q.topic || '').trim() !== subTopicFilter) return false;
      if (onlyUnmastered && q.study_status === 'mastered') return false;
      if (qStr && !`${q.topic} ${q.question_text}`.toLowerCase().includes(qStr)) return false;
      return true;
    });
  }, [allPackQuestions, groupFilter, subTopicFilter, onlyUnmastered, topicSearch]);

  // Keep Desktop Split-View selected question always pointing to a valid visible slot
  useEffect(() => {
    if (!filteredQuestions.length) {
      setDesktopSelectedId(null);
      return;
    }
    if (!filteredQuestions.some((q) => q.id === desktopSelectedId)) {
      setDesktopSelectedId(filteredQuestions[0].id);
    }
  }, [filteredQuestions, desktopSelectedId]);

  const activeDesktopQuestion = useMemo(
    () => filteredQuestions.find((q) => q.id === desktopSelectedId) || filteredQuestions[0] || null,
    [filteredQuestions, desktopSelectedId]
  );

  const mobileFocusQuestions = useMemo(() => {
    if (!mobileFocusIds || !masterPack) return [];
    const byId = Object.fromEntries(allPackQuestions.map((q) => [q.id, q]));
    return mobileFocusIds.map((id) => byId[id]).filter(Boolean);
  }, [mobileFocusIds, masterPack, allPackQuestions]);

  const handleCycleStatus = async (q) => {
    const cur = q.study_status || 'unlearned';
    const next = STUDY_STATUS_META[cur]?.next || 'learning';
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        questions: s.questions.map((item) => (item.id === q.id ? { ...item, study_status: next } : item)),
      }))
    );
    try {
      await libraryApi.updateStudyStatus(q.id, next);
    } catch {
      load();
    }
  };

  const handleSetStatus = async (questionId, nextStatus) => {
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        questions: s.questions.map((item) => (item.id === questionId ? { ...item, study_status: nextStatus } : item)),
      }))
    );
    try {
      await libraryApi.updateStudyStatus(questionId, nextStatus);
    } catch {
      load();
    }
  };

  const handleReviewQuestion = async (questionId, rating) => {
    try {
      const { data } = await libraryApi.reviewQuestion(questionId, rating);
      setSets((prev) =>
        prev.map((s) => ({
          ...s,
          questions: s.questions.map((item) =>
            item.id === questionId
              ? {
                  ...item,
                  study_status: data.study_status,
                  review_interval_days: data.review_interval_days,
                  review_count: data.review_count,
                  next_review_at: data.next_review_at,
                  is_due_today: false,
                }
              : item
          ),
        }))
      );
    } catch (err) {
      notify.error(formatApiError(err, 'Không lưu được lịch ôn tập.'));
    }
  };

  const handlePrioritize = async (questionId, level) => {
    setPrioritizingQId(questionId);
    try {
      await libraryApi.prioritizeQuestion(questionId, level);
      await load();
      notify.success('Đã tạo xong bài mẫu cho câu này.');
    } catch (err) {
      notify.error(formatApiError(err, 'Không tạo được bài mẫu.'));
    } finally {
      setPrioritizingQId(null);
    }
  };

  const handleConfirmRegenerate = async (customInstruction) => {
    if (!regenTarget) return;
    setRegenLoading(true);
    try {
      await questionApi.regenerateModel(regenTarget.question.id, {
        level: regenTarget.level || 'IM',
        custom_instruction: customInstruction || undefined,
      });
      setRegenTarget(null);
      await load();
      notify.success('Đã viết lại bài mẫu mới.');
    } catch (err) {
      notify.error(formatApiError(err, 'Không viết lại được bài mẫu.'));
    } finally {
      setRegenLoading(false);
    }
  };

  const handleAddVariant = async (questionId, payload) => {
    const { data } = await libraryApi.addPromptVariant(questionId, payload);
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        questions: s.questions.map((item) =>
          item.id === questionId ? { ...item, prompt_variants: data.prompt_variants } : item
        ),
      }))
    );
    notify.success('Đã lưu biến thể câu hỏi.');
  };

  const handleDeleteSlot = async (q) => {
    const ok = await confirmDialog({
      title: 'Xóa câu khỏi kho ôn tập?',
      message: `Bạn có chắc chắn muốn xóa câu "${q.topic}" khỏi kho ôn tập hiện tại không?`,
      confirmLabel: 'Xóa câu này',
      cancelLabel: 'Hủy',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await libraryApi.deleteStudySlot(q.id);
      if (mobileFocusIds) setMobileFocusIds(null);
      await load();
      notify.success('Đã xóa câu khỏi kho ôn tập.');
    } catch (err) {
      notify.error(formatApiError(err, 'Không xóa được câu này.'));
    }
  };

  const handleResumeGeneration = async () => {
    if (!masterPack) return;
    try {
      const { data } = await libraryApi.resumeStudyPack(masterPack.session_id);
      setPackProgressMap((m) => ({ ...m, [masterPack.session_id]: data }));
      notify.info('Đã tiếp tục sinh các bài mẫu còn lại trong nền.');
    } catch (err) {
      notify.error(formatApiError(err, 'Không tiếp tục tạo được.'));
    }
  };

  const builderSelection = useMemo(() => {
    if (builderSource.startsWith('exam_')) {
      const sid = Number(builderSource.replace('exam_', ''));
      const sess = examSets.find((s) => s.session_id === sid);
      if (!sess) return null;
      const qs = sess.questions.filter((q) => q.question_type !== 'self_intro');
      return {
        session: sess,
        questions: qs,
        defaultTitle: `Bài thi #${sess.set_number ?? sess.session_number ?? sess.session_id} · ${sess.default_model_level}`,
      };
    }
    if (!masterPack) return null;
    const lvl = masterPack.default_model_level || 'IM';
    if (builderSource === 'pack_unmastered') {
      const qs = allPackQuestions.filter((q) => q.study_status !== 'mastered');
      return { session: masterPack, questions: qs, defaultTitle: `Câu chưa thuộc · ${lvl}` };
    }
    if (builderSource.startsWith('pack_group_')) {
      const gKey = builderSource.replace('pack_group_', '');
      const gLabel = TOPIC_GROUPS.find((g) => g.key === gKey)?.label || gKey;
      const qs = allPackQuestions.filter((q) => groupKeyOf(q.category) === gKey);
      return { session: masterPack, questions: qs, defaultTitle: `${gLabel} · ${lvl}` };
    }
    return {
      session: masterPack,
      questions: allPackQuestions,
      defaultTitle: `Toàn bộ kho · ${allPackQuestions.length} câu · ${lvl}`,
    };
  }, [builderSource, masterPack, allPackQuestions, examSets]);

  const handleAutoChapterAlbums = async () => {
    if (!masterPack) return;
    const lvl = masterPack.default_model_level || 'IM';
    const readyByGroup = [];
    for (const grp of TOPIC_GROUPS) {
      const qs = allPackQuestions.filter(
        (q) => groupKeyOf(q.category) === grp.key && (q.model_answers || []).some((m) => m.level === lvl)
      );
      if (qs.length > 0) {
        readyByGroup.push({ label: grp.label, qs });
      }
    }
    if (!readyByGroup.length) {
      notify.warning('Chưa có bài mẫu nào hoàn tất để chia chương.');
      return;
    }
    for (const chapter of readyByGroup) {
      try {
        await libraryApi.playlist({
          question_ids: chapter.qs.map((q) => q.id),
          level: lvl,
          include_question: builderIncludeQ,
          shadowing_pause: builderShadowing,
          title: `Album ${chapter.label} · ${chapter.qs.length} câu · ${lvl}`,
          session_id: masterPack.session_id,
          save: true,
        });
      } catch (err) {
        console.warn('Chapter album build error', err);
      }
    }
    await refreshPlaylists();
  };

  const filteredSavedPlaylists = useMemo(() => {
    const q = playlistSearch.trim().toLowerCase();
    if (!q) return savedPlaylists;
    return savedPlaylists.filter(
      (p) => (p.title || '').toLowerCase().includes(q) || (p.level || '').toLowerCase().includes(q)
    );
  }, [savedPlaylists, playlistSearch]);

  // ---------- Full-Screen SRS Flashcard Overlay ----------
  if (flashcardCtx && flashcardCtx.questions.length > 0) {
    return (
      <FlashcardReview
        questions={flashcardCtx.questions}
        targetLevel={flashcardCtx.session.default_model_level || 'IM'}
        onClose={() => {
          setFlashcardCtx(null);
          load();
        }}
        onReviewed={(qid, data) => {
          setSets((prev) =>
            prev.map((s) => ({
              ...s,
              questions: s.questions.map((item) =>
                item.id === qid
                  ? {
                      ...item,
                      study_status: data.study_status,
                      review_interval_days: data.review_interval_days,
                      review_count: data.review_count,
                      next_review_at: data.next_review_at,
                      is_due_today: false,
                    }
                  : item
              ),
            }))
          );
        }}
        onOpenVoicePractice={(targetQ) => {
          setFlashcardCtx(null);
          setPracticeTarget({ question: targetQ, startInRecordMode: true });
        }}
      />
    );
  }

  // ---------- Speaking Practice & AI Grading Screen ----------
  if (practiceTarget && masterPack) {
    const liveQ = allPackQuestions.find((q) => q.id === practiceTarget.question.id) || practiceTarget.question;
    const targetLvl = masterPack.default_model_level || 'IM';
    const activeModel = liveQ.model_answers?.find((m) => m.level === targetLvl) || liveQ.model_answers?.[0] || null;
    const idxInList = filteredQuestions.findIndex((q) => q.id === liveQ.id);
    const hasNext = idxInList >= 0 && idxInList < filteredQuestions.length - 1;

    return (
      <FocusPracticeView
        question={liveQ}
        session={masterPack}
        model={activeModel}
        startInRecordMode={practiceTarget.startInRecordMode}
        randomMode={!!practiceTarget.randomMode}
        onPickAnotherRandom={() => {
          const pool = filteredQuestions.length ? filteredQuestions : allPackQuestions;
          const nextRandom = pickSmartRandomQuestion(pool, liveQ.id);
          if (nextRandom) {
            setDesktopSelectedId(nextRandom.id);
            setPracticeTarget({ question: nextRandom, startInRecordMode: true, randomMode: true });
          }
        }}
        studyStatus={liveQ.study_status || 'unlearned'}
        onUpdateStudyStatus={(st) => handleSetStatus(liveQ.id, st)}
        onReviewRating={(rating) => handleReviewQuestion(liveQ.id, rating)}
        onAnswerSaved={(qid, ansData) => {
          setSets((prev) =>
            prev.map((s) => ({
              ...s,
              questions: s.questions.map((item) =>
                item.id === qid
                  ? { ...item, existing_answer: ansData, practice_count: (item.practice_count || 0) + 1 }
                  : item
              ),
            }))
          );
        }}
        onBackToStudy={() => {
          setPracticeTarget(null);
          load();
        }}
        hasNext={hasNext}
        onNextQuestion={() => {
          if (hasNext) {
            const nextQ = filteredQuestions[idxInList + 1];
            setDesktopSelectedId(nextQ.id);
            setPracticeTarget(null);
          }
        }}
      />
    );
  }

  // ---------- Mobile Focused Single-Slot View (Strictly Viewport-Locked: ZERO Outer Scroll!) ----------
  if (mobileFocusIds && mobileFocusQuestions.length > 0 && masterPack) {
    const activeQ = mobileFocusQuestions[Math.min(mobileFocusIdx, mobileFocusQuestions.length - 1)];
    return (
      <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 overflow-hidden overscroll-none bg-[#f3f6fc] dark:bg-[#090e1a] flex flex-col px-3.5 py-3">
        <div className="w-full max-w-3xl mx-auto flex-1 min-h-0 flex flex-col">
          <MasterScriptCard
            question={activeQ}
            session={masterPack}
            onCycleStatus={handleCycleStatus}
            onOpenRegenerate={(q, lvl) => setRegenTarget({ question: q, level: lvl })}
            onPrioritize={handlePrioritize}
            prioritizing={prioritizingQId === activeQ.id}
            onAddVariant={handleAddVariant}
            onDeleteSlot={handleDeleteSlot}
            onOpenPractice={(recordNow) => setPracticeTarget({ question: activeQ, startInRecordMode: recordNow })}
            isMobileFocus
            onBackMobile={() => setMobileFocusIds(null)}
            hasPrev={mobileFocusIdx > 0}
            hasNext={mobileFocusIdx < mobileFocusQuestions.length - 1}
            onPrev={() => setMobileFocusIdx((i) => Math.max(0, i - 1))}
            onNext={() => setMobileFocusIdx((i) => Math.min(mobileFocusQuestions.length - 1, i + 1))}
            positionLabel={`${mobileFocusIdx + 1}/${mobileFocusQuestions.length}`}
          />
        </div>
        <RegenerateModal
          isOpen={!!regenTarget}
          onClose={() => !regenLoading && setRegenTarget(null)}
          onConfirm={handleConfirmRegenerate}
          loading={regenLoading}
          title={`Viết lại · ${regenTarget?.question?.topic || ''}`}
          levelLabel={regenTarget?.level || 'IM'}
        />
      </div>
    );
  }

  const prog = masterPack ? packProgressMap[masterPack.session_id] || masterPack.study_progress : null;
  const isGeneratingModels = prog && prog.running && prog.done < prog.total;
  const isIncompleteModels = prog && !prog.running && prog.done < prog.total;
  const dueQs = allPackQuestions.filter((q) => q.is_due_today);
  const targetLvl = masterPack?.default_model_level || 'IM';
  const unmasteredReady = allPackQuestions.filter(
    (q) => q.study_status !== 'mastered' && (q.model_answers || []).some((m) => m.level === targetLvl)
  );
  const flashcardList = dueQs.length
    ? dueQs
    : (unmasteredReady.length ? unmasteredReady : allPackQuestions).slice(0, 12);

  return (
    <div
      className={`w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 lg:h-full lg:min-h-0 lg:overflow-hidden flex flex-col gap-3 sm:gap-4 ${
        player ? 'pb-44 lg:pb-24' : ''
      }`}
    >
      {/* Slim Top Bar: Minimal 3 Sub-Tabs + Add Topics CTA (Always Pinned) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3 shrink-0">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-200/75 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700/60">
          {[
            { key: 'topics', label: pick('Chủ đề', 'Topics') },
            { key: 'listening', label: pick('Nghe', 'Audio') },
            { key: 'vocab', label: pick('Từ vựng', 'Vocab') },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                subTab === tab.key
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {subTab === 'topics' && (
          <div className="flex flex-wrap items-center gap-2">
            {masterPack && filteredQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const picked = pickSmartRandomQuestion(filteredQuestions);
                  if (picked) {
                    setDesktopSelectedId(picked.id);
                    setPracticeTarget({ question: picked, startInRecordMode: true, randomMode: true });
                  }
                }}
                title={pick('Bốc ngẫu nhiên 1 câu từ nhóm đang lọc để luyện phản xạ nói', 'Pick a random question from the current filter for blind speaking practice')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-50 dark:bg-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/30 text-violet-700 dark:text-violet-200 border border-violet-200/90 dark:border-violet-500/40 text-xs font-extrabold shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" />
                <span>{pick('Ngẫu nhiên', 'Random')}</span>
              </button>
            )}
            {masterPack && flashcardList.length > 0 && (
              <button
                type="button"
                onClick={() => setFlashcardCtx({ session: masterPack, questions: flashcardList })}
                title={pick('Tự nhẩm lại cả câu/đoạn trả lời rồi lật kiểm tra bài mẫu', 'Recall the full answer paragraph, then flip to check the model script')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/20 dark:to-orange-500/20 hover:from-amber-100 hover:to-orange-100 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-500/40 text-xs font-extrabold shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span>{pick('Ôn bài mẫu', 'Script Recall')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCurriculumModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-brand-gradient text-xs font-extrabold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pick('Thêm chủ đề', 'Add Topics')}</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20 text-slate-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> Đang tải...
        </div>
      ) : subTab === 'vocab' ? (
        <VocabularyNotebook embedded onGoPractice={onOpenDaily} />
      ) : subTab === 'listening' ? (
        /* ---------- Sub-Tab 2: Bounded 2-Column MP3 Audio Studio (Zero Outer Scroll) ---------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch lg:flex-1 lg:min-h-0">
          {/* Left Column (5 cols): Studio Creator Card */}
          <div className="lg:col-span-5 lg:h-full lg:overflow-y-auto">
            <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
              <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400" />
              <div className="p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">{pick('Tạo bài nghe mới', 'Create New Audio Track')}</h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{pick('Ghép MP3 liền mạch nghe khi tắt màn hình', 'Seamless MP3 compilation for lock-screen listening')}</p>
                    </div>
                  </div>
                  {masterPack && allPackQuestions.length > 45 && (
                    <button
                      type="button"
                      onClick={handleAutoChapterAlbums}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 text-[11px] font-bold cursor-pointer hover:bg-teal-100 transition-colors shrink-0"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{pick('Tự chia chương', 'Auto Chapters')}</span>
                    </button>
                  )}
                </div>

                {builderSelection ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{pick('Nguồn câu hỏi', 'Question Source')}</label>
                      <select
                        value={builderSource}
                        onChange={(e) => setBuilderSource(e.target.value)}
                        className="w-full theme-input rounded-xl px-3.5 py-2 text-xs font-bold"
                      >
                        {masterPack && (
                          <optgroup label={pick('Kho ôn tập', 'Study Hub')}>
                            <option value="pack_all">{pick(`Toàn bộ kho · ${allPackQuestions.length} câu`, `Entire Pack · ${allPackQuestions.length} Qs`)}</option>
                            <option value="pack_unmastered">{pick('Câu chưa thuộc', 'Unmastered Questions')}</option>
                            {TOPIC_GROUPS.filter((g) => (groupStats[g.key]?.total || 0) > 0).map((g) => (
                              <option key={g.key} value={`pack_group_${g.key}`}>
                                {pick(g.label, g.labelEn)} · {pick(`${groupStats[g.key].total} câu`, `${groupStats[g.key].total} Qs`)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {examSets.length > 0 && (
                          <optgroup label={pick('Đề đã thi', 'Past Exam Sets')}>
                            {examSets.map((s) => (
                              <option key={s.session_id} value={`exam_${s.session_id}`}>
                                {pick(`Bài thi #${s.set_number ?? s.session_number ?? s.session_id}`, `Exam #${s.set_number ?? s.session_number ?? s.session_id}`)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{pick('Tên bài nghe', 'Track Title')}</label>
                      <input
                        type="text"
                        value={builderTitle}
                        onChange={(e) => setBuilderTitle(e.target.value)}
                        placeholder={builderSelection.defaultTitle}
                        className="w-full theme-input rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                          builderIncludeQ
                            ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-800 dark:text-sky-200'
                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input type="checkbox" checked={builderIncludeQ} onChange={(e) => setBuilderIncludeQ(e.target.checked)} />
                        <span>{pick('Đọc câu hỏi trước', 'Read prompt first')}</span>
                      </label>
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                          builderShadowing
                            ? 'bg-emerald-50/80 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input type="checkbox" checked={builderShadowing} onChange={(e) => setBuilderShadowing(e.target.checked)} />
                        <span>{pick('Khoảng lặng nhại', 'Shadowing pause')}</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={!builderSelection.questions.length}
                      onClick={() => {
                        const customTitle = builderTitle.trim() || builderSelection.defaultTitle;
                        startListening({
                          session: builderSelection.session,
                          questionsToPlay: builderSelection.questions,
                          title: customTitle,
                          pauseOverride: builderShadowing,
                          includeQuestion: builderIncludeQ,
                          onModelsPrepared: load,
                        });
                        setBuilderTitle('');
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl btn-brand-gradient text-xs font-extrabold cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{pick(`Tạo bài nghe · ${builderSelection.questions.length} câu`, `Build Audio · ${builderSelection.questions.length} Qs`)}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hãy thêm chủ đề ở mục Chủ đề trước để tạo bài nghe MP3.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Independently Scrollable Saved Playlists Library */}
          <div className="lg:col-span-7 lg:h-full lg:min-h-0 flex flex-col gap-3">
            {savedPlaylists.length >= 3 && (
              <div className="relative shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={playlistSearch}
                  onChange={(e) => setPlaylistSearch(e.target.value)}
                  placeholder="Tìm bài nghe đã lưu..."
                  className="w-full theme-input rounded-xl pl-10 pr-3 py-2 text-xs"
                />
              </div>
            )}

            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              {filteredSavedPlaylists.length === 0 ? (
                <div className="glass-card rounded-3xl p-10 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-sky-400 flex items-center justify-center">
                    <Headphones className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    {savedPlaylists.length === 0 ? 'Chưa có bài nghe nào được lưu' : 'Không tìm thấy bài nghe phù hợp'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                    Mọi bài nghe bạn tạo sẽ tự lưu tại đây và đồng bộ vào bộ nhớ trình duyệt để nghe lại mọi lúc, kể cả khi tắt màn hình.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pb-2">
                  {filteredSavedPlaylists.map((pl) => {
                    const isActive = player?.playlistId === pl.id;
                    const isBuildingPl = pl.status === 'building';
                    const isErrorPl = pl.status === 'error';
                    const isCachedLocally = !!cachedKeys[pl.playlist_key];
                    const isReadyServer = pl.status === 'ready' && pl.file_available && pl.audio_path;
                    const isPlayableNow = isCachedLocally || isReadyServer;
                    const needsRebuild = !isCachedLocally && ((pl.status === 'ready' && !pl.file_available) || isErrorPl);
                    const pct = pl.total > 0 ? Math.min(100, Math.round((pl.done / pl.total) * 100)) : 0;
                    const coverGrad = LEVEL_COVER_GRAD[pl.level] || LEVEL_COVER_GRAD.IM;

                    return (
                      <div
                        key={pl.id}
                        className={`glass-card rounded-2xl p-4 flex flex-col gap-2.5 transition-all hover:shadow-lg ${
                          isActive ? 'ring-2 ring-indigo-500 border-indigo-400' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${coverGrad} text-white flex items-center justify-center shadow-md shrink-0`}>
                            <Headphones className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            {editingPlId === pl.id ? (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  await renameSavedPlaylist(pl.id, editingPlTitle);
                                  setEditingPlId(null);
                                  setEditingPlTitle('');
                                }}
                                className="flex items-center gap-1.5"
                              >
                                <input
                                  type="text"
                                  value={editingPlTitle}
                                  onChange={(e) => setEditingPlTitle(e.target.value)}
                                  autoFocus
                                  className="flex-1 min-w-0 theme-input rounded-lg px-2.5 py-1 text-xs font-semibold"
                                />
                                <button type="submit" className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" onClick={() => setEditingPlId(null)} className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            ) : (
                              <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{pl.title}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-sky-300 font-extrabold text-[10px]">
                                {pl.level}
                              </span>
                              <span className="font-semibold">{pl.question_count} câu</span>
                              {pl.shadowing_pause && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                                  Nhại
                                </span>
                              )}
                              {isCachedLocally && (
                                <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold text-[10px]">
                                  Lưu trên máy
                                </span>
                              )}
                              {pl.duration_seconds > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" />
                                  {formatDurationVi(pl.duration_seconds)}
                                </span>
                              )}
                              {pl.file_size_bytes > 0 && <span>· {formatFileSize(pl.file_size_bytes)}</span>}
                              {pl.updated_at && <span>· {formatShortDate(pl.updated_at)}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlId(pl.id);
                                setEditingPlTitle(pl.title);
                              }}
                              title="Đổi tên"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirmDialog({
                                  title: 'Xóa bài nghe đã lưu?',
                                  message: `Bài nghe "${pl.title}" sẽ bị xóa khỏi danh sách và bộ nhớ đệm trên máy.`,
                                  confirmLabel: 'Xóa bài nghe',
                                  cancelLabel: 'Hủy',
                                  tone: 'danger',
                                });
                                if (ok) {
                                  try {
                                    await deleteSavedPlaylist(pl);
                                    notify.success('Đã xóa bài nghe.');
                                  } catch (err) {
                                    notify.error(formatApiError(err, 'Không xóa được bài nghe.'));
                                  }
                                }
                              }}
                              title="Xóa"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isBuildingPl && (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-sky-300 font-bold">
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {pl.phase === 'queued'
                                  ? 'Đang chờ lượt tạo âm thanh...'
                                  : pl.phase === 'stitching'
                                    ? 'Đang ghép file MP3...'
                                    : `Đang tạo ${pl.done}/${pl.total} đoạn...`}
                              </span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}

                        {isErrorPl && !isCachedLocally && (
                          <div className="flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-3 py-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{pl.error_message || 'Tạo file nghe bị lỗi. Bấm Thử lại để tiếp tục.'}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {isPlayableNow ? (
                            <>
                              <button
                                type="button"
                                onClick={() => playSavedPlaylist(pl)}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                                  isActive
                                    ? 'btn-speak-gradient'
                                    : 'btn-brand-gradient'
                                }`}
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{isActive ? 'Đang mở trình phát' : 'Phát ngay'}</span>
                              </button>
                              {isReadyServer && (
                                <a
                                  href={resolveMediaUrl(pl.audio_path)}
                                  download={`${(pl.title || 'opic-audio').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'opic-audio'}.mp3`}
                                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-indigo-400 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Tải MP3</span>
                                </a>
                              )}
                            </>
                          ) : needsRebuild ? (
                            <button
                              type="button"
                              onClick={() => rebuildSavedPlaylist(pl)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 text-white text-xs font-extrabold cursor-pointer shadow-sm"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>{isErrorPl ? 'Thử lại' : 'Tạo lại & Phát'}</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : !masterPack || allPackQuestions.length === 0 ? (
        /* ---------- Empty State for Master Curriculum ---------- */
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-xl glass-panel rounded-3xl p-10 text-center flex flex-col items-center gap-5 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400" />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-400 text-white flex items-center justify-center shadow-xl shadow-indigo-500/25">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Khởi tạo Kho chủ đề ôn tập</h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Chọn một lần toàn bộ chủ đề bạn cần học — không giới hạn 50 câu. Mỗi chủ đề giữ duy nhất 1 bài mẫu gốc và tự gom các câu hỏi tương tự.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCurriculumModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-brand-gradient text-sm font-extrabold cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Chọn chủ đề ngay</span>
            </button>
          </div>
        </div>
      ) : (
        /* ---------- Sub-Tab 1: Zero-Page-Scroll Desktop Split-View / Mobile 1-Col ---------- */
        <div className="flex flex-col gap-3 lg:flex-1 lg:min-h-0">
          {/* Background Model Generation Progress Banner */}
          {isGeneratingModels && (
            <div className="glass-card rounded-2xl px-4 py-2 flex items-center justify-between gap-2 text-xs text-indigo-700 dark:text-sky-300 border-indigo-200 dark:border-sky-500/30 bg-indigo-50/75 dark:bg-sky-500/10 shrink-0">
              <span className="inline-flex items-center gap-2 font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Đang sinh bài mẫu {prog.target_level}: {prog.done}/{prog.total} câu — bấm mở câu bất kỳ để tạo ưu tiên ngay
              </span>
            </div>
          )}
          {isIncompleteModels && (
            <div className="glass-card rounded-2xl px-4 py-2 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-500/30 bg-amber-50/75 dark:bg-amber-500/10 shrink-0">
              <span className="font-semibold">Đã xong {prog.done}/{prog.total} bài mẫu trong kho.</span>
              <button
                type="button"
                onClick={handleResumeGeneration}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold cursor-pointer shrink-0 shadow-xs"
              >
                Tạo tiếp
              </button>
            </div>
          )}

          {/* Tier 1: Macro OPIc Category Filter Ribbon */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => handleSelectGroup('all')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  groupFilter === 'all'
                    ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-sm'
                    : 'bg-white/95 dark:bg-[#141e33]/90 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-300'
                }`}
              >
                <span>{pick('Tất cả', 'All')}</span>
                <span className={`text-[11px] font-bold ${groupFilter === 'all' ? 'text-white/85' : 'text-slate-400'}`}>
                  {allPackQuestions.filter((q) => q.study_status === 'mastered').length}/{allPackQuestions.length}
                </span>
              </button>

              {TOPIC_GROUPS.filter((g) => (groupStats[g.key]?.total || 0) > 0).map((g) => {
                const Icon = g.icon;
                const st = groupStats[g.key] || { total: 0, mastered: 0 };
                const active = groupFilter === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => handleSelectGroup(active ? 'all' : g.key)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      active ? g.activeRing : `${g.cardBg} shadow-2xs`
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md bg-gradient-to-br ${g.grad} text-white flex items-center justify-center shrink-0`}>
                      <Icon className="w-3 h-3" />
                    </span>
                    <span className="text-slate-900 dark:text-white">{pick(g.label, g.labelEn)}</span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {st.mastered}/{st.total}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tier 2: One-Click Sub-Topic Filter Chips (Auto-shown when a macro group has > 1 topic) */}
            {groupFilter !== 'all' && subTopicsInGroup.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pl-0.5 animate-in fade-in">
                <button
                  type="button"
                  onClick={() => setSubTopicFilter('all')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    subTopicFilter === 'all'
                      ? 'bg-slate-900 dark:bg-sky-500 text-white border-transparent shadow-xs'
                      : 'bg-white/90 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/70 hover:border-indigo-400'
                  }`}
                >
                  <span>{pick('Tất cả mục', 'All topics')}</span>
                  <span className={subTopicFilter === 'all' ? 'text-white/80' : 'text-slate-400'}>
                    {groupStats[groupFilter]?.total || 0}
                  </span>
                </button>
                {subTopicsInGroup.map((st) => {
                  const active = subTopicFilter === st.topic;
                  return (
                    <button
                      key={st.topic}
                      type="button"
                      onClick={() => setSubTopicFilter(active ? 'all' : st.topic)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white/90 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700/70 hover:border-indigo-400'
                      }`}
                    >
                      <span>{st.topic}</span>
                      <span className={`text-[10px] font-bold ${active ? 'text-white/85' : 'text-slate-400'}`}>
                        {st.mastered}/{st.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Full-Height Bounded Split-View Workspace (Each pane manages its own clean scroll!) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch lg:flex-1 lg:min-h-0">
            {/* Left Column (5 cols): Search Bar + Full-Height Question Slots List */}
            <div className="lg:col-span-5 lg:h-full lg:min-h-0 flex flex-col gap-2.5">
              {/* Search + Compact Action Strip */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder={pick('Tìm chủ đề hoặc câu hỏi...', 'Search topics or prompts...')}
                    className="w-full theme-input rounded-xl pl-8 pr-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyUnmastered((v) => !v)}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold border whitespace-nowrap cursor-pointer transition-all ${
                    onlyUnmastered
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-xs'
                      : 'bg-white dark:bg-[#141e33] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                  }`}
                >
                  {pick('Chưa thuộc', 'Unmastered')}
                </button>
                <button
                  type="button"
                  disabled={!filteredQuestions.length}
                  onClick={() => {
                    const gObj = TOPIC_GROUPS.find((g) => g.key === groupFilter);
                    const gLabel = subTopicFilter !== 'all' ? subTopicFilter : (gObj ? pick(gObj.label, gObj.labelEn) : null);
                    const title = gLabel
                      ? `${gLabel} · ${filteredQuestions.length} ${pick('câu', 'Qs')} · ${targetLvl}`
                      : `${pick('Kho ôn tập', 'Study Pack')} · ${filteredQuestions.length} ${pick('câu', 'Qs')} · ${targetLvl}`;
                    startListening({
                      session: masterPack,
                      questionsToPlay: filteredQuestions,
                      title,
                      onModelsPrepared: load,
                    });
                  }}
                  title={pick('Nghe nhóm đang lọc', 'Listen to filtered group')}
                  className="p-2 rounded-xl bg-indigo-50 dark:bg-sky-500/15 text-indigo-600 dark:text-sky-300 border border-indigo-200 dark:border-sky-500/30 hover:bg-indigo-100 dark:hover:bg-sky-500/25 cursor-pointer disabled:opacity-40 transition-colors"
                >
                  <Headphones className="w-4 h-4" />
                </button>
              </div>

              {/* Full-Height Bounded Master Slots List */}
              <div className="glass-card rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                {filteredQuestions.length > 0 ? (
                  filteredQuestions.map((q, idx) => {
                    const stMeta = STUDY_STATUS_META[q.study_status || 'unlearned'] || STUDY_STATUS_META.unlearned;
                    const isSelectedDesktop = activeDesktopQuestion?.id === q.id;
                    const hasModel = (q.model_answers || []).some((m) => m.level === targetLvl);
                    const variantCount = (q.prompt_variants || []).length;

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setDesktopSelectedId(q.id);
                          if (window.innerWidth < 1024) {
                            setMobileFocusIds(filteredQuestions.map((x) => x.id));
                            setMobileFocusIdx(idx);
                          }
                        }}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-all cursor-pointer border-l-[3px] ${
                          isSelectedDesktop
                            ? 'border-l-transparent lg:border-l-indigo-500 dark:lg:border-l-sky-400 lg:bg-indigo-50/90 dark:lg:bg-sky-500/20'
                            : 'border-l-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${q.is_due_today ? 'bg-orange-500 ring-2 ring-orange-500/25' : stMeta.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-extrabold text-slate-900 dark:text-white truncate">{q.topic}</span>
                            <span className={`text-[10px] font-semibold shrink-0 ${isSelectedDesktop ? 'text-slate-600 dark:text-sky-200' : 'text-slate-500 dark:text-slate-400'}`}>
                              {isVi ? (QUESTION_TYPE_VI[q.question_type] || q.question_type) : (QUESTION_TYPE_EN[q.question_type] || q.question_type)}
                            </span>
                            {variantCount > 0 && (
                              <span className="ml-auto px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold shrink-0">
                                +{variantCount}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs line-clamp-1 mt-0.5 ${isSelectedDesktop ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                            {q.question_text}
                          </p>
                          {!hasModel && (
                            <span className="text-[10px] text-indigo-600 dark:text-sky-400 font-semibold">{pick('Chờ sinh bài mẫu', 'Generating model...')}</span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 lg:hidden" />
                      </button>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">{pick('Không tìm thấy câu nào phù hợp.', 'No matching questions found.')}</div>
                )}
              </div>
            </div>

            {/* Right Column (7 cols): Full-Height Bounded Master Script Studio Card */}
            <div className="hidden lg:flex lg:flex-col lg:col-span-7 lg:h-full lg:min-h-0">
              <MasterScriptCard
                question={activeDesktopQuestion}
                session={masterPack}
                onCycleStatus={handleCycleStatus}
                onOpenRegenerate={(q, lvl) => setRegenTarget({ question: q, level: lvl })}
                onPrioritize={handlePrioritize}
                prioritizing={prioritizingQId === activeDesktopQuestion?.id}
                onAddVariant={handleAddVariant}
                onDeleteSlot={handleDeleteSlot}
                onOpenPractice={(recordNow) =>
                  activeDesktopQuestion &&
                  setPracticeTarget({ question: activeDesktopQuestion, startInRecordMode: recordNow })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Unlimited Topic Curriculum Picker Modal */}
      <CurriculumModal
        isOpen={showCurriculumModal}
        onClose={() => setShowCurriculumModal(false)}
        currentLevel={targetLvl}
        onSynced={(progData) => {
          setPackProgressMap((m) => ({ ...m, [progData.session_id]: progData }));
          setSubTab('topics');
          load();
        }}
      />

      {/* Custom Model Answer Regenerate Modal */}
      <RegenerateModal
        isOpen={!!regenTarget}
        onClose={() => !regenLoading && setRegenTarget(null)}
        onConfirm={handleConfirmRegenerate}
        loading={regenLoading}
        title={`Viết lại · ${regenTarget?.question?.topic || ''}`}
        levelLabel={regenTarget?.level || 'IM'}
      />
    </div>
  );
};
