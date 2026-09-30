import React, { useState, useEffect } from 'react';
import { answerApi, questionApi } from '../api/client';
import { 
  Sparkles, 
  Edit3, 
  Check, 
  Volume2, 
  ArrowRight, 
  RotateCcw, 
  Award, 
  AlertCircle, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  XCircle,
  HelpCircle
} from 'lucide-react';
import { DiffViewer } from '../components/DiffViewer';
import { ShadowingPlayer } from '../components/ShadowingPlayer';
import { ViTooltip } from '../components/Tooltip';

export const AnswerCoaching = ({
  answerId,
  question,
  onNextQuestion,
  onRetryQuestion,
  assessmentLevel = 4,
  nextLabel = 'Sang câu tiếp theo'
}) => {
  // Q1 self-introduction is a warm-up and is never scored (same as the real OPIc)
  const isUnscored = question?.question_type === 'self_intro';
  // Practice "Next" without recording: no answer, but question/guide/model answers are still shown
  const noAnswer = !answerId;
  const hideScoring = isUnscored || noAnswer;
  const [activeTab, setActiveTab] = useState(hideScoring ? 'guide' : 'evaluation'); // 'evaluation', 'guide', 'rewrite', 'models'
  
  // Level mapping based on candidate's self-assessment
  const levelToCode = { 1: 'Novice', 2: 'Novice', 3: 'IL', 4: 'IM', 5: 'IH', 6: 'AL' };
  const chosenLevelCode = levelToCode[assessmentLevel] || 'IM';
  const defaultModelLevel = ['IL', 'IM', 'IH'].includes(chosenLevelCode) ? chosenLevelCode : (assessmentLevel <= 2 ? 'IL' : 'IH');

  // State for answer versions and transcript editing
  const [activeTranscript, setActiveTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [wordTokens, setWordTokens] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);

  // Evaluation state
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(true);

  // Rewrite state
  const [rewriteData, setRewriteData] = useState(null);
  const [rewriting, setRewriting] = useState(false);
  const [acceptingRewrite, setAcceptingRewrite] = useState(false);

  // Model answers state - defaults to the candidate's chosen exam level
  const [modelAnswers, setModelAnswers] = useState([]);
  const [selectedModelLevel, setSelectedModelLevel] = useState(defaultModelLevel);
  const [loadingModels, setLoadingModels] = useState(false);

  // Scroll to top and load Answer data upon answer change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadAnswerData();
  }, [answerId]);

  useEffect(() => {
    setSelectedModelLevel(defaultModelLevel);
  }, [assessmentLevel]);

  const loadAnswerData = async () => {
    if (hideScoring) {
      setEvaluating(false);
      return;
    }
    try {
      const res = await answerApi.evaluate(answerId);
      setEvaluation(res.data);
    } catch (err) {
      console.error("Evaluation error:", err);
    } finally {
      setEvaluating(false);
    }
  };

  // Edit transcript -> creates new answer_version
  const handleSaveTranscriptEdit = async () => {
    try {
      const res = await answerApi.editTranscript(answerId, {
        transcript_edited: editedText,
        notes: "Candidate edited transcript"
      });
      setActiveTranscript(editedText);
      setIsEditingTranscript(false);

      if (hideScoring) return;

      // Re-trigger evaluation on new version
      setEvaluating(true);
      const evalRes = await answerApi.evaluate(answerId, res.data.id);
      setEvaluation(evalRes.data);
    } catch (err) {
      console.error("Failed to save edited transcript", err);
    } finally {
      setEvaluating(false);
    }
  };

  // Trigger "Improve my answer"
  const handleTriggerRewrite = async () => {
    setRewriting(true);
    try {
      const versionId = evaluation?.answer_version_id;
      const progression = { 'Novice': 'IL', 'IL': 'IM', 'IM': 'IH', 'IH': 'IH', 'AL': 'AL' };
      const targetUpgrade = evaluation?.estimated_level === chosenLevelCode 
        ? (progression[chosenLevelCode] || 'IH') 
        : (['IL', 'IM', 'IH'].includes(chosenLevelCode) ? chosenLevelCode : 'IH');

      const res = await answerApi.rewrite(answerId, {
        answer_version_id: versionId,
        target_level: targetUpgrade
      });
      setRewriteData(res.data);
      setActiveTab('rewrite');
    } catch (err) {
      console.error("Rewrite error:", err);
    } finally {
      setRewriting(false);
    }
  };

  // Accept rewrite into a new version
  const handleAcceptRewrite = async (improvedText) => {
    setAcceptingRewrite(true);
    try {
      const formData = new FormData();
      formData.append('improved_text', improvedText);
      const res = await answerApi.acceptRewrite(answerId, formData);
      setActiveTranscript(improvedText);
      setEditedText(improvedText);

      // Re-evaluate accepted version
      setEvaluating(true);
      const evalRes = await answerApi.evaluate(answerId, res.data.id);
      setEvaluation(evalRes.data);
      setActiveTab('evaluation');
    } catch (err) {
      console.error("Accept rewrite error:", err);
    } finally {
      setAcceptingRewrite(false);
    }
  };

  // Load Model Answers
  const loadModelAnswers = async () => {
    setLoadingModels(true);
    try {
      const res = await questionApi.getModelAnswers(question.id);
      setModelAnswers(res.data);
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'models' && modelAnswers.length === 0) {
      loadModelAnswers();
    }
  }, [activeTab]);

  const selectedModel = modelAnswers.find(m => m.level === selectedModelLevel) || modelAnswers[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      
      {/* Top Header: Question Card & Actions - Sticky and prominent */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 border-brand-500/20 dark:border-brand-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md sticky top-0 z-20 backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-500 text-white shadow-xs">
              Câu hỏi {question?.order_index || 1} / 15
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">
              Chủ đề: {question?.topic}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/20">
              Mức thi: Level {assessmentLevel} ({chosenLevelCode})
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
            "{question?.question_text}"
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRetryQuestion}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{noAnswer ? 'Trả lời câu này' : 'Ghi âm lại'}</span>
          </button>

          <button
            onClick={onNextQuestion}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white text-xs font-bold shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
          >
            <span>{nextLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1. Transcript View with Editable Mode */}
      {!noAnswer && (
      <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Candidate Speech Transcript
            </span>
            <ViTooltip vi="Bạn có thể chỉnh sửa lại bản ghi âm để sửa các từ nhận diện nhầm. Mỗi lần bấm lưu sẽ tạo ra một Answer Version mới.">
              <span className="text-[11px] text-brand-600 dark:text-brand-400 flex items-center gap-1 font-medium">
                <HelpCircle className="w-3 h-3" />
                <span>Editable Versioning</span>
              </span>
            </ViTooltip>
          </div>

          <div className="flex items-center gap-2">
            {!isEditingTranscript ? (
              <button
                onClick={() => {
                  setEditedText(activeTranscript || evaluation?.feedback_summary || '');
                  setIsEditingTranscript(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Fix Recognition Errors</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingTranscript(false)}
                  className="px-3 py-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTranscriptEdit}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save New Version</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditingTranscript ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={4}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-brand-500/40 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed font-sans"
          />
        ) : (
          <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-900">
            {activeTranscript || (
              <span className="text-slate-500 dark:text-slate-400 italic">
                Candidate response recorded. Low confidence words are automatically highlighted below during analysis.
              </span>
            )}
          </div>
        )}
      </div>
      )}

      {noAnswer && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
          <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Bạn đã bỏ qua câu này.</strong> Xem lại câu hỏi, khung gợi ý và bài mẫu bên dưới. Bấm "Trả lời câu này" để ghi âm, hoặc sang câu tiếp theo.
          </span>
        </div>
      )}

      {isUnscored && !noAnswer && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-xs text-sky-800 dark:text-sky-300">
          <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Question 1 is not scored.</strong> Câu 1 (giới thiệu bản thân) chỉ để khởi động, không tính điểm, giống bài thi OPIc thật. Hãy tham khảo hướng dẫn và bài mẫu rồi chuyển sang câu tiếp theo.
          </span>
        </div>
      )}

      {/* Navigation Tabs for Coaching Panels */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto [&>button]:flex-shrink-0 [&>button]:whitespace-nowrap">
        {!hideScoring && (
        <button
          onClick={() => setActiveTab('evaluation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'evaluation'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>ACTFL Diagnostic ({evaluation?.estimated_level || 'Evaluating...'})</span>
        </button>
        )}

        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'guide'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Step-by-Step Outline Guide</span>
        </button>

        {!hideScoring && (
        <button
          onClick={handleTriggerRewrite}
          disabled={rewriting}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'rewrite'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-500/10'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{rewriting ? 'Upgrading Answer...' : 'Improve My Answer (Upgrade)'}</span>
        </button>
        )}

        <button
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'models'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Model Answers & Shadowing</span>
        </button>
      </div>

      {/* TAB 1: Evaluation */}
      {activeTab === 'evaluation' && !hideScoring && (
        <div className="flex flex-col gap-6">
          {evaluating ? (
            <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 shadow-sm">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">ACTFL Examiner Eva is evaluating your grammar, tenses, and discourse structure...</p>
            </div>
          ) : evaluation ? (
            <>
              {/* Score Badges & Level Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="glass-card bg-white dark:bg-slate-900/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">Estimated Level</span>
                  <span className={`text-xl font-black ${
                    evaluation.estimated_level === 'IH' ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'
                  }`}>
                    {evaluation.estimated_level}
                  </span>
                </div>

                <div className="glass-card bg-white dark:bg-slate-900/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">Fluency & Length</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{evaluation.score_fluency} / 5</span>
                </div>

                <div className="glass-card bg-white dark:bg-slate-900/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">Tense Control</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{evaluation.score_tenses} / 5</span>
                </div>

                <div className="glass-card bg-white dark:bg-slate-900/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">Organization</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{evaluation.score_organization} / 5</span>
                </div>

                <div className="glass-card bg-white dark:bg-slate-900/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">Vocabulary</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{evaluation.score_vocabulary} / 5</span>
                </div>

                <div className="glass-card bg-white dark:bg-slate-900/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">Task Completion</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{evaluation.score_task_completion} / 5</span>
                </div>
              </div>

              {/* Tenses and Complication Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                    Tense Usage Breakdown:
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`flex items-center gap-1 font-semibold ${evaluation.tense_control_details?.past_used ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {evaluation.tense_control_details?.past_used ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      Past Tense
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${evaluation.tense_control_details?.present_used ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {evaluation.tense_control_details?.present_used ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      Present Tense
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${evaluation.tense_control_details?.future_used ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {evaluation.tense_control_details?.future_used ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      Future Tense
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed font-normal">
                    {evaluation.tense_control_details?.explanation}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Discourse & Complication Check:
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`flex items-center gap-1 font-semibold ${evaluation.complication_present ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {evaluation.complication_present ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      Complication / Problem: {evaluation.complication_present ? 'Present' : 'Missing'}
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${evaluation.story_narrative_present ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {evaluation.story_narrative_present ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      Story Narrative: {evaluation.story_narrative_present ? 'Sustained' : 'Developing'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed font-normal">
                    {evaluation.complication_present 
                      ? `Tốt lắm! Bạn đã đưa ra sự cố/tình huống phát sinh cụ thể, phù hợp với tiêu chuẩn Mức ${chosenLevelCode}.`
                      : `Gợi ý: Thêm chi tiết về tình huống bất ngờ hoặc khó khăn phát sinh cùng cách xử lý để hoàn thiện câu trả lời ở Mức ${chosenLevelCode}.`}
                  </p>
                </div>
              </div>

              {/* 3-5 Mistakes & Corrections */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Top Feedback & Grammar Corrections ({evaluation.feedback_items?.length || 0})</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 normal-case font-medium">Tailored for Vietnamese learners</span>
                </h3>

                <div className="space-y-3">
                  {evaluation.feedback_items?.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300">
                        <span className="font-bold text-rose-600 dark:text-rose-400">Original:</span>
                        <span className="line-through">{item.mistake}</span>
                      </div>
                      <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Correction:</span>
                        <span>{item.correction}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        <span className="text-brand-600 dark:text-brand-400 font-semibold mr-1">🇻🇳 Giải thích:</span>
                        {item.explanation_vi || item.explanation_en}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 Concrete Action Steps */}
              <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-slate-900/90 border border-emerald-300 dark:border-emerald-500/30 flex flex-col gap-3 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>3 Hành động cụ thể để đạt chuẩn Mức {chosenLevelCode} ({chosenLevelCode === 'IL' ? 'Intermediate Low' : chosenLevelCode === 'IM' ? 'Intermediate Mid' : chosenLevelCode === 'IH' ? 'Intermediate High' : chosenLevelCode})</span>
                </h3>

                <div className="space-y-2.5">
                  {evaluation.actionable_steps?.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {idx + 1}
                      </span>
                      <p className="leading-relaxed mt-0.5 font-medium">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* TAB 2: Step-by-Step Answer Guide */}
      {activeTab === 'guide' && question?.vietnamese_guide && (
        <div className="glass-card bg-white dark:bg-slate-900/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Step-by-Step Outline Guide for "{question.question_type.replace(/_/g, ' ')}"</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {question.vietnamese_guide.overview}
            </p>
          </div>

          <div className="space-y-3">
            {question.vietnamese_guide.steps?.map((step) => (
              <div key={step.step_number} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
                  <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20">
                    Step {step.step_number}
                  </span>
                  <span>{step.title}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-brand-600 dark:text-brand-400 mr-1">🇻🇳 Gợi ý:</span>
                  {step.hint_vi}
                </p>
                {step.example_phrases && (
                  <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="text-slate-500 font-medium">Mẫu câu khuyên dùng: </span>
                    {step.example_phrases.map((phrase, i) => (
                      <span key={i} className="text-slate-800 dark:text-slate-300 italic mr-2">"{phrase}"</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Rewrite / Improve Answer */}
      {activeTab === 'rewrite' && (
        <DiffViewer
          rewriteData={rewriteData}
          onAccept={handleAcceptRewrite}
          isAccepting={acceptingRewrite}
        />
      )}

      {/* TAB 4: Model Answers & Shadowing */}
      {activeTab === 'models' && (
        <div className="flex flex-col gap-4">
          {/* Level Switcher (IL, IM, IH) */}
          <div className="flex flex-wrap items-center gap-2">
            {['IL', 'IM', 'IH'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedModelLevel(lvl)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedModelLevel === lvl
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800'
                }`}
              >
                <span>Level {lvl} Model</span>
                {lvl === defaultModelLevel && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    selectedModelLevel === lvl
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                  }`}>
                    (Mức bạn chọn)
                  </span>
                )}
              </button>
            ))}
          </div>

          {loadingModels ? (
            <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 shadow-sm">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-600 dark:text-slate-400">Synthesizing audio and pedagogical rationale...</p>
            </div>
          ) : selectedModel ? (
            <ShadowingPlayer
              modelAnswer={selectedModel}
              onRecordSentence={() => {}}
            />
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">No model answers available.</div>
          )}
        </div>
      )}

    </div>
  );
};
