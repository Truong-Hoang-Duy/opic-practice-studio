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
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  BookOpen,
  Lock,
  X
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
  const [sessionInfo, setSessionInfo] = useState(null);

  // Trap browser Back navigation in Exam Mode
  useEffect(() => {
    if (sessionMode === 'exam') {
      window.history.pushState(null, '', window.location.href);

      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
        alert("Quy chế phòng thi OPIc: Bạn không được phép quay lại (Back) câu hỏi trước bằng phím mũi tên trình duyệt!");
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
  }, [sessionMode]);

  // Jump to specific question in Practice Mode
  const handleJumpToQuestion = async (targetIndex) => {
    if (sessionMode === 'exam') return;
    if (targetIndex < 1 || targetIndex > 15 || targetIndex === currentQuestion?.order_index) return;
    setLoadingQuestion(true);
    setShowQuestionText(false);
    setShowGuide(false);
    setLatestAnswer(null);
    setIsAnswerCoachingOpen(false);
    setReplayUsed(false);

    try {
      const res = await sessionApi.getQuestionByIndex(sessionId, targetIndex);
      setCurrentQuestion(res.data);
    } catch (err) {
      console.error("Failed to load question", err);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const getDifficultyInfo = (difficulty) => {
    const d = (difficulty || '').toUpperCase();
    if (d === 'IL' || d === 'EASY' || d === 'DỄ') {
      return {
        label: 'Dễ (IL)',
        badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
        tip: 'AI Đánh giá mức độ Dễ (IL): Câu đơn miêu tả người, thói quen hoặc nơi chốn cơ bản ở thì hiện tại.'
      };
    }
    if (d === 'IM' || d === 'MEDIUM' || d === 'TRUNG BÌNH') {
      return {
        label: 'Trung bình (IM)',
        badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
        tip: 'AI Đánh giá mức độ Trung bình (IM): Đoạn văn kết nối, kể chuyện quá khứ cơ bản và hỏi thông tin role-play.'
      };
    }
    return {
      label: 'Khó (IH Target)',
      badgeColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
      tip: 'AI Đánh giá mức độ Khó (IH Target): Kể chuyện quá khứ có cao trào (Complication), so sánh hai thế hệ và xử lý tình huống bất ngờ.'
    };
  };

  useEffect(() => {
    if (sessionId) {
      sessionApi.getStatus(sessionId)
        .then(res => setSessionInfo(res.data))
        .catch(err => console.warn("Failed to fetch session status", err));
    }
  }, [sessionId]);

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
        assessmentLevel={sessionInfo?.self_assessment_level || 4}
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
  const diffInfo = getDifficultyInfo(currentQuestion?.difficulty);

  return (
    <div className="w-full max-w-6xl px-4 sm:px-6 py-4 flex flex-col gap-4 my-auto">
      
      {/* Top Progress & Mode Header */}
      <div className="glass-panel bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
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
              <ViTooltip vi={diffInfo.tip}>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffInfo.badgeColor}`}>
                  AI: {diffInfo.label}
                </span>
              </ViTooltip>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">Type: {currentQuestion?.question_type?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {/* Center: Navigation Controls (Locked in Exam, Free in Practice) */}
        {!isStrictExam ? (
          <div className="flex items-center gap-3">
            {/* Arrow Navigation buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => handleJumpToQuestion(qIndex - 1)}
                disabled={qIndex <= 1}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
                  qIndex > 1
                    ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-xs'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title="Lùi về câu trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Câu trước</span>
              </button>

              <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700" />

              <button
                onClick={() => handleJumpToQuestion(qIndex + 1)}
                disabled={qIndex >= 15}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
                  qIndex < 15
                    ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-xs'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title="Tiến tới câu sau"
              >
                <span className="hidden md:inline text-[11px]">Câu sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clickable Progress Dots in Practice Mode */}
            <div className="hidden sm:flex items-center gap-1.5">
              {[...Array(15)].map((_, i) => {
                const dotIdx = i + 1;
                return (
                  <button
                    key={i}
                    onClick={() => handleJumpToQuestion(dotIdx)}
                    title={`Chuyển tới Câu ${dotIdx}`}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer hover:scale-135 ${
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
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20" title="Quy chế thi OPIc: Không được lùi lại câu hỏi trước">
              <Lock className="w-3 h-3" />
              <span className="hidden md:inline">Không lùi câu</span>
            </div>

            {/* Read-only Progress Dots in Exam Mode */}
            <div className="hidden sm:flex items-center gap-1.5">
              {[...Array(15)].map((_, i) => {
                const dotIdx = i + 1;
                return (
                  <div
                    key={i}
                    title={`Câu ${dotIdx} / 15`}
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
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border capitalize ${
            isStrictExam
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
          }`}>
            {sessionMode} Mode
          </span>
          {onExit && (
            <button
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn tạm dừng bài thi và quay lại Dashboard?")) {
                  onExit();
                }
              }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Quay lại Dashboard"
            >
              Thoát
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: 2 Equal-Height Columns (5 : 7 split on md+) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        
        {/* Left: Eva Animated Examiner & Fixed Question Area */}
        <div className="md:col-span-5 flex flex-col">
          <div className="w-full h-full md:h-[500px] md:min-h-[500px] md:max-h-[500px] flex-shrink-0 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
            
            {/* Top part: Eva Avatar */}
            <div className="flex flex-col items-center">
              <EvaAvatar
                audioUrl={currentQuestion?.audio_path}
                autoPlay={true}
                allowReplay={!replayUsed}
                maxReplays={1}
                onAudioEnded={() => {}}
              />
            </div>

            {/* Middle part: Dedicated Question Text Container (Strictly locked height, Centered content) */}
            <div className="w-full mt-2 flex flex-col">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-brand-500" />
                    <span>Nội dung câu hỏi</span>
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${diffInfo.badgeColor}`}>
                    {diffInfo.label}
                  </span>
                </div>
                {!isStrictExam ? (
                  <button
                    onClick={() => setShowQuestionText(!showQuestionText)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors cursor-pointer"
                  >
                    {showQuestionText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showQuestionText ? 'Ẩn câu hỏi' : 'Hiện câu hỏi'}</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Ẩn trong Exam Mode</span>
                )}
              </div>

              {/* Pre-allocated fixed height box: strictly locked at 115px with flex-shrink-0 */}
              <div className="w-full h-[115px] min-h-[115px] max-h-[115px] flex-shrink-0 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-center justify-center overflow-y-auto">
                {showQuestionText ? (
                  <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed font-medium text-center w-full my-auto">
                    "{currentQuestion?.question_text}"
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 text-center py-1 select-none">
                    <EyeOff className="w-4 h-4 opacity-70" />
                    <span className="text-xs italic">
                      {isStrictExam ? 'Quy chế thi OPIc: Câu hỏi được ẩn, hãy lắng nghe giám khảo Eva' : 'Nội dung câu hỏi đang ẩn. Bấm "Hiện câu hỏi" để đọc văn bản'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom part: Practice Blueprint Guide Button */}
            <div className="w-full mt-2">
              {!isStrictExam && currentQuestion?.vietnamese_guide ? (
                <button
                  onClick={() => setShowGuide(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Xem khung gợi ý trả lời (Blueprint Guide)</span>
                </button>
              ) : (
                <div className="h-9" />
              )}
            </div>

          </div>
        </div>

        {/* Right: Audio Recording */}
        <div className="md:col-span-7 flex flex-col relative h-full">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            isPracticeMode={!isStrictExam}
            targetDurationMin={60}
            targetDurationMax={120}
          />

          {submittingAnswer && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-sky-400 animate-in fade-in">
              <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">Đang lưu câu trả lời & AI chấm điểm chẩn đoán...</span>
            </div>
          )}
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
