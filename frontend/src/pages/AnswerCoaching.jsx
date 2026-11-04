import React, { useState, useEffect } from 'react';
import { answerApi, questionApi, resolveMediaUrl } from '../api/client';
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
  HelpCircle,
  Wrench,
} from 'lucide-react';
import { DiffViewer } from '../components/DiffViewer';
import { ShadowingPlayer } from '../components/ShadowingPlayer';
import { SpeakButton } from '../components/SpeakButton';
import { scrollPageToTop } from '../components/ScrollToTopButton';
import { SpeechFlowPanel } from '../components/coaching/SpeechFlowPanel';
import { TenseTimeline } from '../components/coaching/TenseTimeline';
import { VocabUpgrades } from '../components/coaching/VocabUpgrades';
import { stopSpeaking } from '../utils/speakPhrase';

// Deduplicates grammar feedback items against Vietlish warnings so the learner never sees the same mistake twice
const buildUnifiedCorrections = (vietlishWarnings = [], feedbackItems = []) => {
  const list = [];
  const seenOriginals = new Set();

  for (const w of vietlishWarnings) {
    if (!w?.original_phrase || !w?.suggested_phrase) continue;
    const norm = w.original_phrase.trim().toLowerCase();
    seenOriginals.add(norm);
    list.push({
      type: 'vietlish',
      badge: w.issue_vi || 'Lỗi tư duy Việt – Anh',
      original: w.original_phrase,
      correction: w.suggested_phrase,
      explanation: w.explanation_vi,
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
      badge: 'Ngữ pháp & Diễn đạt',
      original: f.mistake,
      correction: f.correction,
      explanation: f.explanation_vi || f.explanation_en,
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
    <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{label}</span>
        <span className="font-bold text-slate-900 dark:text-white shrink-0">{val}/5</span>
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
  nextLabel = 'Sang câu tiếp theo',
  answer = null,
  onTranscriptEdited = null,
}) => {
  const isUnscored = question?.question_type === 'self_intro';
  const noAnswer = !answerId;
  const hideScoring = isUnscored || noAnswer;

  // 3 focused learning stages: 'evaluation' (Chẩn đoán & Sửa lỗi) | 'rewrite' (Nâng cấp & Từ vựng) | 'models' (Bài mẫu & Dàn ý)
  const [activeTab, setActiveTab] = useState(hideScoring ? 'models' : 'evaluation');

  const levelToCode = { 1: 'Novice', 2: 'Novice', 3: 'IL', 4: 'IM', 5: 'IH', 6: 'AL' };
  const chosenLevelCode = levelToCode[assessmentLevel] || 'IM';
  const defaultModelLevel = ['IL', 'IM', 'IH'].includes(chosenLevelCode)
    ? chosenLevelCode
    : assessmentLevel <= 2
    ? 'IL'
    : 'IH';

  // Transcript state
  const [activeTranscript, setActiveTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [wordTokens, setWordTokens] = useState([]);

  // Evaluation state
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(true);

  // Rewrite state (cached per version so switching tabs never re-triggers API or reloads)
  const [rewriteData, setRewriteData] = useState(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState('');

  // Model answers state
  const [modelAnswers, setModelAnswers] = useState([]);
  const [selectedModelLevel, setSelectedModelLevel] = useState(defaultModelLevel);
  const [loadingModels, setLoadingModels] = useState(false);

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
    setActiveTab(hideScoring ? 'models' : 'evaluation');
    loadAnswerData();
    return () => stopSpeaking();
  }, [answerId, question?.id]);

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

  // Only highlight genuinely unclear words (< 0.65 confidence) so normal speech isn't flooded with orange boxes
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
      const res = await answerApi.evaluate(answerId);
      setEvaluation(res.data);
    } catch (err) {
      console.error('Evaluation error:', err);
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
      setRewriteData(null); // Reset cached rewrite since transcript changed
      if (onTranscriptEdited) {
        onTranscriptEdited(editedText);
      }

      if (hideScoring) return;

      setEvaluating(true);
      const evalRes = await answerApi.evaluate(answerId, res.data.id);
      setEvaluation(evalRes.data);
    } catch (err) {
      console.error('Failed to save edited transcript', err);
    } finally {
      setEvaluating(false);
    }
  };

  const fetchRewriteIfNeeded = async (force = false) => {
    if (hideScoring || !activeTranscript.trim()) return;
    if (rewriteData && !force) return;
    if (rewriting) return;

    setRewriting(true);
    setRewriteError('');
    try {
      const versionId = evaluation?.answer_version_id || null;
      const progression = { below_IL: 'IL', Novice: 'IL', IL: 'IM', IM: 'IH', IH: 'IH', AL: 'IH' };
      const currentEst = evaluation?.estimated_level || 'IL';
      const targetUpgrade =
        currentEst === chosenLevelCode
          ? progression[chosenLevelCode] || 'IH'
          : ['IL', 'IM', 'IH'].includes(chosenLevelCode)
          ? chosenLevelCode
          : 'IH';

      const res = await answerApi.rewrite(answerId, {
        answer_version_id: versionId,
        target_level: targetUpgrade,
      });
      setRewriteData(res.data);
    } catch (err) {
      console.error('Rewrite error:', err);
      setRewriteError('Không thể tạo bản nâng cấp lúc này. Vui lòng bấm thử lại.');
    } finally {
      setRewriting(false);
    }
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

  const handleConfirmRegenerateModels = () => {
    if (loadingModels) return;
    const confirmed = window.confirm(
      'Bạn có muốn tạo lại bộ bài mẫu mới không?\n\n• Bấm Hủy (Không): Giữ lại bài mẫu đầu tiên do AI tạo để học cố định theo một dàn ý.\n• Bấm OK (Có): AI sẽ sinh bộ bài mẫu mới thay thế bài mẫu hiện tại.'
    );
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
    ? buildUnifiedCorrections(evaluation.vietlish_warnings, evaluation.feedback_items)
    : [];

  return (
    <div className="w-full max-w-5xl mx-auto px-3.5 sm:px-4 py-4 sm:py-6 flex flex-col gap-4 sm:gap-5">
      {/* Top Header: Question Card & Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-brand-500/25 dark:border-brand-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-sm">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-500 text-white">
              Câu hỏi {question?.order_index || 1} / 15
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">
              {question?.topic}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/20">
              Mục tiêu: Level {assessmentLevel} ({chosenLevelCode})
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
            "{question?.question_text}"
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {question?.question_text && (
            <SpeakButton
              variant="question"
              text={question.question_text}
              audioUrl={question.audio_path}
              id={`coach-question-${question.id || question.order_index}`}
              label="Nghe lại câu hỏi"
              playingLabel="Đang đọc câu hỏi"
            />
          )}

          <button
            type="button"
            onClick={onRetryQuestion}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{noAnswer ? 'Trả lời câu này' : 'Ghi âm lại'}</span>
          </button>

          <button
            type="button"
            onClick={onNextQuestion}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all cursor-pointer"
          >
            <span>{nextLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact Candidate Speech Card (Audio + Transcript) */}
      {!noAnswer && (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                🎙️ Bài nói của bạn
              </span>
              {evaluation?.speech_metrics?.wpm != null && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {evaluation.speech_metrics.wpm} từ/phút
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
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Sửa chữ nhận diện nhầm</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTranscript(false)}
                  className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs cursor-pointer font-medium"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleSaveTranscriptEdit}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Lưu & Chấm lại</span>
                </button>
              </div>
            )}
          </div>

          {/* Audio Player right above transcript for instant listening */}
          {myTakes.length > 0 && (
            <div className="flex items-center gap-2.5">
              <audio
                src={resolveMediaUrl(myTakes[0].audio_path)}
                controls
                preload="none"
                className="w-full h-8"
              />
            </div>
          )}

          {isEditingTranscript ? (
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-brand-500/40 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
            />
          ) : (
            <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
              {showWordConfidence ? (
                <>
                  <p className="leading-relaxed">
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
                                ? `Độ tin cậy nhận dạng ${Math.round(t.confidence * 100)}% - có thể phát âm chưa rõ`
                                : undefined
                            }
                          >
                            {t.word}
                          </span>{' '}
                        </React.Fragment>
                      );
                    })}
                  </p>
                  {wordTokens.some((t) => t.confidence < LOW_CONF_THRESHOLD) && (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                      💡 Từ gạch chân vàng: máy nhận diện dưới 65%, bạn nên chú ý phát âm rõ âm cuối hơn.
                    </p>
                  )}
                </>
              ) : activeTranscript ? (
                <p className="leading-relaxed">{activeTranscript}</p>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 italic text-xs">
                  Không nhận dạng được lời nói trong bản ghi. Hãy bấm "Sửa chữ nhận diện nhầm" để nhập nội dung hoặc bấm "Ghi âm lại".
                </span>
              )}
            </div>
          )}

          {myTakes.length > 1 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                Nghe các lần ghi trước ({myTakes.length - 1})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {myTakes.slice(1).map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-col gap-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        Lần {v.version_number}
                      </span>
                      <audio
                        src={resolveMediaUrl(v.audio_path)}
                        controls
                        preload="none"
                        className="w-full h-7"
                      />
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {v.transcript || '(không nhận dạng được lời nói)'}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {noAnswer && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Bạn chưa ghi âm câu này.</strong> Hãy tham khảo khung dàn ý và bài mẫu bên dưới, sau đó bấm "Trả lời câu này" để luyện nói.
          </span>
        </div>
      )}

      {isUnscored && !noAnswer && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-xs text-sky-800 dark:text-sky-300">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Câu 1 (Giới thiệu bản thân) chỉ để khởi động và không tính điểm</strong> giống kỳ thi OPIc thật. Bạn có thể xem dàn ý & bài mẫu bên dưới rồi sang câu tiếp theo.
          </span>
        </div>
      )}

      {/* 3-Step Learning Tabs */}
      {!hideScoring && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('evaluation')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'evaluation'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span className="truncate">
              1. Chẩn đoán{' '}
              {evaluation?.estimated_level
                ? `(${evaluation.estimated_level === 'below_IL' ? 'Dưới IL' : evaluation.estimated_level})`
                : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSelectRewriteTab}
            disabled={!activeTranscript.trim()}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 ${
              activeTab === 'rewrite'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="truncate">2. Nâng cấp bài nói</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'models'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">3. Bài mẫu & Dàn ý</span>
          </button>
        </div>
      )}

      {/* ==================== TAB 1: CHẨN ĐOÁN & SỬA LỖI ==================== */}
      {activeTab === 'evaluation' && !hideScoring && (
        <div className="flex flex-col gap-4">
          {evaluating ? (
            <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 shadow-sm">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                Giám khảo AI Eva đang chấm điểm 6 tiêu chí ACTFL và phân tích lỗi trong bài nói của bạn...
              </p>
            </div>
          ) : evaluation ? (
            <>
              {/* 1. Unified Compact Scorecard + 3 Immediate Action Steps */}
              <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center shrink-0 ${
                        evaluation.estimated_level === 'below_IL'
                          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                          : evaluation.estimated_level === 'IH'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30'
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
                        Mức đạt
                      </span>
                      <span
                        className={`${
                          evaluation.estimated_level === 'below_IL' ? 'text-xs' : 'text-xl'
                        } font-black leading-tight text-center ${
                          evaluation.estimated_level === 'IH'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : evaluation.estimated_level === 'below_IL'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-sky-600 dark:text-sky-400'
                        }`}
                      >
                        {evaluation.estimated_level === 'below_IL' ? 'Dưới IL' : evaluation.estimated_level}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Đánh giá chuẩn ACTFL
                        </h3>
                        {evaluation.estimated_level === 'below_IL' && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                            ⚠ Chưa đạt mức IL (Novice)
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            evaluation.story_narrative_present
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                          }`}
                        >
                          {evaluation.story_narrative_present
                            ? '✓ Mạch văn đoạn (Paragraph)'
                            : '⚠ Câu còn rời rạc'}
                        </span>
                      </div>
                      {evaluation.feedback_summary && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {evaluation.feedback_summary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 6 Criteria Mini-Bars */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <CriteriaBar label="Độ trôi chảy & Độ dài" score={evaluation.score_fluency} />
                  <CriteriaBar label="Kiểm soát Thì" score={evaluation.score_tenses} />
                  <CriteriaBar label="Bố cục đoạn văn" score={evaluation.score_organization} />
                  <CriteriaBar label="Từ vựng chủ đề" score={evaluation.score_vocabulary} />
                  <CriteriaBar label="Ngữ pháp" score={evaluation.score_grammar} />
                  <CriteriaBar label="Hoàn thành yêu cầu" score={evaluation.score_task_completion} />
                </div>

                {/* 3 Concrete Action Steps embedded right inside the scorecard */}
                {evaluation.actionable_steps?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>3 việc cần làm ngay để đạt Mức {chosenLevelCode}:</span>
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {evaluation.actionable_steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200"
                        >
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Unified Mistakes & Vietlish Fixes (with Audio Pronunciation) */}
              {unifiedCorrections.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-rose-500" />
                      <span>Sửa lỗi từ bài nói của bạn ({unifiedCorrections.length})</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Bấm 🔊 để nghe cách nói đúng & đọc nhại theo
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {unifiedCorrections.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-1.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
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
                            label="Nghe câu đúng"
                            playingLabel="Đang phát"
                            title="Nghe cách nói đúng"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                          <span className="line-through text-rose-600 dark:text-rose-400">
                            {item.original}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                            {item.correction}
                          </span>
                        </div>

                        {item.explanation && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            🇻🇳 {item.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Tense Control (Compact) & Speech Flow */}
              <TenseTimeline
                timeline={evaluation.tense_timeline}
                distribution={evaluation.tense_distribution}
                narrativeExpected={evaluation.narrative_expected}
                explanation={evaluation.tense_control_details?.explanation}
              />

              <SpeechFlowPanel metrics={evaluation.speech_metrics} />

              {/* CTA to Step 2: Upgrade Your Answer */}
              {activeTranscript.trim() && (
                <button
                  type="button"
                  onClick={handleSelectRewriteTab}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-brand-500/15 to-sky-500/15 hover:from-amber-500/25 hover:to-sky-500/25 border border-brand-500/30 flex items-center justify-between gap-3 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2.5 rounded-xl bg-brand-500 text-white shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Bước 2: Xem bài nói của bạn được nâng cấp lên Mức {chosenLevelCode}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Giữ nguyên ý của bạn + học từ vựng nâng band & nghe Eva đọc mẫu từng câu
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ==================== TAB 2: NÂNG CẤP BÀI NÓI & TỪ VỰNG ==================== */}
      {activeTab === 'rewrite' && !hideScoring && (
        <div className="flex flex-col gap-4">
          {/* Power Vocabulary Upgrades from the learner's own answer */}
          {evaluation?.vocab_upgrades?.length > 0 && (
            <VocabUpgrades upgrades={evaluation.vocab_upgrades} questionId={question?.id} />
          )}

          {/* Upgraded Personal Script */}
          {rewriting ? (
            <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 shadow-sm">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                AI đang nâng cấp bài nói của bạn lên chuẩn Mức {chosenLevelCode} (giữ nguyên câu chuyện và ý tưởng của bạn)...
              </p>
            </div>
          ) : rewriteError ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-center flex flex-col items-center gap-3">
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{rewriteError}</p>
              <button
                type="button"
                onClick={() => fetchRewriteIfNeeded(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold cursor-pointer"
              >
                Thử tạo lại bản nâng cấp
              </button>
            </div>
          ) : rewriteData ? (
            <DiffViewer
              rewriteData={rewriteData}
              onPracticeAgain={onRetryQuestion}
            />
          ) : null}
        </div>
      )}

      {/* ==================== TAB 3: BÀI MẪU & DÀN Ý ==================== */}
      {activeTab === 'models' && (
        <div className="flex flex-col gap-5">
          {/* 1. Step-by-Step Outline Guide */}
          {question?.vietnamese_guide && (
            <div className="glass-card bg-white dark:bg-slate-900/80 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col gap-3.5 shadow-sm">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Khung dàn ý trả lời từng bước (Step-by-Step Outline)</span>
                </h3>
                {question.vietnamese_guide.overview && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {question.vietnamese_guide.overview}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {question.vietnamese_guide.steps?.map((step) => (
                  <div
                    key={step.step_number}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400">
                      <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20">
                        Bước {step.step_number}
                      </span>
                      <span>{step.title}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      🇻🇳 {step.hint_vi}
                    </p>
                    {step.example_phrases?.length > 0 && (
                      <div className="mt-auto pt-1.5 flex flex-wrap gap-1.5">
                        {step.example_phrases.map((phrase, i) => (
                          <SpeakButton
                            key={i}
                            variant="chip"
                            text={phrase}
                            id={`outline-phrase-${step.step_number}-${i}`}
                            label={`"${phrase}"`}
                            title="Bấm để nghe phát âm"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Standard Model Answers (IL, IM, IH) with Sentence Shadowing */}
          <div className="flex flex-col gap-3">
            {/* Persistent First-Model Notice & Optional Regenerate Prompt */}
            {!loadingModels && modelAnswers.length > 0 && (
              <div className="rounded-xl px-3.5 py-2.5 bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  📌 <strong>Đang giữ bài mẫu đầu tiên do AI tạo</strong> để bạn học cố định theo một dàn ý và nhớ ý lâu hơn.
                </p>
                <button
                  type="button"
                  onClick={handleConfirmRegenerateModels}
                  disabled={loadingModels}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-500/15 text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tạo lại bài mẫu mới?</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Bài mẫu chuẩn theo từng cấp độ:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {['IL', 'IM', 'IH'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedModelLevel(lvl)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedModelLevel === lvl
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <span>Mức {lvl}</span>
                    {lvl === defaultModelLevel && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          selectedModelLevel === lvl
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        Mục tiêu
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loadingModels ? (
              <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 shadow-sm">
                <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Đang tạo 3 bài mẫu chuẩn IL, IM, IH và giọng đọc của giám khảo Eva...
                </p>
              </div>
            ) : selectedModel ? (
              <ShadowingPlayer modelAnswer={selectedModel} />
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có bài mẫu cho câu hỏi này.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
