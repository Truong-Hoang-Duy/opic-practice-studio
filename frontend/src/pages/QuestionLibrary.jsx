import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Library, ChevronDown, ChevronLeft, ChevronRight, Mic, Sparkles, Headphones, Download, Repeat,
  ListMusic, Loader2, ArrowLeft, CheckSquare, Square, X, Trash2, RotateCcw, CheckCircle, FileText,
  Eye, EyeOff, BookOpen, Volume2, Play, GraduationCap
} from 'lucide-react';
import { libraryApi, sessionApi, questionApi, answerApi, resolveMediaUrl, formatApiError, recordingFileName } from '../api/client';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { AnswerCoaching } from './AnswerCoaching';
import { SpeakButton, SoundWaveMini } from '../components/SpeakButton';
import { TranslatableText } from '../components/TranslatableText';
import { RegenerateModal } from '../components/RegenerateModal';
import { speakPhrase, stopSpeaking } from '../utils/speakPhrase';
import { USER_DEFAULT_PRESET } from './Survey';

const LEVELS = ['IL', 'IM', 'IH'];
const POLL_MS = 3000;
const SHOW_DEV_MOCK = import.meta.env.DEV;

const OFFICIAL_TOPIC_OPTIONS = [
  { id: 'environment', label: 'Environment (Môi trường)' },
  { id: 'human_rights', label: 'Human Rights (Quyền con người)' },
  { id: 'global_workplace', label: 'Global Workplace (Làm việc toàn cầu)' },
  { id: 'socio_cultural', label: 'Socio-Cultural (Văn hóa - Xã hội)' },
  { id: 'communication_media', label: 'Communication Media (Truyền thông)' },
];

const STUDY_STATUS_META = {
  unlearned: {
    label: 'Chưa học',
    next: 'learning',
    cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  },
  learning: {
    label: 'Đang học',
    next: 'mastered',
    cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
  },
  mastered: {
    label: 'Đã thuộc',
    next: 'unlearned',
    cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
  },
};

// Generate model answers for questions that don't have one yet (never overwrites existing ones)
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
      onDone(id);
    }
  };
  await Promise.all([worker(), worker()]);
};

// ---------- Compact sentence-by-sentence model answer viewer inside each card ----------
const ModelSentencesViewer = ({ model, questionId }) => {
  const [playingIdx, setPlayingIdx] = useState(null);
  const sentences = useMemo(() => {
    if (Array.isArray(model?.sentences) && model.sentences.length > 0) return model.sentences;
    return (model?.text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  }, [model]);
  const sentencesVi = Array.isArray(model?.sentences_vi) ? model.sentences_vi : [];

  useEffect(() => {
    return () => stopSpeaking();
  }, [model?.id]);

  const handlePlay = async (idx, sent) => {
    if (playingIdx === idx) {
      stopSpeaking();
      setPlayingIdx(null);
      return;
    }
    setPlayingIdx(idx);
    await speakPhrase(sent, {
      id: `lib-m-${questionId}-${idx}`,
      onEnd: () => setPlayingIdx(null),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {sentences.map((sent, idx) => {
        const isSpeaking = playingIdx === idx;
        return (
          <div
            key={idx}
            className={`p-3 rounded-xl border transition-colors flex flex-col gap-2 ${
              isSpeaking
                ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-300 dark:border-brand-500/40'
                : 'bg-white/80 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded shrink-0 ${
                isSpeaking
                  ? 'bg-brand-500 text-white font-bold'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-semibold'
              }`}>
                #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => handlePlay(idx, sent)}
                className={`min-w-[96px] flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg border text-[11px] font-semibold transition-colors shrink-0 cursor-pointer ${
                  isSpeaking
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-brand-600 border-slate-200 dark:border-slate-700'
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
            <div className="w-full min-w-0">
              <TranslatableText
                text={sent}
                preTranslatedVi={sentencesVi[idx] || null}
                className="text-sm leading-relaxed text-slate-800 dark:text-slate-200"
                controlsAlign="start"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------- Practice speaking & grade directly on any question (without regenerating anything) ----------
const LibraryPractice = ({
  question: initialQuestion,
  session,
  startInRecordMode = false,
  onBack,
  onStatusChanged,
}) => {
  const [currentQ, setCurrentQ] = useState(initialQuestion);
  const [answersByQId, setAnswersByQId] = useState(() => {
    const map = {};
    (session?.questions || []).forEach((q) => {
      if (q.existing_answer) map[q.id] = q.existing_answer;
    });
    if (initialQuestion?.existing_answer) {
      map[initialQuestion.id] = initialQuestion.existing_answer;
    }
    return map;
  });
  const [statusByQId, setStatusByQId] = useState(() => {
    const map = {};
    (session?.questions || []).forEach((q) => {
      map[q.id] = q.study_status || 'unlearned';
    });
    return map;
  });

  const answer = answersByQId[currentQ.id] || null;
  const [isRecording, setIsRecording] = useState(startInRecordMode || !initialQuestion.existing_answer);
  const [submitting, setSubmitting] = useState(false);
  const [autoStartRecord, setAutoStartRecord] = useState(false);
  const [showQuestionText, setShowQuestionText] = useState(true);
  const [showModelHint, setShowModelHint] = useState(false); // toggle script visibility while practicing from memory
  const [showGuide, setShowGuide] = useState(false);

  const qIndex = currentQ?.order_index || 1;
  const allQuestions = session?.questions || [];
  const totalCount = allQuestions.length || 15;
  const preferredLevel = session?.default_model_level || 'IM';
  const currentModel =
    (currentQ?.model_answers || []).find((m) => m.level === preferredLevel) ||
    (currentQ?.model_answers || [])[0] ||
    null;

  const handleJumpToOrder = (targetOrder) => {
    const targetQ = allQuestions.find((q) => q.order_index === targetOrder);
    if (!targetQ || targetQ.id === currentQ.id) return;
    const targetAns = answersByQId[targetQ.id] || targetQ.existing_answer || null;
    setCurrentQ(targetQ);
    setAutoStartRecord(false);
    setShowGuide(false);
    setShowModelHint(false);
    setIsRecording(startInRecordMode ? true : !targetAns);
  };

  const handleUpdateStatus = async (newStatus) => {
    const qid = currentQ.id;
    setStatusByQId((prev) => ({ ...prev, [qid]: newStatus }));
    try {
      await libraryApi.updateStudyStatus(qid, newStatus);
      if (onStatusChanged) onStatusChanged(qid, newStatus);
    } catch (err) {
      console.error('Failed to update study status', err);
    }
  };

  const handleRecordingComplete = async ({ audioBlob, durationSeconds }) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('question_id', currentQ.id);
      formData.append('session_id', session.session_id);
      formData.append('duration_seconds', durationSeconds);
      if (audioBlob) formData.append('audio_file', audioBlob, recordingFileName(audioBlob, `library_q${currentQ.id}`));
      const res = await answerApi.submit(formData);
      setAnswersByQId((prev) => ({ ...prev, [currentQ.id]: res.data }));
      if ((statusByQId[currentQ.id] || 'unlearned') === 'unlearned') {
        handleUpdateStatus('learning');
      }
      setIsRecording(false);
    } catch (err) {
      console.error('Failed to submit practice answer', err);
      alert(formatApiError(err, 'Không lưu được câu trả lời. Vui lòng ghi âm lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const topSwitchHeader = (
    <div className="glass-panel bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-3 gap-y-3 shadow-sm">
      <div className="basis-full sm:basis-auto flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center font-bold text-sm text-brand-600 dark:text-brand-400">
          {qIndex}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
              Câu {qIndex} / {totalCount}
            </span>
            <span className="truncate text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              {currentQ?.category_label || currentQ?.topic}
            </span>
            {answer && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" />
                Đã nói
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {session.is_study_pack ? `Bộ 50 câu ôn tập (${preferredLevel})` : `Bộ đề #${session.set_number ?? session.session_number ?? session.session_id}`}
            {session.dev_mock ? ' · DEV' : ''}
          </p>
        </div>
      </div>

      {allQuestions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleJumpToOrder(qIndex - 1)}
              disabled={qIndex <= 1}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
                qIndex > 1
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-xs'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-[11px]">Câu trước</span>
            </button>
            <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700" />
            <button
              type="button"
              onClick={() => handleJumpToOrder(qIndex + 1)}
              disabled={qIndex >= totalCount}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
                qIndex < totalCount
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-xs'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <span className="text-[11px]">Câu sau</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {allQuestions.length <= 20 && (
            <div className="flex items-center gap-1.5">
              {allQuestions.map((qItem) => {
                const dotIdx = qItem.order_index;
                const isDone = !!(answersByQId[qItem.id] || qItem.existing_answer);
                return (
                  <button
                    key={qItem.id}
                    type="button"
                    onClick={() => handleJumpToOrder(dotIdx)}
                    title={`Câu ${dotIdx}${isDone ? ' (Đã làm)' : ''}`}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer hover:scale-135 ${
                      dotIdx === qIndex
                        ? 'bg-brand-500 ring-2 ring-brand-500/30 scale-125'
                        : isDone
                        ? 'bg-emerald-500 dark:bg-emerald-400'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Quay lại Bộ đề</span>
      </button>
    </div>
  );

  if (answer && !isRecording) {
    return (
      <div className="max-w-6xl mx-auto px-3.5 sm:px-4 pt-4 flex flex-col gap-2">
        {topSwitchHeader}
        <AnswerCoaching
          answerId={answer.id}
          answer={answer}
          question={currentQ}
          assessmentLevel={session.self_assessment_level || 4}
          studyStatus={statusByQId[currentQ.id] || 'unlearned'}
          onUpdateStudyStatus={handleUpdateStatus}
          nextLabel={qIndex >= totalCount ? 'Quay lại bộ đề' : 'Sang câu tiếp theo'}
          onNextQuestion={() => {
            if (qIndex >= totalCount) {
              onBack();
            } else {
              handleJumpToOrder(qIndex + 1);
            }
          }}
          onTranscriptEdited={(newText) =>
            setAnswersByQId((prev) => ({
              ...prev,
              [currentQ.id]: prev[currentQ.id] ? { ...prev[currentQ.id], transcript_edited: newText } : prev[currentQ.id],
            }))
          }
          onRetryQuestion={() => {
            setIsRecording(true);
            setAutoStartRecord(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4">
      {topSwitchHeader}
      {answer && (
        <div className="rounded-xl px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200">
          <span>
            Bạn đang <strong>Luyện nói & Chấm điểm</strong> cho Câu {currentQ.order_index}. Câu hỏi và bài mẫu vẫn giữ nguyên không bị tạo lại.
          </span>
          <button
            type="button"
            onClick={() => setIsRecording(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Xem kết quả chấm gần nhất →</span>
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex flex-col items-center">
            <EvaAvatar
              key={currentQ.id}
              audioUrl={currentQ.audio_path}
              text={currentQ.question_text}
              autoPlay
              maxReplays={1}
              onSecondReadEnded={() => setAutoStartRecord(true)}
            />
          </div>
          <div className="w-full flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-brand-500" />
                <span>Nội dung câu hỏi</span>
              </span>
              <button
                type="button"
                onClick={() => setShowQuestionText((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors cursor-pointer"
              >
                {showQuestionText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showQuestionText ? 'Ẩn câu hỏi' : 'Hiện câu hỏi'}</span>
              </button>
            </div>
            <div className="w-full min-h-[100px] p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
              {showQuestionText ? (
                <div className="w-full">
                  <TranslatableText
                    text={currentQ.question_text}
                    preTranslatedVi={currentQ.question_translation_vi}
                    className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed text-center"
                    controlsAlign="end"
                  />
                </div>
              ) : (
                <span className="text-xs italic text-slate-400 dark:text-slate-500">Nội dung câu hỏi đang ẩn. Bấm "Hiện câu hỏi" để đọc văn bản.</span>
              )}
            </div>
          </div>

          {/* Toggle model answer script while practicing speaking (memory recall vs read-aloud) */}
          {currentModel && (
            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowModelHint((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-semibold text-sky-700 dark:text-sky-300 transition-colors cursor-pointer"
              >
                {showModelHint ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showModelHint ? `Che bài mẫu ${currentModel.level} (tự nhớ nói)` : `Hiện bài mẫu ${currentModel.level} để đọc theo`}</span>
              </button>
              {showModelHint && (
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
                  {currentModel.text}
                </div>
              )}
            </div>
          )}

          {currentQ?.vietnamese_guide && (
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Xem khung gợi ý trả lời (Blueprint Guide)</span>
            </button>
          )}
        </div>
        <div className="lg:col-span-7 relative">
          <AudioRecorder
            key={currentQ.id}
            onRecordingComplete={handleRecordingComplete}
            isPracticeMode
            autoStart={autoStartRecord}
            targetDurationMin={currentQ.timing?.target_min_sec || 45}
            targetDurationMax={currentQ.timing?.time_limit_sec || 90}
          />
          {submitting && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-slate-950/80 flex items-center justify-center gap-2 text-sky-400 text-sm font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Đang nhận dạng giọng nói & chuyển sang chấm điểm...</span>
            </div>
          )}
        </div>
      </div>

      {showGuide && currentQ?.vietnamese_guide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-emerald-500/30 shadow-2xl flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Chiến thuật trả lời đề xuất</h3>
              <button onClick={() => setShowGuide(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto pr-1">
              {currentQ.vietnamese_guide.steps?.map((step) => (
                <div key={step.step_number} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1 text-xs">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">
                    Bước {step.step_number}: {step.title}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">🇻🇳 {step.hint_vi}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Create 50-Question Study Pack Modal (mobile-first bottom sheet) ----------
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
              <span>Tạo bộ 50 câu ôn tập học thuộc</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Không có câu giới thiệu. Phủ 100% Survey của bạn (Nhà ở, Nghỉ ở nhà, Phim, Công viên, Nhạc, Nấu ăn, Đi bộ) + 3 chủ đề chính + 3 Role-play + 4 Đột xuất.
            </p>
          </div>
          <button type="button" disabled={creating} onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Level (default IM) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mức bài mẫu mặc định:</label>
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

        {/* 3 Official Topics (pre-checked from survey) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            3 Chủ đề chính đã tích ở Survey ({topics.length}/3):
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

        {/* Optional personal profile in Vietnamese so all 50 models fit real life */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Hồ sơ ngắn của bạn (tuỳ chọn — tiếng Việt hay Anh):
          </label>
          <textarea
            rows={3}
            value={personalProfile}
            onChange={(e) => setPersonalProfile(e.target.value)}
            placeholder="Ví dụ: Tôi sống cùng gia đình ở chung cư tại TP.HCM, hay nấu món Việt đơn giản, thích đi công viên buổi sáng và nghe nhạc pop... (Có thể để trống)"
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 resize-none outline-none focus:border-brand-500"
          />
        </div>

        {SHOW_DEV_MOCK && (
          <label className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 cursor-pointer">
            <input type="checkbox" checked={devMock} onChange={(e) => setDevMock(e.target.checked)} />
            <span>DEV: Giả lập không gọi AI (test nhanh local)</span>
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
            <span>{creating ? 'Đang khởi tạo 50 câu...' : 'Tạo ngay 50 câu'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------- Main page ----------
export const QuestionLibrary = ({ onStartPackExam }) => {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [selected, setSelected] = useState([]); // ordered question ids
  const [levelOverride, setLevelOverride] = useState('auto');
  const [includeQuestion, setIncludeQuestion] = useState(true);
  const [loop, setLoop] = useState(true);
  const [generating, setGenerating] = useState({}); // question id -> true while generating
  const [player, setPlayer] = useState(null);
  const [practice, setPractice] = useState(null);
  const [view, setView] = useState('sets'); // 'sets' | 'topics'
  const [activeCategory, setActiveCategory] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unlearned' | 'learning' | 'mastered'
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [regenTarget, setRegenTarget] = useState(null); // { question, level }
  const [regenLoading, setRegenLoading] = useState(false);
  const [startingExamId, setStartingExamId] = useState(null);
  const [packProgressMap, setPackProgressMap] = useState({}); // session_id -> progress obj
  const audioRef = useRef(null);
  const pollRef = useRef(null);
  const packPollRef = useRef(null);

  const load = async (autoExpandSessionId = null) => {
    try {
      const res = await libraryApi.get();
      setSets(res.data);
      const nextProgress = {};
      res.data.forEach((s) => {
        if (s.study_progress) nextProgress[s.session_id] = s.study_progress;
      });
      setPackProgressMap(nextProgress);
      if (autoExpandSessionId) {
        setExpanded((prev) => ({ ...prev, [autoExpandSessionId]: true }));
      } else {
        setExpanded((prev) => (Object.keys(prev).length || !res.data.length ? prev : { [res.data[0].session_id]: true }));
      }
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

  // Poll any running study pack background job until complete
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
      if (changed) {
        await load();
      }
    }, POLL_MS);

    return () => clearTimeout(packPollRef.current);
  }, [packProgressMap]);

  const questionIndex = useMemo(() => {
    const map = {};
    sets.forEach((s) => s.questions.forEach((q) => { map[q.id] = { q, s }; }));
    return map;
  }, [sets]);

  const latestUserTopics = useMemo(() => {
    const found = sets.find((s) => s.topics?.length === 3);
    return found ? found.topics : ['environment', 'socio_cultural', 'communication_media'];
  }, [sets]);

  const levelFor = (s) => (levelOverride === 'auto' ? s.default_model_level : levelOverride);
  const modelFor = (q, s) =>
    q.model_answers.find((m) => m.level === levelFor(s)) || q.model_answers[0] || null;
  const isListenable = (q) => q.question_type !== 'self_intro';
  const matchesStatusFilter = (q) => statusFilter === 'all' || (q.study_status || 'unlearned') === statusFilter;

  const toggleSelect = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectMany = (ids) => {
    const allIn = ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected((prev) => (allIn ? prev.filter((id) => !ids.includes(id)) : [...prev, ...ids.filter((id) => !prev.includes(id))]));
  };

  // Topic view grouped by category
  const categories = useMemo(() => {
    const map = {};
    sets.forEach((set) => set.questions.forEach((q) => {
      if (!matchesStatusFilter(q)) return;
      if (!map[q.category]) map[q.category] = { key: q.category, label: q.category_label, items: [] };
      map[q.category].items.push({ q, s: set });
    }));
    const order = ['home', 'leisure', 'environment', 'human_rights', 'global_workplace', 'socio_cultural', 'communication_media', 'role_play', 'unexpected', 'self_intro'];
    return Object.values(map).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [sets, statusFilter]);

  useEffect(() => {
    if (view === 'topics' && (!activeCategory || !categories.some((c) => c.key === activeCategory)) && categories.length) {
      setActiveCategory(categories[0].key);
    }
  }, [view, categories, activeCategory]);

  const markGenerating = (ids, value) => setGenerating((prev) => {
    const next = { ...prev };
    ids.forEach((id) => { if (value) next[id] = true; else delete next[id]; });
    return next;
  });

  const handleGenerateMissing = async (ids, level = 'IM') => {
    if (!ids.length) return;
    markGenerating(ids, true);
    await generateMissingModelAnswers(ids, level, (id) => markGenerating([id], false));
    await load();
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
      alert(formatApiError(err, 'Không tạo lại được bài mẫu. Vui lòng thử lại.'));
    } finally {
      setRegenLoading(false);
    }
  };

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
      console.error('Failed to update study status', err);
      load();
    }
  };

  const handleResumeStudyPack = async (sessionId) => {
    try {
      const { data } = await libraryApi.resumeStudyPack(sessionId);
      setPackProgressMap((m) => ({ ...m, [sessionId]: data }));
    } catch (err) {
      alert(formatApiError(err, 'Không tiếp tục tạo được bộ ôn tập.'));
    }
  };

  const handleStartExamFromPack = async (sessionId) => {
    if (!onStartPackExam || startingExamId) return;
    setStartingExamId(sessionId);
    try {
      const { data } = await libraryApi.startExamFromPack(sessionId, 'exam');
      onStartPackExam(data.session_id, data.mode);
    } catch (err) {
      alert(formatApiError(err, 'Không tạo được bài thi thử từ bộ ôn tập.'));
    } finally {
      setStartingExamId(null);
    }
  };

  const handleDeleteSet = async (s) => {
    const label = s.is_study_pack ? 'Bộ 50 câu ôn tập' : `Bộ đề #${s.set_number ?? s.session_number ?? s.session_id}`;
    if (!window.confirm(`Xóa ${label}? Toàn bộ câu hỏi và câu trả lời của bộ này sẽ bị xóa.`)) return;
    try {
      await sessionApi.delete(s.session_id);
      setSelected((prev) => prev.filter((id) => !s.questions.some((q) => q.id === id)));
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Không xóa được bộ đề.'));
    }
  };

  const handleDeleteAllSets = async () => {
    if (!sets.length) return;
    if (!window.confirm('Xóa toàn bộ tất cả bộ đề & bộ ôn tập và reset số thứ tự về #1? (Tài khoản và sổ từ vựng vẫn được giữ nguyên)')) return;
    try {
      await sessionApi.deleteAll();
      setSelected([]);
      setPlayer(null);
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Không xóa được toàn bộ bộ đề.'));
    }
  };

  const pollPlaylist = async (body) => {
    try {
      const res = await libraryApi.playlist(body);
      const { ready, url, done, total } = res.data;
      if (ready) {
        setPlayer({ status: 'ready', url: resolveMediaUrl(url), done: total, total });
        return;
      }
      setPlayer({ status: 'building', done, total });
      pollRef.current = setTimeout(() => pollPlaylist(body), POLL_MS);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPlayer({ status: 'error', message: typeof detail === 'string' ? detail : detail?.message || 'Không tạo được file nghe.' });
    }
  };

  // Never regenerates existing model answers; only builds missing ones if not yet in DB
  const handleBuildPlaylist = async (ids = selected) => {
    if (!ids.length) return;
    clearTimeout(pollRef.current);
    setPlayer({ status: 'preparing', done: 0, total: ids.length });

    const missing = ids.filter((id) => {
      const entry = questionIndex[id];
      return entry && !modelFor(entry.q, entry.s);
    });
    if (missing.length) {
      const lvl = levelOverride === 'auto' ? 'IM' : levelOverride;
      markGenerating(missing, true);
      await generateMissingModelAnswers(missing, lvl, (id) => markGenerating([id], false));
      await load();
    }

    const body = { question_ids: ids, include_question: includeQuestion };
    if (levelOverride !== 'auto') body.level = levelOverride;
    pollPlaylist(body);
  };

  useEffect(() => {
    if (player?.status !== 'ready' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: `OPIc Practice · ${selected.length} câu`,
        artist: 'Eva · OPIc Practice Studio',
        album: 'Question Bank',
      });
    } catch (e) {}
  }, [player?.status, player?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop, player?.url]);

  const renderQuestion = (q, s, showSetTag = false) => {
    const model = modelFor(q, s);
    const targetLvl = levelFor(s) || 'IM';
    const isChecked = selected.includes(q.id);
    const listenable = isListenable(q);
    const hasExamData = !!q.existing_answer;
    const stKey = q.study_status || 'unlearned';
    const stMeta = STUDY_STATUS_META[stKey] || STUDY_STATUS_META.unlearned;

    return (
      <div key={q.id} className="p-4 flex items-start gap-3">
        {listenable ? (
          <button
            onClick={() => toggleSelect(q.id)}
            className="mt-0.5 text-slate-400 hover:text-brand-500 cursor-pointer shrink-0"
            aria-label={`Chọn câu ${q.order_index}`}
          >
            {isChecked ? <CheckSquare className="w-4 h-4 text-brand-500" /> : <Square className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          {/* Question badges + 1-tap Study Status */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-bold text-brand-600 dark:text-brand-400">
              {showSetTag ? `#${s.set_number ?? s.session_number ?? s.session_id} · ` : ''}Q{q.order_index}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              {q.category_label}
            </span>
            <button
              type="button"
              onClick={() => handleCycleStatus(q)}
              title="Chạm để đổi trạng thái: Chưa học → Đang học → Đã thuộc"
              className={`px-2 py-0.5 rounded-full border font-bold cursor-pointer transition-colors ${stMeta.cls}`}
            >
              {stMeta.label}
            </button>
            {q.practice_count > 0 && (
              <span className="text-slate-500 dark:text-slate-400">
                Đã nói {q.practice_count} lần{q.last_level ? ` · ${q.last_level}` : ''}
              </span>
            )}
          </div>

          {/* Question text with instant Vietnamese translation */}
          <TranslatableText
            text={q.question_text}
            preTranslatedVi={q.question_translation_vi}
            className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed"
            controlsAlign="start"
          />

          {/* Model Answer (saved in DB, sentence-by-sentence, instant Dịch câu + Regenerate with custom prompt) */}
          {model ? (
            <details className="group" open={s.is_study_pack && q.order_index <= 2}>
              <summary className="cursor-pointer text-xs font-bold text-emerald-700 dark:text-emerald-400 select-none">
                Bài mẫu chuẩn {model.level} (đã lưu cố định)
              </summary>
              <div className="mt-2.5 flex flex-col gap-2.5 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SpeakButton
                    text={model.text}
                    audioUrl={model.audio_path}
                    id={`lib-model-${q.id}-${model.level}`}
                    label="Nghe cả bài mẫu"
                    playingLabel="Đang đọc bài mẫu"
                  />
                  <button
                    type="button"
                    onClick={() => setRegenTarget({ question: q, level: model.level })}
                    disabled={!!generating[q.id]}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-500/15 text-slate-700 dark:text-slate-200 hover:text-amber-700 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    title="Tạo lại bài mẫu theo ý tưởng riêng của bạn hoặc đổi câu chuyện khác"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Tạo lại mẫu</span>
                  </button>
                </div>

                <ModelSentencesViewer model={model} questionId={q.id} />
              </div>
            </details>
          ) : (
            <button
              onClick={() => handleGenerateMissing([q.id], targetLvl)}
              disabled={!!generating[q.id]}
              className="self-start flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer disabled:opacity-60"
            >
              {generating[q.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{generating[q.id] ? `Đang tạo bài mẫu ${targetLvl}...` : `Tạo bài mẫu ${targetLvl}`}</span>
            </button>
          )}

          {q.last_audio_path && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-sky-700 dark:text-sky-400">Bản ghi gần nhất của bạn</summary>
              <div className="mt-2 flex flex-col gap-1.5">
                <audio src={resolveMediaUrl(q.last_audio_path)} controls preload="none" className="w-full max-w-md h-8" />
                <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">{q.last_transcript || '(không nhận dạng được lời nói)'}</p>
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPractice({ question: q, session: s, startInRecordMode: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-sm cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Luyện nói & Chấm điểm</span>
            </button>
            {hasExamData && (
              <button
                onClick={() => setPractice({ question: q, session: s, startInRecordMode: false })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Xem điểm lần trước</span>
              </button>
            )}
            <SpeakButton
              variant="question"
              text={q.question_text}
              audioUrl={q.audio_path}
              id={`lib-q-${q.id}`}
              label="Nghe câu hỏi"
              playingLabel="Đang đọc câu hỏi"
            />
            {listenable && (
              <button
                onClick={() => { setSelected([q.id]); handleBuildPlaylist([q.id]); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Chỉ nghe câu này</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (practice) {
    return (
      <LibraryPractice
        question={practice.question}
        session={practice.session}
        startInRecordMode={!!practice.startInRecordMode}
        onStatusChanged={(qid, newStatus) => {
          setSets((prev) =>
            prev.map((s) => ({
              ...s,
              questions: s.questions.map((item) => (item.id === qid ? { ...item, study_status: newStatus } : item)),
            }))
          );
        }}
        onBack={() => { setPractice(null); load(); }}
      />
    );
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 ${selected.length || player ? 'pb-56 md:pb-44' : ''}`}>
      {/* Header + Create 50-question Study Pack button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Library className="w-6 h-6 text-brand-500" />
            <span>Bộ đề & Ôn tập học thuộc</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Học thuộc bài mẫu chuẩn <strong>IM</strong>, luyện nói chấm điểm không làm thay đổi đề, rồi bấm thi thử 15 câu ngay trên bộ đã học.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowStudyModal(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-500/20 cursor-pointer transition-all shrink-0"
        >
          <GraduationCap className="w-4 h-4" />
          <span>Tạo bộ 50 câu ôn tập (IM)</span>
        </button>
      </div>

      {/* Listening & Study status filter controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-xs text-slate-700 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'unlearned', label: 'Chưa học' },
            { key: 'learning', label: 'Đang học' },
            { key: 'mastered', label: 'Đã thuộc' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                statusFilter === f.key
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5">
          <span className="font-semibold">Mức bài mẫu:</span>
          <select
            value={levelOverride}
            onChange={(e) => setLevelOverride(e.target.value)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
          >
            <option value="auto">Theo bộ (IM)</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={includeQuestion} onChange={(e) => setIncludeQuestion(e.target.checked)} />
          <span>Đọc cả câu hỏi trước bài mẫu</span>
        </label>
      </div>

      {/* View switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {[{ key: 'sets', label: 'Theo bộ đề' }, { key: 'topics', label: 'Theo chủ đề' }].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                view === tab.key ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {sets.length > 0 && (
          <button
            onClick={handleDeleteAllSets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa tất cả bộ đề</span>
          </button>
        )}
      </div>

      {view === 'topics' && !loading && sets.length > 0 && (() => {
        const current = categories.find((c) => c.key === activeCategory) || categories[0];
        const ids = current ? current.items.filter(({ q }) => isListenable(q)).map(({ q }) => q.id) : [];
        const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setActiveCategory(c.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                    current?.key === c.key
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {c.label} <span className="opacity-70">({c.items.length})</span>
                </button>
              ))}
            </div>
            {current ? (
              <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{current.label} · {current.items.length} câu</p>
                  {ids.length > 0 && (
                    <button
                      onClick={() => toggleSelectMany(ids)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-brand-500" /> : <Square className="w-3.5 h-3.5" />}
                      <span>{allSelected ? 'Bỏ chọn' : 'Chọn tất cả'}</span>
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                  {current.items.map(({ q, s }) => renderQuestion(q, s, true))}
                </div>
              </div>
            ) : (
              <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                Không có câu hỏi nào khớp bộ lọc trạng thái đang chọn.
              </div>
            )}
          </div>
        );
      })()}

      {view !== 'sets' ? null : loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải bộ đề...
        </div>
      ) : !sets.length ? (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-8 sm:p-10 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
            Chưa có bộ ôn tập hay bộ đề nào.
          </p>
          <button
            type="button"
            onClick={() => setShowStudyModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Tạo ngay bộ 50 câu ôn tập (IM)</span>
          </button>
        </div>
      ) : sets.map((s) => {
        const isOpen = !!expanded[s.session_id];
        const visibleQuestions = s.questions.filter(matchesStatusFilter);
        const setIds = visibleQuestions.filter(isListenable).map((q) => q.id);
        const unlearnedReadyIds = s.questions
          .filter((q) => isListenable(q) && (q.study_status || 'unlearned') !== 'mastered' && !!modelFor(q, s))
          .map((q) => q.id);
        const allSelected = setIds.length > 0 && setIds.every((id) => selected.includes(id));
        const missingModels = s.questions.filter((q) => !modelFor(q, s)).map((q) => q.id);
        const masteredCount = s.questions.filter((q) => q.study_status === 'mastered').length;
        const prog = packProgressMap[s.session_id] || s.study_progress;
        const isPackBuilding = prog && prog.running && prog.done < prog.total;
        const isPackIncomplete = s.is_study_pack && prog && !prog.running && prog.done < prog.total;

        return (
          <div
            key={s.session_id}
            className={`glass-card bg-white dark:bg-slate-900/90 rounded-2xl border shadow-sm overflow-hidden ${
              s.is_study_pack
                ? 'border-emerald-300 dark:border-emerald-500/40'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            {/* Set header */}
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [s.session_id]: !isOpen }))}
                  className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {s.is_study_pack
                          ? `Bộ ôn tập ${s.questions.length} câu (${s.default_model_level})`
                          : `Bộ đề #${s.set_number ?? s.session_number ?? s.session_id}`}
                        {' · '}{new Date(s.started_at).toLocaleDateString()}
                      </p>
                      {s.is_study_pack && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Đã thuộc {masteredCount}/{s.questions.length}
                        </span>
                      )}
                      {s.dev_mock && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-dashed border-amber-400 text-amber-700 dark:text-amber-300">
                          DEV
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Mức {s.default_model_level} · {s.is_study_pack ? 'Học thuộc trước khi thi' : s.mode === 'exam' ? 'Strict exam' : 'Practice'} · {s.topics.map((t) => t.replace(/_/g, ' ')).join(', ')}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleDeleteSet(s)}
                  title="Xóa bộ này"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Background generation progress bar for Study Packs */}
              {isPackBuilding && (
                <div className="rounded-xl p-3 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-sky-800 dark:text-sky-200">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang tạo bài mẫu {prog.target_level} & bản dịch: {prog.done}/{prog.total} câu (xong câu nào học ngay câu đó)
                    </span>
                    <span>{Math.round((prog.done / Math.max(1, prog.total)) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-sky-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all"
                      style={{ width: `${Math.round((prog.done / Math.max(1, prog.total)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {isPackIncomplete && (
                <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
                  <span>Đã tạo {prog.done}/{prog.total} câu bài mẫu {prog.target_level}. Còn {prog.total - prog.done} câu chưa có bài mẫu.</span>
                  <button
                    type="button"
                    onClick={() => handleResumeStudyPack(s.session_id)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer"
                  >
                    Tiếp tục tạo {prog.total - prog.done} câu còn lại
                  </button>
                </div>
              )}

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2">
                {s.is_study_pack && onStartPackExam && (
                  <button
                    type="button"
                    onClick={() => handleStartExamFromPack(s.session_id)}
                    disabled={startingExamId === s.session_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {startingExamId === s.session_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>Thi thử 15 câu từ bộ này</span>
                  </button>
                )}

                {s.is_study_pack && unlearnedReadyIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(unlearnedReadyIds);
                      handleBuildPlaylist(unlearnedReadyIds);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/30 cursor-pointer"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Nghe câu chưa thuộc ({unlearnedReadyIds.length})</span>
                  </button>
                )}

                {!s.is_study_pack && missingModels.length > 0 && (
                  <button
                    onClick={() => handleGenerateMissing(missingModels, levelFor(s))}
                    disabled={missingModels.some((id) => generating[id])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 cursor-pointer disabled:opacity-60"
                  >
                    {missingModels.some((id) => generating[id]) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Tạo bài mẫu ({missingModels.length})</span>
                  </button>
                )}

                <button
                  onClick={() => toggleSelectMany(setIds)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-brand-500" /> : <Square className="w-3.5 h-3.5" />}
                  <span>{allSelected ? 'Bỏ chọn' : 'Chọn cả bộ'}</span>
                </button>
              </div>
            </div>

            {/* Questions */}
            {isOpen && (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                {visibleQuestions.length > 0 ? (
                  visibleQuestions.map((q) => renderQuestion(q, s))
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Không có câu nào ở trạng thái đang lọc.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Listening player (sticky, above the phone tab bar) */}
      {(selected.length > 0 || player) && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <ListMusic className="w-4 h-4 text-brand-500" />
                <span>Đã chọn {selected.length} câu</span>
                {selected.length > 0 && (
                  <button onClick={() => { setSelected([]); setPlayer(null); clearTimeout(pollRef.current); }} className="text-slate-400 hover:text-rose-500 cursor-pointer" title="Bỏ chọn tất cả">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLoop((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    loop ? 'border-brand-400 text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Lặp lại</span>
                </button>
                <button
                  onClick={() => handleBuildPlaylist()}
                  disabled={!selected.length || player?.status === 'preparing' || player?.status === 'building'}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Nghe</span>
                </button>
                {player?.status === 'ready' && (
                  <a
                    href={player.url}
                    download={`opic-practice-${selected.length}-cau.mp3`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải MP3</span>
                  </a>
                )}
              </div>
            </div>

            {(player?.status === 'preparing' || player?.status === 'building') && (
              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {player.status === 'preparing'
                    ? 'Đang chuẩn bị bài mẫu...'
                    : `Eva đang thu âm ${player.done}/${player.total} đoạn (lần đầu có thể mất vài phút, các lần sau phát ngay)...`}
                </span>
              </div>
            )}
            {player?.status === 'error' && <p className="text-[11px] text-rose-600 dark:text-rose-400">{player.message}</p>}
            {player?.status === 'ready' && (
              <audio
                ref={audioRef}
                src={player.url}
                controls
                autoPlay
                loop={loop}
                preload="auto"
                className="w-full h-10"
              />
            )}
          </div>
        </div>
      )}

      {/* Study Pack Creation Bottom Sheet / Modal */}
      <StudyPackModal
        isOpen={showStudyModal}
        onClose={() => setShowStudyModal(false)}
        initialTopics={latestUserTopics}
        onCreated={(progData) => {
          setPackProgressMap((m) => ({ ...m, [progData.session_id]: progData }));
          load(progData.session_id);
        }}
      />

      {/* Personalized Regenerate Model Answer Bottom Sheet / Modal */}
      <RegenerateModal
        isOpen={!!regenTarget}
        onClose={() => !regenLoading && setRegenTarget(null)}
        onConfirm={handleConfirmRegenerate}
        loading={regenLoading}
        title={`Tạo lại bài mẫu Q${regenTarget?.question?.order_index || ''}`}
        levelLabel={regenTarget?.level || 'IM'}
      />
    </div>
  );
};
