import React, { useState, useEffect } from 'react';
import { sessionApi, questionApi, answerApi } from '../api/client';
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  RotateCcw, 
  CheckCircle, 
  Sparkles, 
  Award,
  ChevronRight,
  ShieldAlert,
  BookOpen
} from 'lucide-react';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { ViTooltip } from '../components/Tooltip';
import { AnswerCoaching } from './AnswerCoaching';

export const TestSession = ({
  sessionId,
  sessionMode = 'exam', // 'exam' or 'practice'
  onTestComplete,
  onExit
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [showQuestionText, setShowQuestionText] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [latestAnswer, setLatestAnswer] = useState(null);
  const [isAnswerCoachingOpen, setIsAnswerCoachingOpen] = useState(false);
  const [replayUsed, setReplayUsed] = useState(false);

  // Fetch next question
  const fetchNext = async () => {
    setLoadingQuestion(true);
    setShowQuestionText(false);
    setShowGuide(false);
    setLatestAnswer(null);
    setIsAnswerCoachingOpen(false);
    setReplayUsed(false);

    try {
      const res = await sessionApi.getNextQuestion(sessionId);
      setCurrentQuestion(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
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

  const handleRecordingComplete = async ({ audioBlob, durationSeconds, transcript }) => {
    if (!currentQuestion) return;
    setSubmittingAnswer(true);

    try {
      const formData = new FormData();
      formData.append('question_id', currentQuestion.id);
      formData.append('session_id', sessionId);
      formData.append('duration_seconds', durationSeconds);
      formData.append('transcript_raw', transcript);
      if (audioBlob) {
        formData.append('audio_file', audioBlob, `q${currentQuestion.order_index}.webm`);
      }

      const res = await answerApi.submit(formData);
      setLatestAnswer(res.data);

      if (sessionMode === 'practice') {
        // In practice mode, open coaching review immediately
        setIsAnswerCoachingOpen(true);
      } else {
        // In exam mode, proceed directly to next question or complete
        if (currentQuestion.order_index >= 15) {
          await sessionApi.finishSession(sessionId);
          onTestComplete();
        } else {
          fetchNext();
        }
      }
    } catch (err) {
      console.error("Failed to submit answer:", err);
    } finally {
      setSubmittingAnswer(false);
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

  // If in practice mode and coaching screen is active
  if (isAnswerCoachingOpen && latestAnswer && currentQuestion) {
    return (
      <AnswerCoaching
        answerId={latestAnswer.id}
        question={currentQuestion}
        onNextQuestion={() => {
          if (currentQuestion.order_index >= 15) {
            sessionApi.finishSession(sessionId).then(onTestComplete);
          } else {
            fetchNext();
          }
        }}
        onRetryQuestion={() => {
          setIsAnswerCoachingOpen(false);
          setLatestAnswer(null);
        }}
      />
    );
  }

  const qIndex = currentQuestion?.order_index || 1;
  const isStrictExam = sessionMode === 'exam';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      
      {/* Top Progress & Mode Header */}
      <div className="glass-panel bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center font-bold text-sm text-brand-600 dark:text-brand-400">
            {qIndex}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Question {qIndex} of 15</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                {currentQuestion?.topic}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">Type: {currentQuestion?.question_type?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="hidden sm:flex items-center gap-1.5">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i + 1 < qIndex
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : i + 1 === qIndex
                  ? 'bg-brand-500 ring-2 ring-brand-500/30 scale-125'
                  : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Mode Tag */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border capitalize ${
            isStrictExam
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
          }`}>
            {sessionMode} Mode
          </span>
        </div>
      </div>

      {/* Main Grid: Eva Avatar + Interaction */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Eva Animated Examiner */}
        <div className="lg:col-span-4 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col items-center shadow-sm">
          <EvaAvatar
            audioUrl={currentQuestion?.audio_path}
            autoPlay={true}
            allowReplay={!replayUsed}
            maxReplays={1}
            onAudioEnded={() => {}}
          />

          {/* Question Text Toggle (Disabled in Strict Exam Mode) */}
          <div className="w-full mt-6 flex flex-col gap-2">
            {!isStrictExam ? (
              <button
                onClick={() => setShowQuestionText(!showQuestionText)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-sm"
              >
                {showQuestionText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showQuestionText ? 'Hide Question Text' : 'Show Question Text'}</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Question text hidden in Exam Mode</span>
              </div>
            )}

            {/* Revealed Text */}
            {showQuestionText && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium animate-in fade-in">
                "{currentQuestion?.question_text}"
              </div>
            )}

            {/* Practice Step-by-Step Guide Toggle */}
            {!isStrictExam && currentQuestion?.vietnamese_guide && (
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{showGuide ? 'Hide Vietnamese Guide' : 'View IH Answer Blueprint'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Audio Recording & Vietnamese Outline Guide */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Vietnamese Blueprint Guide (Expandable in practice mode) */}
          {showGuide && currentQuestion?.vietnamese_guide && (
            <div className="glass-card bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl p-5 border border-emerald-500/30 flex flex-col gap-3 animate-in fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Chiến thuật trả lời đạt Intermediate High (IH):
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Khung cấu trúc: {currentQuestion.vietnamese_guide.target_pattern}
                </span>
              </div>

              <div className="space-y-2">
                {currentQuestion.vietnamese_guide.steps?.map((step) => (
                  <div key={step.step_number} className="text-xs flex items-start gap-2">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">B{step.step_number}:</span>
                    <div>
                      <strong className="text-slate-900 dark:text-slate-200">{step.title}</strong>
                      <span className="text-slate-600 dark:text-slate-400 ml-1.5">({step.hint_vi})</span>
                      {step.example_phrases && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 italic mt-0.5">
                          Mẫu câu: "{step.example_phrases[0]}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audio Recorder */}
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            isPracticeMode={!isStrictExam}
            targetDurationMin={60}
            targetDurationMax={120}
          />

          {submittingAnswer && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex items-center justify-center gap-2 text-xs text-sky-600 dark:text-sky-400 animate-pulse shadow-sm">
              <div className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span>Saving candidate audio & generating AI analysis...</span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
