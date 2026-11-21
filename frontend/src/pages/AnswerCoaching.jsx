import React, { useState, useEffect } from 'react';
import { answerApi, questionApi, resolveMediaUrl } from '../api/client';
import {
  Sparkles,
  Edit3,
  Check,
  ArrowRight,
  RotateCcw,
  Award,
  BookOpen,
  Wrench,
  Languages,
  Mic,
} from 'lucide-react';
import { DiffViewer } from '../components/DiffViewer';
import { ShadowingPlayer } from '../components/ShadowingPlayer';
import { SpeakButton } from '../components/SpeakButton';
import { TranslatableText } from '../components/TranslatableText';
import { RegenerateModal } from '../components/RegenerateModal';
import { scrollPageToTop } from '../components/ScrollToTopButton';
import { SpeechFlowPanel } from '../components/coaching/SpeechFlowPanel';
import { TenseTimeline } from '../components/coaching/TenseTimeline';
import { VocabUpgrades } from '../components/coaching/VocabUpgrades';
import { stopSpeaking } from '../utils/speakPhrase';
import { confirmDialog, notify } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

// Deduplicates grammar feedback items against Vietlish warnings so the learner never sees the same mistake twice
const buildUnifiedCorrections = (vietlishWarnings = [], feedbackItems = [], isVi = true) => {
  const list = [];
  const seenOriginals = new Set();

  for (const w of vietlishWarnings) {
    if (!w?.original_phrase || !w?.suggested_phrase) continue;
    const norm = w.original_phrase.trim().toLowerCase();
    seenOriginals.add(norm);
    list.push({
      type: 'vietlish',
      badge: isVi
        ? (w.issue_vi || w.issue_en || 'Lỗi tư duy Việt – Anh')
        : (w.issue_en || w.issue_vi || 'L1 Interference'),
      original: w.original_phrase,
      correction: w.suggested_phrase,
      explanation: isVi ? (w.explanation_vi || w.explanation_en) : (w.explanation_en || w.explanation_vi),
    });
  }

  for (const f of feedbackItems) {
    if (!f?.mistake || !f?.correction) continue;
    const norm = f.mistake.trim().toLowerCase();
    const isDuplicate = [...seenOriginals].some(
      (seen) => seen.includes(norm) || norm.includes(seen)
    );
    if (isDuplicate) continue;
    seenOriginals.add(norm);
    list.push({
      type: 'grammar',
      badge: isVi ? 'Ngữ pháp & Diễn đạt' : 'Grammar & Expression',
      original: f.mistake,
      correction: f.correction,
      explanation: isVi ? (f.explanation_vi || f.explanation_en) : (f.explanation_en || f.explanation_vi),
    });
  }

  return list;
};

const CriteriaBar = ({ label, score }) => {
  const val = Math.max(1, Math.min(5, Number(score) || 1));
  const pct = (val / 5) * 100;
  const barColor =
    val >= 4
      ? 'bg-emerald-500'
      : val === 3
        ? 'bg-sky-500'
        : 'bg-amber-500';
  return (
    <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{label}</span>
        <span className="font-extrabold text-slate-900 dark:text-white shrink-0">{val}/5</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const AnswerCoaching = ({
  answerId,
  question,
  onNextQuestion,
  onRetryQuestion,
  assessmentLevel = 4,
  nextLabel = null,
  answer = null,
  onTranscriptEdited = null,
  studyStatus = null,
  onUpdateStudyStatus = null,
  onReviewRating = null,
  devMock = false,
}) => {
  const { lang, isVi, pick } = useLanguage();
  const resolvedNextLabel = nextLabel || pick('Câu tiếp', 'Next');
  const useDevMock = Boolean(import.meta.env.DEV && devMock);
  const isUnscored = question?.question_type === 'self_intro';
  const noAnswer = !answerId;
  const hideScoring = isUnscored || noAnswer;

  const [activeTab, setActiveTab] = useState(hideScoring ? 'models' : 'evaluation');
  const [showPromptVi, setShowPromptVi] = useState(false);

  const levelToCode = { 1: 'Novice', 2: 'Novice', 3: 'IL', 4: 'IM', 5: 'IH', 6: 'AL' };
  const chosenLevelCode = levelToCode[assessmentLevel] || 'IM';
  const defaultModelLevel = ['IL', 'IM', 'IH'].includes(chosenLevelCode)
    ? chosenLevelCode
    : assessmentLevel <= 2
      ? 'IL'
      : 'IH';

  const [activeTranscript, setActiveTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [wordTokens, setWordTokens] = useState([]);

  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(true);

  const [rewriteData, setRewriteData] = useState(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [ratedLabel, setRatedLabel] = useState('');

  const [modelAnswers, setModelAnswers] = useState([]);
  const [selectedModelLevel, setSelectedModelLevel] = useState(defaultModelLevel);
  const [loadingModels, setLoadingModels] = useState(false);

  const latestVersionId = (() => {
    const vers = answer?.versions || [];
    return vers.length > 0 ? vers[vers.length - 1]?.id || 0 : 0;
  })();
  const answerRevisionKey = `${answerId || 0}:${latestVersionId}:${answer?.created_at || ''}:${answer?.audio_path || ''}:${answer?.transcript_raw || ''}`;

  useEffect(() => {
    scrollPageToTop('instant');
    stopSpeaking();
    setActiveTranscript(answer?.transcript_edited || answer?.transcript_raw || '');
    setWordTokens(answer?.word_confidences || []);
    setEvaluation(null);
    setRewriteData(null);
    setRewriteError('');
    setModelAnswers([]);
    setIsEditingTranscript(false);
    setShowPromptVi(false);
    setActiveTab(hideScoring ? 'models' : 'evaluation');
    loadAnswerData();
    return () => stopSpeaking();
  }, [answerRevisionKey, question?.id, lang]);

  useEffect(() => {
    setSelectedModelLevel(defaultModelLevel);
  }, [assessmentLevel]);

  const myTakes = (() => {
    const takes = [...(answer?.versions || [])].filter((v) => v.audio_path).reverse();
    if (!takes.length && answer?.audio_path) {
      return [
        {
          id: 'answer',
          version_number: 1,
          audio_path: answer.audio_path,
          transcript: answer.transcript_raw,
          created_at: answer.created_at,
        },
      ];
    }
    return takes;
  })();

  const LOW_CONF_THRESHOLD = 0.65;
  const showWordConfidence =
    wordTokens.length > 0 && activeTranscript === (answer?.transcript_raw || '');

  const loadAnswerData = async () => {
    if (hideScoring) {
      setEvaluating(false);
      return;
    }
    setEvaluating(true);
    try {
      const res = await answerApi.evaluate(answerId, null, useDevMock, lang);
      setEvaluation(res.data);
    } catch (err) {
      console.error('Evaluation error:', err);
      notify.error(pick('Không thể chấm điểm bài nói lúc này.', 'Could not grade this recording right now.'));
    } finally {
      setEvaluating(false);
    }
  };

  const handleSaveTranscriptEdit = async () => {
    if (!editedText.trim()) return;
    try {
      const res = await answerApi.editTranscript(answerId, {
        transcript_edited: editedText,
        notes: 'Candidate edited transcript',
      });
      setActiveTranscript(editedText);
      setIsEditingTranscript(false);
      setRewriteData(null);
      if (onTranscriptEdited) {
        onTranscriptEdited(editedText);
      }

      if (hideScoring) return;

      setEvaluating(true);
      const evalRes = await answerApi.evaluate(answerId, res.data.id, useDevMock, lang);
      setEvaluation(evalRes.data);
      notify.success(pick('Đã cập nhật nội dung và chấm điểm lại.', 'Transcript updated and re-evaluated.'));
    } catch (err) {
      console.error('Failed to save edited transcript', err);
      notify.error(pick('Không lưu được chỉnh sửa nội dung.', 'Failed to save transcript edits.'));
    } finally {
      setEvaluating(false);
    }
  };

  const fetchRewriteIfNeeded = async (force = false, regenerate = false, customInstruction = '') => {
    if (hideScoring || !activeTranscript.trim()) return;
    if (rewriteData && !force) return;
    if (rewriting) return;

    setRewriting(true);
    setRewriteError('');
    try {
      const versionId = evaluation?.answer_version_id || null;
      const targetUpgrade = ['IL', 'IM', 'IH'].includes(chosenLevelCode)
        ? chosenLevelCode
        : chosenLevelCode === 'AL'
          ? 'IH'
          : 'IM';

      const res = await answerApi.rewrite(answerId, {
        answer_version_id: versionId,
        target_level: targetUpgrade,
        regenerate,
        ...(useDevMock ? { dev_mock: true } : {}),
        ...(customInstruction ? { custom_instruction: customInstruction } : {}),
      });
      setRewriteData(res.data);
      setShowRegenModal(false);
    } catch (err) {
      console.error('Rewrite error:', err);
      setRewriteError('Không thể tạo bản nâng cấp lúc này. Vui lòng bấm thử lại.');
    } finally {
      setRewriting(false);
    }
  };

  const handleRegenerateRewrite = () => {
    if (rewriting) return;
    setShowRegenModal(true);
  };

  const handleSelectRewriteTab = () => {
    setActiveTab('rewrite');
    fetchRewriteIfNeeded(false);
  };

  const loadModelAnswers = async (regenerate = false) => {
    if (!question?.id || loadingModels) return;
    setLoadingModels(true);
    try {
      const res = await questionApi.getModelAnswers(question.id, null, regenerate);
      setModelAnswers(res.data);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleConfirmRegenerateModels = async () => {
    if (loadingModels) return;
    const confirmed = await confirmDialog({
      title: 'Tạo lại bộ bài mẫu mới?',
      message: 'Hệ thống đang giữ bài mẫu gốc để bạn học cố định theo một dàn ý.\nBấm "Tạo lại" để AI sinh bộ bài mẫu IL / IM / IH mới thay thế.',
      confirmLabel: 'Tạo lại',
      cancelLabel: 'Giữ bài cũ',
      tone: 'warning',
    });
    if (!confirmed) return;
    loadModelAnswers(true);
  };

  useEffect(() => {
    if (activeTab === 'models' && modelAnswers.length === 0 && question?.id) {
      loadModelAnswers();
    }
  }, [activeTab, question?.id]);

  const selectedModel =
    modelAnswers.find((m) => m.level === selectedModelLevel) || modelAnswers[0];

  const unifiedCorrections = evaluation
    ? buildUnifiedCorrections(evaluation.vietlish_warnings, evaluation.feedback_items, isVi)
    : [];

  // Shared 2-Column Outline + Model Answers Workspace (Zero outer scroll on Desktop!)
  const renderOutlineAndModels = () => {
    const hasGuide = Boolean(question?.vietnamese_guide?.steps?.length);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch lg:flex-1 lg:min-h-0">
        {/* Left Column (5 cols): Compact Step-by-Step Outline */}
        {hasGuide && (
          <div className="lg:col-span-5 glass-panel rounded-2xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 shrink-0" />
            <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Dàn ý từng bước</span>
              </h3>
              {question.vietnamese_guide.overview && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {question.vietnamese_guide.overview}
                </p>
              )}
            </div>

            <div className="p-3.5 flex flex-col gap-2.5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
              {question.vietnamese_guide.steps.map((step) => (
                <div
                  key={step.step_number}
                  className="p-3 rounded-xl bg-slate-50/90 dark:bg-[#0b1120]/70 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 dark:text-sky-300">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-200 dark:border-sky-500/30 text-[10px]">
                      Bước {step.step_number}
                    </span>
                    <span className="truncate">{step.title}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                    {step.hint_vi}
                  </p>
                  {step.example_phrases?.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {step.example_phrases.map((phrase, i) => (
                        <SpeakButton
                          key={i}
                          variant="chip"
                          text={phrase}
                          id={`outline-phrase-${step.step_number}-${i}`}
                          label={`"${phrase}"`}
                          title="Bấm để nghe phát âm"
                          className="!text-[11px] !py-0.5 !px-2 text-left"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right Column (7 cols, or full 12 cols if no guide): Level Bar + Shadowing Player */}
        <div className={`${hasGuide ? 'lg:col-span-7' : 'lg:col-span-12'} flex flex-col gap-2.5 lg:h-full lg:min-h-0`}>
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700/60">
              {['IL', 'IM', 'IH'].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedModelLevel(lvl)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    selectedModelLevel === lvl
                      ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Mức {lvl}</span>
                  {lvl === defaultModelLevel && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        selectedModelLevel === lvl
                          ? 'bg-white/25 text-white'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      Mục tiêu
                    </span>
                  )}
                </button>
              ))}
            </div>

            {!loadingModels && modelAnswers.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmRegenerateModels}
                title="Đang giữ bài mẫu gốc để học cố định · Bấm nếu muốn AI viết bài mẫu mới"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/15 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Tạo lại bài mẫu</span>
              </button>
            )}
          </div>

          {loadingModels ? (
            <div className="glass-panel rounded-2xl p-10 text-center flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Đang tải 3 bài mẫu chuẩn IL, IM, IH và giọng đọc của giám khảo Eva...
              </p>
            </div>
          ) : selectedModel ? (
            <ShadowingPlayer modelAnswer={selectedModel} />
          ) : (
            <div className="glass-panel rounded-2xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có bài mẫu cho câu hỏi này.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1380px] mx-auto flex flex-col gap-4 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
      {/* Compact Pinned Question & Action Strip */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 text-white">
              Câu {question?.order_index || 1}/15
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">
              {question?.topic}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-sky-500/15 text-indigo-700 dark:text-sky-300 border border-indigo-200/80 dark:border-sky-500/30">
              Level {assessmentLevel} · {chosenLevelCode}
            </span>
            {noAnswer && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-500/30">
                Chưa ghi âm
              </span>
            )}
            {isUnscored && !noAnswer && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-300/70 dark:border-teal-500/30">
                Khởi động · Không tính điểm
              </span>
            )}
          </div>

          <TranslatableText
            text={question?.question_text}
            preTranslatedVi={question?.question_translation_vi}
            showControls={false}
            externalShowTranslation={showPromptVi}
            className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {isVi && (
            <button
              type="button"
              onClick={() => setShowPromptVi((v) => !v)}
              className={`h-8 inline-flex items-center justify-center px-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
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

          {question?.question_text && (
            <SpeakButton
              variant="question"
              text={question.question_text}
              audioUrl={question.audio_path}
              id={`coach-question-${question.id || question.order_index}`}
              label={pick('Nghe', 'Play')}
              playingLabel={pick('Đang đọc', 'Playing')}
            />
          )}

          <button
            type="button"
            onClick={onRetryQuestion}
            className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            {noAnswer ? <Mic className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <RotateCcw className="w-3.5 h-3.5 shrink-0" />}
            <span>{noAnswer ? pick('Trả lời', 'Record') : pick('Nói lại', 'Retry')}</span>
          </button>

          <button
            type="button"
            onClick={onNextQuestion}
            className="h-8 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl btn-brand-gradient text-xs font-extrabold cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span>{resolvedNextLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* 3-Tab Switcher when Scored Answer exists */}
      {!hideScoring && (
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-200/75 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('evaluation')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'evaluation'
                ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {pick('Chẩn đoán', 'Diagnosis')}
              {evaluation?.estimated_level ? ` · ${evaluation.estimated_level === 'below_IL' ? pick('Dưới IL', 'Below IL') : evaluation.estimated_level}` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSelectRewriteTab}
            disabled={!activeTranscript.trim()}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:opacity-40 ${
              activeTab === 'rewrite'
                ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{pick('Nâng cấp & Từ vựng', 'Rewrite & Vocab')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'models'
                ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{pick('Dàn ý & Bài mẫu', 'Guide & Models')}</span>
          </button>
        </div>
      )}

      {/* ==================== TAB 1: CHẨN ĐOÁN & SỬA LỖI ==================== */}
      {activeTab === 'evaluation' && !hideScoring && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch lg:flex-1 lg:min-h-0">
          {/* Left 5 Cols: Candidate Speech + Scorecard */}
          <div className="lg:col-span-5 flex flex-col gap-4 pt-0.5 pb-1 lg:h-full lg:overflow-y-auto lg:pr-1.5">
            {/* Candidate Speech Card */}
            <div className="glass-card rounded-2xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {pick('Bài nói của bạn', 'Your Response')}
                  </span>
                  {evaluation?.speech_metrics?.wpm != null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-sky-300">
                      {evaluation.speech_metrics.wpm} {pick('từ/phút', 'WPM')}
                    </span>
                  )}
                </div>

                {!isEditingTranscript ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditedText(activeTranscript || '');
                      setIsEditingTranscript(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{pick('Sửa', 'Edit')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsEditingTranscript(false)}
                      className="px-2 py-1 rounded-lg text-slate-500 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                    >
                      {pick('Huỷ', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTranscriptEdit}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-3 h-3" />
                      <span>{pick('Lưu', 'Save')}</span>
                    </button>
                  </div>
                )}
              </div>

              {myTakes.length > 0 && (
                <audio
                  key={`${latestVersionId || 'take'}-${myTakes[0].audio_path}`}
                  src={resolveMediaUrl(myTakes[0].audio_path)}
                  controls
                  preload="none"
                  className="w-full h-8"
                />
              )}

              {isEditingTranscript ? (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={3}
                  className="w-full theme-input rounded-xl p-2.5 text-xs leading-relaxed"
                />
              ) : (
                <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-[#0b1120]/70 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 max-h-36 overflow-y-auto">
                  {showWordConfidence ? (
                    <>
                      <p>
                        {wordTokens.map((t, idx) => {
                          const isLow = t.confidence < LOW_CONF_THRESHOLD;
                          return (
                            <React.Fragment key={idx}>
                              <span
                                className={
                                  isLow
                                    ? 'underline decoration-amber-500 decoration-wavy text-amber-900 dark:text-amber-300'
                                    : ''
                                }
                                title={
                                  isLow
                                    ? pick(`Độ tin cậy nhận dạng ${Math.round(t.confidence * 100)}%`, `Recognition confidence ${Math.round(t.confidence * 100)}%`)
                                    : undefined
                                }
                              >
                                {t.word}
                              </span>{' '}
                            </React.Fragment>
                          );
                        })}
                      </p>
                    </>
                  ) : activeTranscript ? (
                    <p>{activeTranscript}</p>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400 italic">
                      {pick('Không nhận dạng được lời nói. Hãy bấm "Sửa" hoặc "Nói lại".', 'No speech detected. Click "Edit" or "Retry".')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 6-Criteria Compact Scorecard */}
            {!evaluating && evaluation && (
              <div className="glass-card rounded-2xl p-4 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white block">
                      {pick('Đánh giá chuẩn ACTFL', 'ACTFL Rubric Score')}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {pick(`Mục tiêu ${chosenLevelCode}`, `Target ${chosenLevelCode}`)}
                    </span>
                  </div>
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 shrink-0 ${
                      evaluation.estimated_level === 'below_IL'
                        ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-300'
                        : evaluation.estimated_level === 'IH'
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                          : 'bg-sky-50 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/35 text-sky-700 dark:text-sky-300'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase opacity-75">{pick('Đạt mức', 'Band')}</span>
                    <span className="text-base font-black leading-none">
                      {evaluation.estimated_level === 'below_IL' ? pick('Dưới IL', 'Below IL') : evaluation.estimated_level}
                    </span>
                  </div>
                </div>

                {evaluation.feedback_summary && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/90 dark:bg-[#0b1120]/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    {evaluation.feedback_summary}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <CriteriaBar label={pick('Trôi chảy & Độ dài', 'Fluency & Length')} score={evaluation.score_fluency} />
                  <CriteriaBar label={pick('Kiểm soát thì', 'Tense Control')} score={evaluation.score_tenses} />
                  <CriteriaBar label={pick('Bố cục đoạn', 'Organization')} score={evaluation.score_organization} />
                  <CriteriaBar label={pick('Từ vựng', 'Vocabulary')} score={evaluation.score_vocabulary} />
                  <CriteriaBar label={pick('Ngữ pháp', 'Grammar')} score={evaluation.score_grammar} />
                  <CriteriaBar label={pick('Đáp ứng đề', 'Task Completion')} score={evaluation.score_task_completion} />
                </div>

                {(onReviewRating || onUpdateStudyStatus) && evaluation?.estimated_level && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-50/75 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {ratedLabel ? pick(`Đã hẹn ôn (${ratedLabel})`, `Scheduled (${ratedLabel})`) : pick('Lên lịch ôn lại:', 'Schedule review:')}
                    </span>
                    {onReviewRating ? (
                      <div className="flex items-center gap-1">
                        {[
                          { key: 'hard', label: pick('Quên · 1d', 'Hard · 1d'), cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40' },
                          { key: 'good', label: pick('Nhớ · 3d', 'Good · 3d'), cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40' },
                          { key: 'easy', label: pick('Thuộc · 7d', 'Easy · 7d'), cls: 'bg-emerald-600 text-white border-emerald-600' },
                        ].map((btn) => (
                          <button
                            key={btn.key}
                            type="button"
                            onClick={async () => {
                              await onReviewRating(btn.key);
                              setRatedLabel(btn.label);
                            }}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold cursor-pointer ${btn.cls}`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateStudyStatus(studyStatus === 'mastered' ? 'learning' : 'mastered')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {studyStatus === 'mastered' ? pick('Đã thuộc', 'Mastered') : pick('Đánh dấu thuộc', 'Mark mastered')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 7 Cols: Mistakes, Tense & Flow */}
          <div className="lg:col-span-7 flex flex-col gap-4 pt-0.5 pb-1 lg:h-full lg:overflow-y-auto lg:pr-1.5">
            {evaluating ? (
              <div className="glass-panel rounded-2xl p-10 text-center flex-1 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  {pick('Giám khảo AI Eva đang chấm điểm 6 tiêu chí ACTFL và phân tích lỗi...', 'Eva AI is grading your answer across all 6 ACTFL criteria...')}
                </p>
              </div>
            ) : evaluation ? (
              <>
                {unifiedCorrections.length > 0 && (
                  <div className="glass-card rounded-2xl p-4 flex flex-col gap-2.5">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-rose-500" />
                      <span>{pick(`Sửa lỗi từ bài nói của bạn · ${unifiedCorrections.length} mục`, `Corrections from Your Response · ${unifiedCorrections.length}`)}</span>
                    </h3>
                    <div className="flex flex-col gap-2">
                      {unifiedCorrections.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50/90 dark:bg-[#0b1120]/70 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                item.type === 'vietlish'
                                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                                  : 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30'
                              }`}
                            >
                              {item.badge}
                            </span>
                            <SpeakButton
                              text={item.correction}
                              id={`correction-${idx}`}
                              label={pick('Nghe', 'Play')}
                              playingLabel={pick('Dừng', 'Stop')}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="line-through text-rose-600 dark:text-rose-400">{item.original}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">{item.correction}</span>
                          </div>
                          {item.explanation && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                              {item.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <TenseTimeline
                  timeline={evaluation.tense_timeline}
                  distribution={evaluation.tense_distribution}
                  narrativeExpected={evaluation.narrative_expected}
                  explanation={evaluation.tense_control_details?.explanation}
                />

                <SpeechFlowPanel metrics={evaluation.speech_metrics} />
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: NÂNG CẤP BÀI NÓI & TỪ VỰNG ==================== */}
      {activeTab === 'rewrite' && !hideScoring && (
        <div className="flex flex-col gap-3.5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {evaluation?.vocab_upgrades?.length > 0 && (
            <VocabUpgrades upgrades={evaluation.vocab_upgrades} questionId={question?.id} />
          )}

          {rewriting ? (
            <div className="glass-panel rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                AI đang nâng cấp bài nói của bạn lên chuẩn Mức {chosenLevelCode}...
              </p>
            </div>
          ) : rewriteError ? (
            <div className="glass-card rounded-2xl p-6 text-center flex flex-col items-center gap-3">
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{rewriteError}</p>
              <button
                type="button"
                onClick={() => fetchRewriteIfNeeded(true)}
                className="px-4 py-2 rounded-xl btn-brand-gradient text-xs font-bold cursor-pointer"
              >
                Thử tạo lại bản nâng cấp
              </button>
            </div>
          ) : rewriteData ? (
            <DiffViewer
              rewriteData={rewriteData}
              onPracticeAgain={onRetryQuestion}
              onRegenerate={handleRegenerateRewrite}
              regenerating={rewriting}
            />
          ) : null}

          <RegenerateModal
            isOpen={showRegenModal}
            onClose={() => setShowRegenModal(false)}
            onConfirm={(instruction) => fetchRewriteIfNeeded(true, true, instruction)}
            loading={rewriting}
            title="Tạo lại bản nâng cấp mới"
            levelLabel={chosenLevelCode}
          />
        </div>
      )}

      {/* ==================== TAB 3 (OR DEFAULT WHEN UNSCORED): DÀN Ý & BÀI MẪU ==================== */}
      {activeTab === 'models' && renderOutlineAndModels()}
    </div>
  );
};
