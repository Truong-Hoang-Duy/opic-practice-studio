import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Library, ChevronDown, ChevronLeft, ChevronRight, Mic, Sparkles, Headphones, Download, Repeat,
  Loader2, ArrowLeft, X, Trash2, RotateCcw, CheckCircle, FileText, Eye, EyeOff, BookOpen,
  Volume2, Play, GraduationCap, MoreHorizontal, Languages, Plus
} from 'lucide-react';
import { libraryApi, sessionApi, questionApi, answerApi, resolveMediaUrl, formatApiError, recordingFileName } from '../api/client';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { AnswerCoaching } from './AnswerCoaching';
import { SpeakButton, SoundWaveMini } from '../components/SpeakButton';
import { TranslatableText } from '../components/TranslatableText';
import { RegenerateModal } from '../components/RegenerateModal';
import { speakPhrase, stopSpeaking } from '../utils/speakPhrase';
import { scrollPageToTop } from '../components/ScrollToTopButton';
import { USER_DEFAULT_PRESET } from './Survey';

const LEVELS = ['IL', 'IM', 'IH'];
const POLL_MS = 3000;
const SHOW_DEV_MOCK = import.meta.env.DEV;

const OFFICIAL_TOPIC_IDS = ['environment', 'human_rights', 'global_workplace', 'socio_cultural', 'communication_media'];
const OFFICIAL_TOPIC_OPTIONS = [
  { id: 'environment', label: 'Environment (Môi trường)' },
  { id: 'human_rights', label: 'Human Rights (Quyền con người)' },
  { id: 'global_workplace', label: 'Global Workplace (Làm việc toàn cầu)' },
  { id: 'socio_cultural', label: 'Socio-Cultural (Văn hóa - Xã hội)' },
  { id: 'communication_media', label: 'Communication Media (Truyền thông)' },
];

const GROUP_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'home', label: 'Nhà ở' },
  { key: 'leisure', label: 'Sở thích' },
  { key: 'official', label: '3 Chủ đề chính' },
  { key: 'role_play', label: 'Role-play' },
  { key: 'unexpected', label: 'Đột xuất' },
];

const STUDY_STATUS_META = {
  unlearned: {
    label: 'Chưa học',
    next: 'learning',
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  learning: {
    label: 'Đang học',
    next: 'mastered',
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
  },
  mastered: {
    label: 'Đã thuộc',
    next: 'unlearned',
    dot: 'bg-emerald-500',
    cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
  },
};

const groupKeyOf = (category) => {
  if (OFFICIAL_TOPIC_IDS.includes(category)) return 'official';
  if (['home', 'leisure', 'role_play', 'unexpected'].includes(category)) return category;
  return 'leisure';
};

// Generate missing model answers (never overwrites existing ones)
const generateMissingModelAnswers = async (questionIds, level, onDone) => {
  const queue = [...questionIds];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        await questionApi.regenerateModel(id, { level: level || 'IM' });
      } catch (err) {
        console.error('Model answer generation failed', err);
      }
      if (onDone) onDone(id);
    }
  };
  await Promise.all([worker(), worker()]);
};

// ---------- Screen 2B: Focused Speaking Practice & AI Grading ----------
const FocusPracticeView = ({
  question,
  session,
  model,
  startInRecordMode = true,
  studyStatus,
  onUpdateStudyStatus,
  onAnswerSaved,
  onBackToStudy,
  onNextQuestion,
  hasNext,
}) => {
  const [answer, setAnswer] = useState(question?.existing_answer || null);
  const [isRecording, setIsRecording] = useState(startInRecordMode || !question?.existing_answer);
  const [submitting, setSubmitting] = useState(false);
  const [autoStartRecord, setAutoStartRecord] = useState(false);
  const [showModelHint, setShowModelHint] = useState(false);

  useEffect(() => {
    scrollPageToTop('instant');
    setAnswer(question?.existing_answer || null);
    setIsRecording(startInRecordMode || !question?.existing_answer);
    setShowModelHint(false);
    setAutoStartRecord(false);
  }, [question?.id, startInRecordMode]);

  const handleRecordingComplete = async ({ audioBlob, durationSeconds }) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('question_id', question.id);
      formData.append('session_id', session.session_id);
      formData.append('duration_seconds', durationSeconds);
      if (audioBlob) formData.append('audio_file', audioBlob, recordingFileName(audioBlob, `study_q${question.id}`));
      const res = await answerApi.submit(formData);
      setAnswer(res.data);
      if (onAnswerSaved) onAnswerSaved(question.id, res.data);
      if ((studyStatus || 'unlearned') === 'unlearned' && onUpdateStudyStatus) {
        onUpdateStudyStatus('learning');
      }
      setIsRecording(false);
    } catch (err) {
      alert(formatApiError(err, 'Không lưu được câu trả lời. Vui lòng ghi âm lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (answer && !isRecording) {
    return (
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 pb-8 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToStudy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại bài mẫu Q{question.order_index}</span>
          </button>
        </div>
        <AnswerCoaching
          answerId={answer.id}
          answer={answer}
          question={question}
          assessmentLevel={session.self_assessment_level || 4}
          studyStatus={studyStatus}
          onUpdateStudyStatus={onUpdateStudyStatus}
          nextLabel={hasNext ? 'Sang câu tiếp theo' : 'Quay lại bài mẫu'}
          onNextQuestion={() => (hasNext && onNextQuestion ? onNextQuestion() : onBackToStudy())}
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToStudy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại bài mẫu Q{question.order_index}</span>
        </button>
        {answer && (
          <button
            type="button"
            onClick={() => setIsRecording(false)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Xem điểm cũ</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex justify-center">
            <EvaAvatar
              key={question.id}
              audioUrl={question.audio_path}
              text={question.question_text}
              autoPlay
              maxReplays={1}
              onSecondReadEnded={() => setAutoStartRecord(true)}
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <TranslatableText
              text={question.question_text}
              preTranslatedVi={question.question_translation_vi}
              className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
              controlsAlign="start"
            />
          </div>

          {model && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowModelHint((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
              >
                {showModelHint ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showModelHint ? `Che bài mẫu ${model.level} (tự nhớ nói)` : `Hiện bài mẫu ${model.level} để đọc theo`}</span>
              </button>
              {showModelHint && (
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
                  {model.text}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 relative">
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
              <span>Đang nhận dạng giọng nói & chấm điểm...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- Screen 2A: Focus Study View (1 question per screen, zero clutter) ----------
const FocusStudyView = ({
  questions,
  activeIndex,
  session,
  onChangeIndex,
  onBack,
  onCycleStatus,
  onOpenRegenerate,
  onGenerateMissing,
  generating,
  onOpenPractice,
}) => {
  const q = questions[activeIndex];
  const [playingIdx, setPlayingIdx] = useState(null);

  const targetLevel = session?.default_model_level || 'IM';
  const model = useMemo(() => {
    if (!q?.model_answers?.length) return null;
    return q.model_answers.find((m) => m.level === targetLevel) || q.model_answers[0];
  }, [q, targetLevel]);

  const sentences = useMemo(() => {
    if (!model) return [];
    if (Array.isArray(model.sentences) && model.sentences.length > 0) return model.sentences;
    return (model.text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  }, [model]);
  const sentencesVi = Array.isArray(model?.sentences_vi) ? model.sentences_vi : [];

  useEffect(() => {
    scrollPageToTop('instant');
    stopSpeaking();
    setPlayingIdx(null);
  }, [q?.id]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  if (!q) return null;

  const stMeta = STUDY_STATUS_META[q.study_status || 'unlearned'] || STUDY_STATUS_META.unlearned;
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < questions.length - 1;

  const handlePlaySentence = async (idx, sent) => {
    if (playingIdx === idx) {
      stopSpeaking();
      setPlayingIdx(null);
      return;
    }
    setPlayingIdx(idx);
    await speakPhrase(sent, {
      id: `focus-m-${q.id}-${idx}`,
      onEnd: () => setPlayingIdx(null),
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-36 md:pb-24 flex flex-col gap-4">
      {/* Clean top bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Danh sách</span>
        </button>

        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Câu {activeIndex + 1} / {questions.length}
        </span>

        <button
          type="button"
          onClick={() => onCycleStatus(q)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${stMeta.cls}`}
        >
          <span className={`w-2 h-2 rounded-full ${stMeta.dot}`} />
          <span>{stMeta.label}</span>
        </button>
      </div>

      {/* Block 1: Question */}
      <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-brand-500/15 text-brand-700 dark:text-brand-300">
              Q{q.order_index}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              {q.topic || q.category_label}
            </span>
          </div>
          <SpeakButton
            variant="question"
            text={q.question_text}
            audioUrl={q.audio_path}
            id={`focus-q-${q.id}`}
            label="Nghe câu hỏi"
            playingLabel="Đang đọc"
          />
        </div>

        <TranslatableText
          text={q.question_text}
          preTranslatedVi={q.question_translation_vi}
          className="text-[15px] sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed"
          controlsAlign="start"
        />
      </div>

      {/* Block 2: Clean Model Answer (hairline dividers, no nested boxes) */}
      <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Bài mẫu chuẩn {model?.level || targetLevel}
            </span>
          </div>

          {model && (
            <div className="flex items-center gap-2">
              <SpeakButton
                text={model.text}
                audioUrl={model.audio_path}
                id={`focus-full-${q.id}-${model.level}`}
                label="Nghe cả bài"
                playingLabel="Đang phát"
              />
              <button
                type="button"
                onClick={() => onOpenRegenerate(q, model.level)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/15 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tạo lại</span>
              </button>
            </div>
          )}
        </div>

        {model ? (
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
            {sentences.map((sent, idx) => {
              const isSpeaking = playingIdx === idx;
              return (
                <div
                  key={idx}
                  className={`px-4 sm:px-5 py-3.5 flex flex-col gap-2 transition-colors ${
                    isSpeaking ? 'bg-brand-50/70 dark:bg-brand-500/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                      isSpeaking
                        ? 'bg-brand-500 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold'
                    }`}>
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePlaySentence(idx, sent)}
                      className={`min-w-[92px] flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                        isSpeaking
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <SoundWaveMini light />
                          <span>Đang phát</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Nghe</span>
                        </>
                      )}
                    </button>
                  </div>

                  <TranslatableText
                    text={sent}
                    preTranslatedVi={sentencesVi[idx] || null}
                    className="text-sm sm:text-[15px] leading-relaxed text-slate-800 dark:text-slate-100"
                    controlsAlign="start"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center flex flex-col items-center gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bài mẫu chuẩn {targetLevel} của câu này chưa được tạo.
            </p>
            <button
              type="button"
              onClick={() => onGenerateMissing(q.id, targetLevel)}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{generating ? 'Đang tạo bài mẫu...' : `Tạo bài mẫu ${targetLevel}`}</span>
            </button>
          </div>
        )}
      </div>

      {/* Previous speaking score link (compact, only if practiced) */}
      {q.existing_answer && (
        <button
          type="button"
          onClick={() => onOpenPractice(false)}
          className="w-full p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>
              Xem điểm chấm gần nhất (đã nói {q.practice_count} lần{q.last_level ? ` · ${q.last_level}` : ''})
            </span>
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Fixed Bottom Thumb Bar: Prev · Speak & Grade · Next */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onChangeIndex(activeIndex - 1)}
            aria-label="Câu trước"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onOpenPractice(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold shadow-md shadow-brand-600/20 cursor-pointer active:scale-[0.99] transition-all"
          >
            <Mic className="w-4 h-4" />
            <span>Luyện nói & Chấm điểm</span>
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onChangeIndex(activeIndex + 1)}
            aria-label="Câu sau"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Create 50-Question Study Pack Bottom Sheet / Modal ----------
const StudyPackModal = ({ isOpen, onClose, onCreated, initialTopics }) => {
  const [targetLevel, setTargetLevel] = useState('IM');
  const [topics, setTopics] = useState(
    initialTopics?.length === 3 ? initialTopics : ['environment', 'socio_cultural', 'communication_media']
  );
  const [personalProfile, setPersonalProfile] = useState('');
  const [devMock, setDevMock] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (initialTopics?.length === 3) setTopics(initialTopics);
    }
  }, [isOpen, initialTopics]);

  if (!isOpen) return null;

  const toggleTopic = (id) => {
    setError('');
    if (topics.includes(id)) {
      setTopics(topics.filter((t) => t !== id));
    } else if (topics.length < 3) {
      setTopics([...topics, id]);
    } else {
      setError('Chọn đúng 3 chủ đề chính (bỏ chọn 1 chủ đề cũ trước).');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (topics.length !== 3) {
      setError('Vui lòng chọn đúng 3 chủ đề chính.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await libraryApi.createStudyPack({
        target_level: targetLevel,
        topics,
        survey_data: USER_DEFAULT_PRESET,
        personal_profile: personalProfile.trim() || undefined,
        dev_mock: devMock,
      });
      onCreated(res.data);
      onClose();
    } catch (err) {
      setError(formatApiError(err, 'Không tạo được bộ 50 câu ôn tập.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in"
      onClick={() => !creating && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 flex flex-col gap-4"
      >
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-brand-500" />
              <span>Tạo bộ 50 câu ôn tập</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Phủ đủ Survey của bạn (Nhà ở, Phim, Công viên, Nhạc, Nấu ăn, Đi bộ) + 3 chủ đề chính + Role-play + Đột xuất. Không có câu giới thiệu.
            </p>
          </div>
          <button type="button" disabled={creating} onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mức bài mẫu:</label>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setTargetLevel(lvl)}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  targetLevel === lvl
                    ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {lvl}{lvl === 'IM' ? ' (Mặc định)' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            3 Chủ đề chính ({topics.length}/3):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {OFFICIAL_TOPIC_OPTIONS.map((t) => {
              const active = topics.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTopic(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {active ? '✓ ' : ''}{t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Hồ sơ ngắn của bạn (tuỳ chọn — tiếng Việt hay Anh):
          </label>
          <textarea
            rows={3}
            value={personalProfile}
            onChange={(e) => setPersonalProfile(e.target.value)}
            placeholder="Ví dụ: Sống ở chung cư với gia đình tại TP.HCM, hay nấu ăn đơn giản, thích đi công viên buổi sáng... (Có thể để trống)"
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 resize-none outline-none focus:border-brand-500"
          />
        </div>

        {SHOW_DEV_MOCK && (
          <label className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 cursor-pointer">
            <input type="checkbox" checked={devMock} onChange={(e) => setDevMock(e.target.checked)} />
            <span>DEV: Giả lập không gọi AI</span>
          </label>
        )}

        {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" disabled={creating} onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer">
            Hủy
          </button>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-sm cursor-pointer disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{creating ? 'Đang tạo 50 câu...' : 'Tạo ngay 50 câu'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------- Main Page: Clean 2-Tab / 2-Screen Mobile-First Question Bank ----------
export const QuestionLibrary = ({ onStartPackExam }) => {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('study'); // 'study' | 'history'
  const [groupFilter, setGroupFilter] = useState('all');
  const [onlyUnmastered, setOnlyUnmastered] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [includeQuestion, setIncludeQuestion] = useState(true);
  const [loop, setLoop] = useState(true);

  // Focus Study / Practice state
  const [focusContext, setFocusContext] = useState(null); // { sessionId, questionIds, index }
  const [practiceMode, setPracticeMode] = useState(null); // null | { startInRecordMode: boolean }

  // Modals & background jobs
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [regenTarget, setRegenTarget] = useState(null); // { question, level }
  const [regenLoading, setRegenLoading] = useState(false);
  const [generatingQId, setGeneratingQId] = useState(null);
  const [startingExamId, setStartingExamId] = useState(null);
  const [packProgressMap, setPackProgressMap] = useState({});
  const [player, setPlayer] = useState(null); // { status, url, done, total, count, message }

  const audioRef = useRef(null);
  const pollRef = useRef(null);
  const packPollRef = useRef(null);

  const load = async () => {
    try {
      const res = await libraryApi.get();
      setSets(res.data);
      const nextProgress = {};
      res.data.forEach((s) => {
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
    return () => {
      clearTimeout(pollRef.current);
      clearTimeout(packPollRef.current);
    };
  }, []);

  // Poll any running study pack background job
  useEffect(() => {
    const runningIds = Object.values(packProgressMap)
      .filter((p) => p && p.running && p.done < p.total)
      .map((p) => p.session_id);
    if (!runningIds.length) return;

    packPollRef.current = setTimeout(async () => {
      let changed = false;
      for (const sid of runningIds) {
        try {
          const { data } = await libraryApi.studyPackProgress(sid);
          const prev = packProgressMap[sid];
          if (!prev || prev.done !== data.done || prev.running !== data.running) changed = true;
          setPackProgressMap((m) => ({ ...m, [sid]: data }));
        } catch (err) {
          console.warn('Study pack progress poll failed', err);
        }
      }
      if (changed) await load();
    }, POLL_MS);

    return () => clearTimeout(packPollRef.current);
  }, [packProgressMap]);

  const studyPacks = useMemo(() => sets.filter((s) => s.is_study_pack), [sets]);
  const examSets = useMemo(() => sets.filter((s) => !s.is_study_pack), [sets]);
  const activeStudyPack = studyPacks[0] || null;

  const latestUserTopics = useMemo(() => {
    const found = sets.find((s) => s.topics?.length === 3);
    return found ? found.topics : ['environment', 'socio_cultural', 'communication_media'];
  }, [sets]);

  // Keep Focus Study View synced with latest `sets` after status updates / regenerations
  const activeFocusSession = useMemo(
    () => (focusContext ? sets.find((s) => s.session_id === focusContext.sessionId) || null : null),
    [sets, focusContext]
  );
  const activeFocusQuestions = useMemo(() => {
    if (!activeFocusSession || !focusContext) return [];
    const byId = {};
    activeFocusSession.questions.forEach((q) => { byId[q.id] = q; });
    return focusContext.questionIds.map((id) => byId[id]).filter(Boolean);
  }, [activeFocusSession, focusContext]);

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
    } catch (err) {
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
    } catch (err) {
      load();
    }
  };

  const handleGenerateOneMissing = async (qId, level) => {
    setGeneratingQId(qId);
    try {
      await questionApi.regenerateModel(qId, { level: level || 'IM' });
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Không tạo được bài mẫu.'));
    } finally {
      setGeneratingQId(null);
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
    } catch (err) {
      alert(formatApiError(err, 'Không tạo lại được bài mẫu.'));
    } finally {
      setRegenLoading(false);
    }
  };

  const handleResumeStudyPack = async (sessionId) => {
    try {
      const { data } = await libraryApi.resumeStudyPack(sessionId);
      setPackProgressMap((m) => ({ ...m, [sessionId]: data }));
    } catch (err) {
      alert(formatApiError(err, 'Không tiếp tục tạo được.'));
    }
  };

  const handleStartExamFromPack = async (sessionId) => {
    if (!onStartPackExam || startingExamId) return;
    setStartingExamId(sessionId);
    try {
      const { data } = await libraryApi.startExamFromPack(sessionId, 'exam');
      onStartPackExam(data.session_id, data.mode);
    } catch (err) {
      alert(formatApiError(err, 'Không tạo được bài thi thử.'));
    } finally {
      setStartingExamId(null);
    }
  };

  const handleDeleteSet = async (s) => {
    const label = s.is_study_pack ? 'Bộ 50 câu ôn tập' : `Bộ đề #${s.set_number ?? s.session_number ?? s.session_id}`;
    if (!window.confirm(`Xóa ${label}?`)) return;
    try {
      await sessionApi.delete(s.session_id);
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Không xóa được.'));
    }
  };

  const handleDeleteAllSets = async () => {
    setMenuOpen(false);
    if (!sets.length) return;
    if (!window.confirm('Xóa toàn bộ bộ ôn tập và bộ đề đã thi?')) return;
    try {
      await sessionApi.deleteAll();
      setPlayer(null);
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Không xóa được.'));
    }
  };

  const pollPlaylist = async (body, count) => {
    try {
      const res = await libraryApi.playlist(body);
      const { ready, url, done, total } = res.data;
      if (ready) {
        setPlayer({ status: 'ready', url: resolveMediaUrl(url), done: total, total, count });
        return;
      }
      setPlayer({ status: 'building', done, total, count });
      pollRef.current = setTimeout(() => pollPlaylist(body, count), POLL_MS);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPlayer({ status: 'error', count, message: typeof detail === 'string' ? detail : detail?.message || 'Không tạo được file nghe.' });
    }
  };

  const handleStartListening = async (session, questionsToPlay) => {
    const listenable = questionsToPlay.filter((q) => q.question_type !== 'self_intro');
    if (!listenable.length) return;
    clearTimeout(pollRef.current);

    const readyQs = listenable.filter((q) => q.model_answers?.length > 0);
    const ids = (readyQs.length ? readyQs : listenable).map((q) => q.id);
    setPlayer({ status: 'preparing', done: 0, total: ids.length, count: ids.length });

    if (!readyQs.length) {
      await generateMissingModelAnswers(ids, session.default_model_level || 'IM');
      await load();
    }
    pollPlaylist({ question_ids: ids, include_question: includeQuestion, level: session.default_model_level || 'IM' }, ids.length);
  };

  useEffect(() => {
    if (player?.status !== 'ready' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: `Ôn tập OPIc · ${player.count} câu`,
        artist: 'Eva · OPIc Practice Studio',
        album: 'Study Pack',
      });
    } catch (e) {}
  }, [player?.status, player?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop, player?.url]);

  // ---------- Render Screen 2B: Practice / Grading ----------
  if (focusContext && practiceMode && activeFocusSession && activeFocusQuestions[focusContext.index]) {
    const activeQ = activeFocusQuestions[focusContext.index];
    const targetLvl = activeFocusSession.default_model_level || 'IM';
    const activeModel = activeQ.model_answers?.find((m) => m.level === targetLvl) || activeQ.model_answers?.[0] || null;

    return (
      <FocusPracticeView
        question={activeQ}
        session={activeFocusSession}
        model={activeModel}
        startInRecordMode={practiceMode.startInRecordMode}
        studyStatus={activeQ.study_status || 'unlearned'}
        onUpdateStudyStatus={(st) => handleSetStatus(activeQ.id, st)}
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
          setPracticeMode(null);
          load();
        }}
        hasNext={focusContext.index < activeFocusQuestions.length - 1}
        onNextQuestion={() => {
          setPracticeMode(null);
          setFocusContext((c) => (c ? { ...c, index: Math.min(activeFocusQuestions.length - 1, c.index + 1) } : null));
        }}
      />
    );
  }

  // ---------- Render Screen 2A: Focus Study 1 Question ----------
  if (focusContext && activeFocusSession && activeFocusQuestions.length > 0) {
    return (
      <>
        <FocusStudyView
          questions={activeFocusQuestions}
          activeIndex={Math.min(focusContext.index, activeFocusQuestions.length - 1)}
          session={activeFocusSession}
          onChangeIndex={(nextIdx) => setFocusContext((c) => (c ? { ...c, index: nextIdx } : null))}
          onBack={() => setFocusContext(null)}
          onCycleStatus={handleCycleStatus}
          onOpenRegenerate={(q, level) => setRegenTarget({ question: q, level })}
          onGenerateMissing={handleGenerateOneMissing}
          generating={generatingQId === activeFocusQuestions[focusContext.index]?.id}
          onOpenPractice={(recordNow) => setPracticeMode({ startInRecordMode: recordNow })}
        />
        <RegenerateModal
          isOpen={!!regenTarget}
          onClose={() => !regenLoading && setRegenTarget(null)}
          onConfirm={handleConfirmRegenerate}
          loading={regenLoading}
          title={`Tạo lại bài mẫu Q${regenTarget?.question?.order_index || ''}`}
          levelLabel={regenTarget?.level || 'IM'}
        />
      </>
    );
  }

  // ---------- Render Screen 1: Clean 2-Line List ----------
  const filteredStudyQuestions = activeStudyPack
    ? activeStudyPack.questions.filter((q) => {
        if (groupFilter !== 'all' && groupKeyOf(q.category) !== groupFilter) return false;
        if (onlyUnmastered && q.study_status === 'mastered') return false;
        return true;
      })
    : [];

  const renderCleanRow = (q, session, listForFocus, idx) => {
    const stKey = q.study_status || 'unlearned';
    const stMeta = STUDY_STATUS_META[stKey] || STUDY_STATUS_META.unlearned;
    const hasModel = (q.model_answers || []).length > 0;

    return (
      <button
        key={q.id}
        type="button"
        onClick={() =>
          setFocusContext({
            sessionId: session.session_id,
            questionIds: listForFocus.map((item) => item.id),
            index: idx,
          })
        }
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-bold text-brand-600 dark:text-brand-400 shrink-0">Q{q.order_index}</span>
            <span className="text-slate-500 dark:text-slate-400 truncate">{q.topic || q.category_label}</span>
            <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${stMeta.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stMeta.dot}`} />
              {stMeta.label}
            </span>
          </div>
          <p className="text-sm text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
            {q.question_text}
          </p>
          {!hasModel && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">Đang chờ tạo bài mẫu...</span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
    );
  };

  return (
    <div className={`max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-7 flex flex-col gap-4 ${player ? 'pb-48 md:pb-36' : ''}`}>
      {/* Minimal Top Bar: 2 Tabs + Overflow Menu */}
      <div className="flex items-center justify-between gap-2 relative">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {[
            { key: 'study', label: 'Ôn 50 câu' },
            { key: 'history', label: `Đề đã thi (${examSets.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMainTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                mainTab === tab.key
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Tùy chọn khác"
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-40 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-2 flex flex-col gap-1 text-xs">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setShowStudyModal(true); }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>Tạo bộ 50 câu ôn tập mới</span>
            </button>
            <label className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={includeQuestion} onChange={(e) => setIncludeQuestion(e.target.checked)} />
              <span>Đọc câu hỏi trước bài mẫu</span>
            </label>
            {activeStudyPack && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); handleDeleteSet(activeStudyPack); }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa bộ 50 câu hiện tại</span>
              </button>
            )}
            {sets.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllSets}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa tất cả bộ đề</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải...
        </div>
      ) : mainTab === 'study' ? (
        !activeStudyPack ? (
          /* Empty state: 1 clean card, 1 button */
          <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 sm:p-8 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Bộ 50 câu ôn tập chuẩn IM</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                Tạo sẵn 50 câu hỏi phủ đủ Survey & 3 chủ đề chính của bạn kèm bài mẫu IM và dịch tiếng Việt để học thuộc trước khi thi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowStudyModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tạo bộ 50 câu ôn tập (IM)</span>
            </button>
          </div>
        ) : (() => {
          const total = activeStudyPack.questions.length;
          const mastered = activeStudyPack.questions.filter((q) => q.study_status === 'mastered').length;
          const unmasteredReady = activeStudyPack.questions.filter(
            (q) => q.study_status !== 'mastered' && (q.model_answers || []).length > 0
          );
          const prog = packProgressMap[activeStudyPack.session_id] || activeStudyPack.study_progress;
          const isBuilding = prog && prog.running && prog.done < prog.total;
          const isIncomplete = prog && !prog.running && prog.done < prog.total;

          return (
            <>
              {/* 1 Compact Summary Card */}
              <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-500/30 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Bộ ôn tập {total} câu · Mức {activeStudyPack.default_model_level}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Đã thuộc <strong className="text-emerald-600 dark:text-emerald-400">{mastered}/{total}</strong> câu
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {Math.round((mastered / Math.max(1, total)) * 100)}%
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round((mastered / Math.max(1, total)) * 100)}%` }}
                  />
                </div>

                {isBuilding && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 rounded-xl px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      Đang tạo bài mẫu {prog.target_level}: {prog.done}/{prog.total} câu (bấm học ngay câu đã xong)
                    </span>
                  </div>
                )}

                {isIncomplete && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
                    <span>Đã xong {prog.done}/{prog.total} bài mẫu.</span>
                    <button
                      type="button"
                      onClick={() => handleResumeStudyPack(activeStudyPack.session_id)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold cursor-pointer shrink-0"
                    >
                      Tạo tiếp {prog.total - prog.done} câu
                    </button>
                  </div>
                )}

                {/* Exactly 2 main buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartListening(activeStudyPack, unmasteredReady.length ? unmasteredReady : activeStudyPack.questions)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 text-xs font-bold cursor-pointer"
                  >
                    <Headphones className="w-4 h-4" />
                    <span>Nghe ôn tập</span>
                  </button>

                  {onStartPackExam && (
                    <button
                      type="button"
                      onClick={() => handleStartExamFromPack(activeStudyPack.session_id)}
                      disabled={startingExamId === activeStudyPack.session_id}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {startingExamId === activeStudyPack.session_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      <span>Thi thử 15 câu</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 1 Single Horizontal Filter Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {GROUP_FILTERS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGroupFilter(g.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors ${
                      groupFilter === g.key
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOnlyUnmastered((v) => !v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors ${
                    onlyUnmastered
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Chưa thuộc
                </button>
              </div>

              {/* Clean 2-Line Question List */}
              <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {filteredStudyQuestions.length > 0 ? (
                  filteredStudyQuestions.map((q, idx) => renderCleanRow(q, activeStudyPack, filteredStudyQuestions, idx))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Không có câu nào trong nhóm đang lọc.
                  </div>
                )}
              </div>
            </>
          );
        })()
      ) : (
        /* Tab 2: Past 15-Question Exam/Practice Sets */
        examSets.length === 0 ? (
          <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            Chưa có bộ đề thi nào.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {examSets.map((s) => {
              const isOpen = !!expandedHistory[s.session_id];
              return (
                <div key={s.session_id} className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedHistory((p) => ({ ...p, [s.session_id]: !isOpen }))}
                      className="flex items-center gap-2 min-w-0 text-left cursor-pointer flex-1"
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          Bộ đề #{s.set_number ?? s.session_number ?? s.session_id} · {new Date(s.started_at).toLocaleDateString()}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Mức {s.default_model_level} · {s.questions.length} câu · {s.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartListening(s, s.questions)}
                        className="p-2 rounded-lg bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 cursor-pointer"
                        title="Nghe bộ đề này"
                      >
                        <Headphones className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSet(s)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Xóa bộ đề"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200/80 dark:divide-slate-800/80">
                      {s.questions.map((q, idx) => renderCleanRow(q, s, s.questions, idx))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Compact Sticky Audio Player (only shown when user clicked Nghe ôn tập) */}
      {player && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-brand-500" />
                <span>Nghe ôn tập ({player.count} câu)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLoop((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer flex items-center gap-1 ${
                    loop ? 'border-brand-400 text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-300 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Repeat className="w-3 h-3" />
                  <span>Lặp</span>
                </button>
                {player.status === 'ready' && (
                  <a
                    href={player.url}
                    download={`opic-on-tap-${player.count}-cau.mp3`}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>MP3</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => { setPlayer(null); clearTimeout(pollRef.current); }}
                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(player.status === 'preparing' || player.status === 'building') && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {player.status === 'preparing'
                    ? 'Đang chuẩn bị bài mẫu...'
                    : `Eva đang ghép âm thanh ${player.done}/${player.total} đoạn...`}
                </span>
              </div>
            )}
            {player.status === 'error' && <p className="text-[11px] text-rose-500">{player.message}</p>}
            {player.status === 'ready' && (
              <audio ref={audioRef} src={player.url} controls autoPlay loop={loop} preload="auto" className="w-full h-10" />
            )}
          </div>
        </div>
      )}

      {/* Study Pack Creation Bottom Sheet */}
      <StudyPackModal
        isOpen={showStudyModal}
        onClose={() => setShowStudyModal(false)}
        initialTopics={latestUserTopics}
        onCreated={(progData) => {
          setPackProgressMap((m) => ({ ...m, [progData.session_id]: progData }));
          setMainTab('study');
          load();
        }}
      />
    </div>
  );
};
