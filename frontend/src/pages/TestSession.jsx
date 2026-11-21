import React, { useState, useEffect } from 'react';
import { sessionApi, questionApi, answerApi, formatApiError, recordingFileName } from '../api/client';
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  RotateCcw, 
  CheckCircle, 
  Sparkles, 
  Award,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  BookOpen,
  Lock,
  Languages,
  X
} from 'lucide-react';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { ViTooltip } from '../components/Tooltip';
import { TranslatableText } from '../components/TranslatableText';
import { AnswerCoaching } from './AnswerCoaching';
import { confirmDialog, notify } from '../context/NotificationContext';
import { recordStudyActivity } from '../utils/studyStreak';
import { useLanguage } from '../context/LanguageContext';

export const TestSession = ({
  sessionId,
  sessionMode = 'exam', // 'exam' or 'practice'
  onTestComplete,
  onExit
}) => {
  const { isVi, pick } = useLanguage();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [showQuestionText, setShowQuestionText] = useState(sessionMode !== 'exam');
  const [showQuestionVi, setShowQuestionVi] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [latestAnswer, setLatestAnswer] = useState(null);
  const [isAnswerCoachingOpen, setIsAnswerCoachingOpen] = useState(false);
  const [replayUsed, setReplayUsed] = useState(false);
  const [autoStartRecord, setAutoStartRecord] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [devModeOverride, setDevModeOverride] = useState(null); // allows toggling Practice <-> Exam inside a DEV session
  const [devFastFinishing, setDevFastFinishing] = useState(false);
  const [devMockLastAnswer, setDevMockLastAnswer] = useState(false);
  const [answeredOrders, setAnsweredOrders] = useState([]);
  const [coachingSkipped, setCoachingSkipped] = useState(false); // practice: coaching opened via "Next" without an answer
  const [pendingUpload, setPendingUpload] = useState(null); // keeps failed recording so user can retry without re-recording
  const [uploadError, setUploadError] = useState(null);

  // The session's stored mode wins (e.g. when resuming); in DEV sessions the user can toggle mode on the fly
  const effectiveMode = devModeOverride || sessionInfo?.mode || sessionMode;
  const isStrictExam = effectiveMode === 'exam';

  // Trap browser Back navigation in Exam Mode
  useEffect(() => {
    if (isStrictExam) {
      window.history.pushState(null, '', window.location.href);

      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
        notify.warning(
          'Bạn không được phép quay lại (Back) câu hỏi trước bằng nút trình duyệt trong phòng thi thật.',
          'Quy chế phòng thi OPIc'
        );
      };

      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = "Bạn có chắc chắn muốn rời khỏi bài thi OPIc? Tiến trình làm bài sẽ không được lưu.";
      };

      window.addEventListener('popstate', handlePopState);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isStrictExam]);

  const markOrderAnswered = (orderIdx) => {
    if (!orderIdx) return;
    setAnsweredOrders((prev) => (prev.includes(orderIdx) ? prev : [...prev, orderIdx].sort((a, b) => a - b)));
  };

  // Jump to specific question in Practice Mode
  const handleJumpToQuestion = async (targetIndex) => {
    if (isStrictExam) return;
    if (targetIndex < 1 || targetIndex > 15 || targetIndex === currentQuestion?.order_index) return;
    setLoadingQuestion(true);
    setShowQuestionText(true);
    setShowQuestionVi(false);
    setShowGuide(false);
    setCoachingSkipped(false);
    setReplayUsed(false);
    setAutoStartRecord(false);
    setPendingUpload(null);
    setUploadError(null);

    try {
      const res = await sessionApi.getQuestionByIndex(sessionId, targetIndex);
      const qData = res.data;
      setCurrentQuestion(qData);
      if (qData?.existing_answer) {
        setLatestAnswer(qData.existing_answer);
        setIsAnswerCoachingOpen(true);
        markOrderAnswered(qData.order_index);
      } else {
        setLatestAnswer(null);
        setIsAnswerCoachingOpen(false);
      }
    } catch (err) {
      console.error("Failed to load question", err);
    } finally {
      setLoadingQuestion(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      sessionApi.getStatus(sessionId)
        .then(res => {
          setSessionInfo(res.data);
          if (res.data?.mode === 'exam') setShowQuestionText(false);
          else if (res.data?.mode === 'practice') setShowQuestionText(true);
          if (Array.isArray(res.data?.answered_orders)) {
            setAnsweredOrders(res.data.answered_orders);
          }
        })
        .catch(err => console.warn("Failed to fetch session status", err));
    }
  }, [sessionId]);

  useEffect(() => {
    setShowQuestionText(!isStrictExam);
  }, [isStrictExam]);

  // Fetch next question (afterOrder = question being left, so an optional/skipped one isn't served again)
  const fetchNext = async (afterOrder) => {
    setLoadingQuestion(true);
    setShowQuestionText(!isStrictExam);
    setShowQuestionVi(false);
    setShowGuide(false);
    setLatestAnswer(null);
    setCoachingSkipped(false);
    setIsAnswerCoachingOpen(false);
    setReplayUsed(false);
    setAutoStartRecord(false);
    setPendingUpload(null);
    setUploadError(null);

    try {
      const res = await sessionApi.getNextQuestion(sessionId, afterOrder);
      const qData = res.data;
      setCurrentQuestion(qData);
      if (!isStrictExam && qData?.existing_answer) {
        setLatestAnswer(qData.existing_answer);
        setIsAnswerCoachingOpen(true);
        markOrderAnswered(qData.order_index);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        // Session setup was never completed (no questions generated)
        notify.warning('Phiên thi này chưa được tạo đề. Vui lòng bắt đầu bài thi mới.');
        if (onExit) onExit();
      } else if (err.response?.status === 404) {
        // All 15 questions answered!
        await sessionApi.finishSession(sessionId);
        onTestComplete();
      } else {
        console.error("Error loading next question", err);
      }
    } finally {
      setLoadingQuestion(false);
    }
  };

  useEffect(() => {
    fetchNext();
  }, [sessionId]);

  const handleRecordingComplete = async ({ audioBlob, durationSeconds, devMock = false }) => {
    if (!currentQuestion) return;
    setSubmittingAnswer(true);
    setUploadError(null);
    const useDevMock = Boolean(import.meta.env.DEV && devMock);

    try {
      const formData = new FormData();
      formData.append('question_id', currentQuestion.id);
      formData.append('session_id', sessionId);
      formData.append('duration_seconds', durationSeconds);
      if (useDevMock) {
        formData.append('dev_mock', 'true');
      }
      // Speech is transcribed on the server from the uploaded recording
      if (audioBlob) {
        formData.append('audio_file', audioBlob, recordingFileName(audioBlob, `q${currentQuestion.order_index}`));
      }

      const res = await answerApi.submit(formData);
      recordStudyActivity();
      setPendingUpload(null);
      setUploadError(null);
      setDevMockLastAnswer(useDevMock);
      setLatestAnswer(res.data);
      setCoachingSkipped(false);
      markOrderAnswered(currentQuestion.order_index);

      if (!isStrictExam) {
        // In practice mode, open coaching review immediately
        setIsAnswerCoachingOpen(true);
      } else {
        // In exam mode, proceed directly to next question or complete
        if (currentQuestion.order_index >= 15) {
          await sessionApi.finishSession(sessionId);
          onTestComplete();
        } else {
          fetchNext(currentQuestion.order_index);
        }
      }
    } catch (err) {
      console.error("Failed to submit answer:", err);
      const msg = formatApiError(err, 'Không lưu được câu trả lời. Vui lòng thử lại.');
      if (audioBlob) {
        setPendingUpload({ audioBlob, durationSeconds });
      }
      setUploadError(msg);
      notify.error(msg);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // Local DEV helper: simulate remaining answers and jump straight to SessionReport UI
  const handleDevFastFinish = async () => {
    if (!import.meta.env.DEV || devFastFinishing) return;
    setDevFastFinishing(true);
    try {
      const { data: qs } = await sessionApi.getQuestions(sessionId);
      for (const q of (qs || []).filter((item) => item.order_index >= 2)) {
        if (!answeredOrders.includes(q.order_index)) {
          const fd = new FormData();
          fd.append('question_id', q.id);
          fd.append('session_id', sessionId);
          fd.append('duration_seconds', '65');
          fd.append('dev_mock', 'true');
          await answerApi.submit(fd);
        }
      }
      await sessionApi.finishSession(sessionId);
      recordStudyActivity();
      notify.success('Đã giả lập hoàn thành toàn bộ bài thi để kiểm tra báo cáo.');
      onTestComplete();
    } catch (err) {
      notify.error(formatApiError(err, 'Không giả lập hoàn thành bài thi được.'));
    } finally {
      setDevFastFinishing(false);
    }
  };

  // "Next" without recording: skip the current question (last question finishes the test)
  const handleSkipQuestion = async () => {
    if (!currentQuestion || submittingAnswer) return;

    if (!isStrictExam) {
      // Practice: still show the question, guide and model answers, like after a recording
      setLatestAnswer(null);
      setCoachingSkipped(true);
      setIsAnswerCoachingOpen(true);
      return;
    }

    // Strict exam: the skipped question is closed for good (kept across exit/resume)
    try {
      await sessionApi.skipQuestion(sessionId, currentQuestion.order_index);
    } catch (err) {
      console.warn("Failed to record skipped question", err);
    }
    if (currentQuestion.order_index >= 15) {
      await sessionApi.finishSession(sessionId);
      onTestComplete();
    } else {
      fetchNext(currentQuestion.order_index);
    }
  };

  if (loadingQuestion) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading interview question...</p>
      </div>
    );
  }

  const qIndex = currentQuestion?.order_index || 1;
  const topProgressHeader = (
    <div className="glass-panel bg-white dark:bg-slate-900/90 rounded-2xl p-2.5 sm:p-4 border border-slate-200 dark:border-slate-800 flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-2 sm:gap-x-3 gap-y-2 shadow-sm shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center font-bold text-xs sm:text-sm text-brand-600 dark:text-brand-400">
          {qIndex}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">Câu {qIndex}/15</span>
            <span className="truncate text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 max-w-[130px] sm:max-w-none">
              {currentQuestion?.topic}
            </span>
            {!isStrictExam && answeredOrders.includes(qIndex) && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" />
                Đã xong
              </span>
            )}
          </div>
          <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 capitalize">Type: {currentQuestion?.question_type?.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Center: Navigation Controls (Locked in Exam, Free in Practice) */}
      {!isStrictExam ? (
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Arrow Navigation buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleJumpToQuestion(qIndex - 1)}
              disabled={qIndex <= 1}
              className={`px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
                qIndex > 1
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-xs'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
              title="Lùi về câu trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">{pick('Câu trước', 'Prev')}</span>
            </button>

            <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700" />

            <button
              onClick={() => handleJumpToQuestion(qIndex + 1)}
              disabled={qIndex >= 15}
              className={`px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
                qIndex < 15
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-xs'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
              title={pick('Tiến tới câu sau', 'Next question')}
            >
              <span className="hidden sm:inline text-[11px]">{pick('Câu sau', 'Next')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clickable Progress Dots in Practice Mode (Desktop/Tablet) */}
          <div className="hidden sm:flex items-center gap-1.5">
            {[...Array(15)].map((_, i) => {
              const dotIdx = i + 1;
              const isDone = answeredOrders.includes(dotIdx);
              return (
                <button
                  key={i}
                  onClick={() => handleJumpToQuestion(dotIdx)}
                  title={`${pick('Câu', 'Q')} ${dotIdx}${isDone ? pick(' (Đã hoàn thành)', ' (Answered)') : ''}`}
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
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20" title={pick('Quy chế thi OPIc: Không được lùi lại câu hỏi trước', 'OPIc rule: You cannot go back to previous questions')}>
            <Lock className="w-3 h-3" />
            <span className="hidden md:inline">{pick('Không lùi câu', 'No backtrack')}</span>
          </div>

          {/* Read-only Progress Dots in Exam Mode */}
          <div className="hidden sm:flex items-center gap-1.5">
            {[...Array(15)].map((_, i) => {
              const dotIdx = i + 1;
              return (
                <div
                  key={i}
                  title={`${pick('Câu', 'Q')} ${dotIdx} / 15`}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    dotIdx < qIndex
                      ? 'bg-emerald-500 dark:bg-emerald-400'
                      : dotIdx === qIndex
                      ? 'bg-brand-500 ring-2 ring-brand-500/30 scale-125'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Mode Tag */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {import.meta.env.DEV && sessionInfo?.dev_mock ? (
          <button
            type="button"
            onClick={() => setDevModeOverride(isStrictExam ? 'practice' : 'exam')}
            title={pick('Phiên DEV: Bấm để chuyển đổi nhanh giữa Bộ đề và Thi thật', 'DEV Session: Toggle Real Exam / Study Pack')}
            className={`text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg border whitespace-nowrap cursor-pointer transition-all ${
              isStrictExam
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <span className="sm:hidden">{isStrictExam ? pick('Thi thật · DEV', 'Exam · DEV') : pick('Bộ đề · DEV', 'Pack · DEV')}</span>
            <span className="hidden sm:inline">{isStrictExam ? pick('Thi thật · DEV', 'Real Exam · DEV') : pick('Bộ đề · DEV', 'Study Pack · DEV')}</span>
          </button>
        ) : (
          <span className={`hidden sm:inline text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap ${
            isStrictExam
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
          }`}>
            {isStrictExam ? pick('Thi thật', 'Real Exam') : pick('Bộ đề', 'Study Pack')}
          </span>
        )}
        {onExit && (
          <button
            onClick={async () => {
              const message = isStrictExam
                ? pick('Các câu đã làm được lưu lại, bạn có thể tiếp tục từ câu hiện tại trong trang Tiến độ.', 'Your completed answers are saved. You can resume from Progress anytime.')
                : pick('Bạn có chắc chắn muốn tạm dừng phiên thi và quay lại Trang chủ?', 'Pause this session and return to Home?');
              const ok = await confirmDialog({
                title: pick('Tạm dừng bài thi?', 'Pause exam?'),
                message,
                confirmLabel: pick('Tạm dừng', 'Pause'),
                cancelLabel: pick('Tiếp tục làm', 'Keep going'),
                tone: 'warning',
              });
              if (ok) onExit();
            }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
            title={pick('Quay lại Trang chủ', 'Return to Home')}
          >
            {pick('Thoát', 'Exit')}
          </button>
        )}
      </div>
    </div>
  );

  // If in practice mode and coaching screen is active
  if (isAnswerCoachingOpen && currentQuestion && (latestAnswer || coachingSkipped)) {
    return (
      <div className="w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-5 lg:py-6 lg:h-full lg:min-h-0 lg:overflow-hidden flex flex-col gap-3 sm:gap-4">
        <div className="shrink-0">{topProgressHeader}</div>
        <AnswerCoaching
          answerId={latestAnswer?.id || null}
          answer={latestAnswer}
          question={currentQuestion}
          devMock={devMockLastAnswer || Boolean(sessionInfo?.dev_mock)}
          assessmentLevel={sessionInfo?.self_assessment_level || 4}
          nextLabel={currentQuestion.order_index >= 15 ? 'Hoàn tất' : 'Câu tiếp'}
          onTranscriptEdited={(newText) =>
            setLatestAnswer((prev) => (prev ? { ...prev, transcript_edited: newText } : prev))
          }
          onNextQuestion={() => {
            if (currentQuestion.order_index >= 15) {
              sessionApi.finishSession(sessionId).then(onTestComplete);
            } else {
              handleJumpToQuestion(currentQuestion.order_index + 1);
            }
          }}
          onRetryQuestion={() => {
            setIsAnswerCoachingOpen(false);
            setCoachingSkipped(false);
            setReplayUsed(false);
            setAutoStartRecord(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-5 lg:py-6 h-full overflow-hidden flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[840px] lg:my-auto flex flex-col justify-between gap-2.5 sm:gap-3.5 lg:gap-4">
      
      {/* Top Progress & Mode Header */}
      {topProgressHeader}

      {/* Banner when re-recording a previously answered question */}
      {!isStrictExam && latestAnswer && (
        <div className="rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-200 min-w-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate sm:whitespace-normal">
              Đang <strong>ghi âm lại</strong> Câu {qIndex}.
              <span className="hidden sm:inline"> Bản ghi trước vẫn được giữ cho đến khi bạn lưu mới.</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAnswerCoachingOpen(true)}
            className="px-2.5 sm:px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Kết quả cũ →
          </button>
        </div>
      )}

      {/* Main Workspace: Flex column on mobile, Balanced 6/6 Full-Height Grid on Desktop */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2.5 lg:gap-5 items-stretch">
        
        {/* Left / Top: Compact Horizontal Eva Bar + Spacious Inline Question & Translation Area */}
        <div className="flex-1 min-h-0 lg:col-span-6 flex flex-col">
          <div className="w-full h-full glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-3 sm:p-4 lg:p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2.5 lg:gap-3.5 shadow-sm overflow-hidden">
            
            {/* Top: Compact Horizontal Eva Bar (Saves ~170px vertical height for the Question & Translation box!) */}
            <div className="w-full shrink-0">
              <EvaAvatar
                key={currentQuestion?.id}
                layout="horizontal"
                replayWindowSec={isStrictExam ? 5 : null}
                audioUrl={currentQuestion?.audio_path}
                text={currentQuestion?.question_text}
                autoPlay={true}
                allowReplay={!replayUsed}
                maxReplays={1}
                onAudioEnded={() => {}}
                onSecondReadEnded={() => setAutoStartRecord(true)}
              />
            </div>

            {/* Middle: Spacious Inline Question + Translation Area */}
            <div className="w-full pt-2.5 border-t border-slate-100 dark:border-slate-800/90 flex-1 min-h-0 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                  <BookOpen className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                  <span className="truncate">{pick('Nội dung câu hỏi', 'Question Prompt')}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isVi && !isStrictExam && showQuestionText && (
                    <button
                      type="button"
                      onClick={() => setShowQuestionVi((v) => !v)}
                      className={`h-7 inline-flex items-center justify-center px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                        showQuestionVi
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      <span className="inline-grid items-center justify-items-center">
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showQuestionVi ? 'visible' : 'invisible pointer-events-none'}`}>
                          <Languages className="w-3.5 h-3.5 shrink-0" />
                          <span>Dịch</span>
                        </span>
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showQuestionVi ? 'visible' : 'invisible pointer-events-none'}`}>
                          <Languages className="w-3.5 h-3.5 shrink-0" />
                          <span>Ẩn dịch</span>
                        </span>
                      </span>
                    </button>
                  )}
                  {isVi && !isStrictExam && currentQuestion?.vietnamese_guide && (
                    <button
                      type="button"
                      onClick={() => setShowGuide(true)}
                      className="lg:hidden h-7 inline-flex items-center gap-1 px-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>Gợi ý</span>
                    </button>
                  )}
                  {!isStrictExam ? (
                    <button
                      type="button"
                      onClick={() => setShowQuestionText((v) => !v)}
                      className="h-7 inline-flex items-center justify-center px-2 rounded-lg text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      <span className="inline-grid items-center justify-items-center">
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showQuestionText ? 'visible' : 'invisible pointer-events-none'}`}>
                          <EyeOff className="w-3.5 h-3.5 shrink-0" />
                          <span>{pick('Ẩn đề', 'Hide')}</span>
                        </span>
                        <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showQuestionText ? 'visible' : 'invisible pointer-events-none'}`}>
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>{pick('Hiện đề', 'Show')}</span>
                        </span>
                      </span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap">
                      {pick('Ẩn khi thi thật', 'Hidden in Exam')}
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full flex-1 min-h-0 p-3.5 sm:p-4 lg:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 overflow-y-auto flex flex-col">
                {!isStrictExam && showQuestionText ? (
                  <div className="w-full my-auto">
                    <TranslatableText
                      text={currentQuestion?.question_text}
                      preTranslatedVi={currentQuestion?.question_translation_vi}
                      className="text-sm sm:text-[15px] lg:text-base text-slate-900 dark:text-slate-100 leading-relaxed font-semibold text-left"
                      showControls={false}
                      externalShowTranslation={isVi && showQuestionVi}
                    />
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-center py-4 select-none">
                    <EyeOff className="w-5 h-5 opacity-70" />
                    <span className="text-xs sm:text-sm italic max-w-sm">
                      {isStrictExam
                        ? pick('Quy chế thi OPIc: Câu hỏi được ẩn, hãy lắng nghe giám khảo Eva.', 'OPIc Exam Mode: Question text is hidden — listen carefully to Eva.')
                        : pick('Đề bài đang ẩn để luyện nghe. Bấm "Hiện đề" để xem câu hỏi.', 'Question is hidden for listening practice. Click "Show" to view it.')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop (lg+): Practice Blueprint Guide Button (Shown in VI mode) */}
            <div className="hidden lg:block w-full shrink-0">
              {isVi && !isStrictExam && currentQuestion?.vietnamese_guide ? (
                <button
                  onClick={() => setShowGuide(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Khung gợi ý</span>
                </button>
              ) : (
                <div className="h-9" />
              )}
            </div>

          </div>
        </div>

        {/* Right / Bottom: Compact Fixed-Height Audio Recording (Balanced 6 cols on Desktop) */}
        <div className="shrink-0 lg:col-span-6 flex flex-col relative">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            isPracticeMode={!isStrictExam}
            key={currentQuestion?.id}
            autoStart={autoStartRecord}
            targetDurationMin={currentQuestion?.timing?.target_min_sec || 45}
            targetDurationMax={currentQuestion?.timing?.time_limit_sec || 90}
          />

          {submittingAnswer && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-sky-400 animate-in fade-in">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">Đang nhận dạng giọng nói & lưu câu trả lời...</span>
            </div>
          )}

          {uploadError && !submittingAnswer && (
            <div className="mt-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-rose-600 dark:text-rose-300 font-medium">{uploadError}</p>
              {pendingUpload && (
                <button
                  type="button"
                  onClick={() => handleRecordingComplete(pendingUpload)}
                  className="shrink-0 px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  Gửi lại bản ghi ({pendingUpload.durationSeconds}s)
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Bottom-right: Next (skip without recording) + Local DEV Quick Finish */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
        {import.meta.env.DEV && (
          <button
            type="button"
            disabled={submittingAnswer || devFastFinishing}
            onClick={handleDevFastFinish}
            title="Chỉ hiện ở local (npm run dev). Điền giả lập 15 câu và mở ngay trang Báo cáo tổng kết."
            className="mr-auto px-3 py-2 rounded-xl border border-dashed border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {devFastFinishing ? 'Đang chạy...' : 'DEV · Thi xong'}
          </button>
        )}
        <ViTooltip vi={pick('Sang câu tiếp theo mà không cần ghi âm câu này.', 'Move to the next question without recording.')}>
          <button
            onClick={handleSkipQuestion}
            disabled={submittingAnswer}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold btn-brand-gradient cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
          >
            <span>{qIndex >= 15 ? pick('Hoàn tất', 'Finish') : pick('Câu tiếp', 'Next')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </ViTooltip>
      </div>
      </div>

      {/* Blueprint Guide Modal (Does not push layout or cause scroll) */}
      {showGuide && currentQuestion?.vietnamese_guide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-emerald-500/30 shadow-2xl flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Chiến thuật trả lời đề xuất</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Khung cấu trúc: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{currentQuestion.vietnamese_guide.target_pattern}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {currentQuestion.vietnamese_guide.steps?.map((step) => (
                <div key={step.step_number} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">
                      {step.step_number}
                    </span>
                    <span>{step.title}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 pl-7">
                    <span className="font-semibold text-brand-600 dark:text-brand-400 mr-1">🇻🇳 Gợi ý:</span>
                    {step.hint_vi}
                  </p>
                  {step.example_phrases && step.example_phrases.length > 0 && (
                    <div className="pl-7 mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="text-slate-500 font-medium">Mẫu câu: </span>
                      {step.example_phrases.map((phrase, i) => (
                        <span key={i} className="text-slate-900 dark:text-slate-200 italic mr-1.5">"{phrase}"</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
