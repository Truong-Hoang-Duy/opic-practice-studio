import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Library, ChevronDown, ChevronLeft, ChevronRight, Mic, Sparkles, Headphones, Download, Repeat,
  ListMusic, Loader2, ArrowLeft, CheckSquare, Square, X, Trash2, RotateCcw, CheckCircle, FileText, Eye, EyeOff, BookOpen
} from 'lucide-react';
import { libraryApi, sessionApi, questionApi, answerApi, resolveMediaUrl, formatApiError, recordingFileName } from '../api/client';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { AnswerCoaching } from './AnswerCoaching';
import { SpeakButton } from '../components/SpeakButton';

const LEVELS = ['IL', 'IM', 'IH'];
const POLL_MS = 3000;

// Generate model answers for several questions, a few at a time
const generateModelAnswers = async (questionIds, onDone, regenerate = false) => {
  const queue = [...questionIds];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        await questionApi.getModelAnswers(id, null, regenerate);
      } catch (err) {
        console.error('Model answer generation failed', err);
      }
      onDone(id);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
};

// ---------- View exam results or practice again (reuses the coaching screen + 15-question switcher) ----------
const LibraryPractice = ({ question: initialQuestion, session, startInRecordMode = false, onBack }) => {
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
  const answer = answersByQId[currentQ.id] || null;
  const [isRecording, setIsRecording] = useState(startInRecordMode || !initialQuestion.existing_answer);
  const [submitting, setSubmitting] = useState(false);
  const [autoStartRecord, setAutoStartRecord] = useState(false);
  const [showQuestionText, setShowQuestionText] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const qIndex = currentQ?.order_index || 1;
  const allQuestions = session?.questions || [];

  const handleJumpToOrder = (targetOrder) => {
    const targetQ = allQuestions.find((q) => q.order_index === targetOrder);
    if (!targetQ || targetQ.id === currentQ.id) return;
    const targetAns = answersByQId[targetQ.id] || targetQ.existing_answer || null;
    setCurrentQ(targetQ);
    setAutoStartRecord(false);
    setShowGuide(false);
    setIsRecording(!targetAns);
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
            <span className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">Question {qIndex} of 15</span>
            <span className="truncate text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              {currentQ?.category_label || currentQ?.topic}
            </span>
            {answer && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" />
                Đã làm
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Bộ đề #{session.set_number ?? session.session_number ?? session.session_id}{session.dev_mock ? ' · DEV' : ''}
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
              title="Lùi về câu trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-[11px]">Câu trước</span>
            </button>
            <div className="w-[1px] h-3.5 bg-slate-300 dark:bg-slate-700" />
            <button
              type="button"
              onClick={() => handleJumpToOrder(qIndex + 1)}
              disabled={qIndex >= 15}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
                qIndex < 15
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-xs'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
              title="Tiến tới câu sau"
            >
              <span className="text-[11px]">Câu sau</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {allQuestions.map((qItem) => {
              const dotIdx = qItem.order_index;
              const isDone = !!(answersByQId[qItem.id] || qItem.existing_answer);
              return (
                <button
                  key={qItem.id}
                  type="button"
                  onClick={() => handleJumpToOrder(dotIdx)}
                  title={`Câu ${dotIdx}${isDone ? ' (Đã làm — bấm để xem)' : ''}`}
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
          nextLabel={qIndex >= 15 ? 'Quay lại bộ đề' : 'Sang câu tiếp theo'}
          onNextQuestion={() => {
            if (qIndex >= 15) {
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
            Bạn đang ở chế độ <strong>Luyện nói lại</strong> cho Câu {currentQ.order_index}. Kết quả thi và bài mẫu đầu tiên của bạn vẫn được giữ nguyên.
          </span>
          <button
            type="button"
            onClick={() => setIsRecording(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Xem lại kết quả đã thi →</span>
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
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed text-center">"{currentQ.question_text}"</p>
              ) : (
                <span className="text-xs italic text-slate-400 dark:text-slate-500">Nội dung câu hỏi đang ẩn. Bấm "Hiện câu hỏi" để đọc văn bản.</span>
              )}
            </div>
          </div>
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
              <span>Đang nhận dạng giọng nói...</span>
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

// ---------- Main page ----------
export const QuestionLibrary = () => {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [selected, setSelected] = useState([]); // ordered question ids
  const [levelOverride, setLevelOverride] = useState('auto');
  const [includeQuestion, setIncludeQuestion] = useState(true);
  const [loop, setLoop] = useState(true);
  const [generating, setGenerating] = useState({}); // question id -> true while model answers are generated
  const [player, setPlayer] = useState(null); // { status: 'preparing'|'building'|'ready'|'error', done, total, url, message }
  const [practice, setPractice] = useState(null); // { question, session }
  const [view, setView] = useState('sets'); // 'sets' | 'topics'
  const [activeCategory, setActiveCategory] = useState(null);
  const audioRef = useRef(null);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const res = await libraryApi.get();
      setSets(res.data);
      setExpanded(prev => (Object.keys(prev).length || !res.data.length ? prev : { [res.data[0].session_id]: true }));
    } catch (err) {
      console.error('Failed to load question library', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => clearTimeout(pollRef.current);
  }, []);

  const questionIndex = useMemo(() => {
    const map = {};
    sets.forEach(s => s.questions.forEach(q => { map[q.id] = { q, s }; }));
    return map;
  }, [sets]);

  const levelFor = (s) => (levelOverride === 'auto' ? s.default_model_level : levelOverride);
  const modelFor = (q, s) => q.model_answers.find(m => m.level === levelFor(s));

  // Q1 (fixed self-introduction) is not part of listening practice
  const isListenable = (q) => q.question_type !== 'self_intro';

  const toggleSelect = (id) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const toggleSelectMany = (ids) => {
    const allIn = ids.length > 0 && ids.every(id => selected.includes(id));
    setSelected(prev => (allIn ? prev.filter(id => !ids.includes(id)) : [...prev, ...ids.filter(id => !prev.includes(id))]));
  };

  // Topic view: every question across all sets, grouped by normalised category
  const categories = useMemo(() => {
    const map = {};
    sets.forEach(set => set.questions.forEach(q => {
      if (!map[q.category]) map[q.category] = { key: q.category, label: q.category_label, items: [] };
      map[q.category].items.push({ q, s: set });
    }));
    const order = ['home', 'leisure', 'unexpected', 'role_play', 'environment', 'human_rights', 'global_workplace', 'socio_cultural', 'communication_media', 'self_intro'];
    return Object.values(map).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [sets]);

  useEffect(() => {
    if (view === 'topics' && !activeCategory && categories.length) setActiveCategory(categories[0].key);
  }, [view, categories, activeCategory]);

  const markGenerating = (ids, value) => setGenerating(prev => {
    const next = { ...prev };
    ids.forEach(id => { if (value) next[id] = true; else delete next[id]; });
    return next;
  });

  const handleGenerate = async (ids, regenerate = false) => {
    if (!ids.length) return;
    markGenerating(ids, true);
    await generateModelAnswers(ids, (id) => markGenerating([id], false), regenerate);
    await load();
  };

  const handleRegenerateModel = async (q) => {
    if (generating[q.id]) return;
    const confirmed = window.confirm(
      'Câu hỏi này đã có bài mẫu đầu tiên do AI tạo.\n\nBạn có muốn tạo lại bài mẫu mới không?\n• Bấm Hủy (Không): Giữ lại bài mẫu cũ để học cố định theo một dàn ý.\n• Bấm OK (Có): AI sẽ viết lại một bộ bài mẫu mới.'
    );
    if (!confirmed) return;
    await handleGenerate([q.id], true);
  };

  const handleDeleteSet = async (s) => {
    const label = s.set_number ?? s.session_number ?? s.session_id;
    if (!window.confirm(`Xóa Bộ đề #${label}? Toàn bộ câu hỏi và câu trả lời của bộ đề này sẽ bị xóa.`)) return;
    try {
      await sessionApi.delete(s.session_id);
      setSelected(prev => prev.filter(id => !s.questions.some(q => q.id === id)));
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Không xóa được bộ đề.'));
    }
  };

  const handleDeleteAllSets = async () => {
    if (!sets.length) return;
    if (!window.confirm('Xóa toàn bộ tất cả bộ đề đã thi và reset số thứ tự về #1? (Tài khoản đăng nhập và sổ từ vựng vẫn được giữ nguyên)')) return;
    try {
      await sessionApi.deleteAll();
      setSelected([]);
      setPlayer(null);
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Không xóa được toàn bộ bộ đề.'));
    }
  };

  // Build (or fetch) the single MP3 for the selection, polling until it's ready
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

  const handleBuildPlaylist = async (ids = selected) => {
    if (!ids.length) return;
    clearTimeout(pollRef.current);
    setPlayer({ status: 'preparing', done: 0, total: ids.length });

    // Model answers must exist before the audio can be built
    const missing = ids.filter(id => {
      const entry = questionIndex[id];
      return entry && !modelFor(entry.q, entry.s);
    });
    if (missing.length) {
      markGenerating(missing, true);
      await generateModelAnswers(missing, (id) => markGenerating([id], false));
      await load();
    }

    const body = { question_ids: ids, include_question: includeQuestion };
    if (levelOverride !== 'auto') body.level = levelOverride;
    pollPlaylist(body);
  };

  // Lock-screen / notification controls while listening
  useEffect(() => {
    if (player?.status !== 'ready' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: `OPIc Practice · ${selected.length} câu`,
        artist: 'Eva · OPIc Practice Studio',
        album: 'Question Bank',
      });
    } catch (e) { /* MediaMetadata unsupported */ }
  }, [player?.status, player?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop, player?.url]);

  // One question card, shared by the "by set" and "by topic" views
  const renderQuestion = (q, s, showSet = false) => {
    const model = modelFor(q, s);
    const isSelected = selected.includes(q.id);
    const listenable = isListenable(q);
    const hasExamData = !!q.existing_answer;
    return (
      <div key={q.id} className={`p-4 flex gap-3 ${isSelected ? 'bg-brand-50/60 dark:bg-brand-500/5' : ''}`}>
        {listenable ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(q.id)}
            aria-label={`Chọn câu ${q.order_index}`}
            className="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer"
          />
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-brand-600 dark:text-brand-400">Q{q.order_index}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{q.category_label || q.topic}</span>
            {showSet && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Bộ đề #{s.set_number ?? s.session_number ?? s.session_id} · {new Date(s.started_at).toLocaleDateString()}</span>
            )}
            {q.practice_count > 0 && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Đã luyện {q.practice_count} lần{q.last_level ? ` · gần nhất ${q.last_level === 'below_IL' ? 'Dưới IL' : q.last_level}` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPractice({ question: q, session: s, startInRecordMode: false })}
            className="text-left text-sm text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 leading-relaxed transition-colors cursor-pointer"
            title={hasExamData ? 'Bấm để xem lại toàn bộ kết quả & phân tích bài thi của câu này' : 'Bấm để luyện tập câu hỏi này'}
          >
            {q.question_text}
          </button>

          {model ? (
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Bài mẫu {model.level} (mẫu cố định)
              </summary>
              <div className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Bài mẫu chuẩn {model.level} (giữ cố định từ lần đầu AI tạo)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <SpeakButton
                      text={model.text}
                      audioUrl={model.audio_path}
                      id={`lib-model-${q.id}-${model.level}`}
                      label="Nghe bài mẫu"
                      playingLabel="Đang đọc bài mẫu"
                    />
                    <button
                      type="button"
                      onClick={() => handleRegenerateModel(q)}
                      disabled={!!generating[q.id]}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-500/15 text-slate-600 dark:text-slate-300 hover:text-amber-700 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Tạo lại bộ bài mẫu mới nếu bạn muốn đổi dàn ý khác"
                    >
                      {generating[q.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      <span>{generating[q.id] ? 'Đang tạo lại...' : 'Tạo lại mẫu?'}</span>
                    </button>
                  </div>
                </div>
                <p>{model.text}</p>
              </div>
            </details>
          ) : (
            <button
              onClick={() => handleGenerate([q.id], false)}
              disabled={!!generating[q.id]}
              className="self-start flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer disabled:opacity-60"
            >
              {generating[q.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{generating[q.id] ? 'Đang tạo bài mẫu...' : 'Tạo bài mẫu'}</span>
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

          <div className="flex flex-wrap gap-2">
            {hasExamData && (
              <button
                onClick={() => setPractice({ question: q, session: s, startInRecordMode: false })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Xem bài đã thi</span>
              </button>
            )}
            <button
              onClick={() => setPractice({ question: q, session: s, startInRecordMode: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-sm cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Luyện lại</span>
            </button>
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
        onBack={() => { setPractice(null); load(); }}
      />
    );
  }

  return (
    <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 ${selected.length || player ? 'pb-56 md:pb-44' : ''}`}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Library className="w-6 h-6 text-brand-500" />
          <span>Question Bank · Bộ đề đã thi</span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          Xem lại câu hỏi AI đã ra và bài mẫu. Bấm <strong>Luyện lại</strong> để trả lời, chấm điểm và sửa lỗi nhiều lần. Chọn câu rồi bấm <strong>Nghe</strong> để nghe liên tục (kể cả khi tắt màn hình) hoặc tải file MP3.
        </p>
      </div>

      {/* Listening options */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-700 dark:text-slate-300">
        <label className="flex items-center gap-1.5">
          <span className="font-semibold">Mức bài mẫu:</span>
          <select
            value={levelOverride}
            onChange={e => setLevelOverride(e.target.value)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
          >
            <option value="auto">Theo mức đã thi</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={includeQuestion} onChange={e => setIncludeQuestion(e.target.checked)} />
          <span>Đọc cả câu hỏi trước bài mẫu</span>
        </label>
      </div>

      {/* View switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {[{ key: 'sets', label: 'Theo bộ đề' }, { key: 'topics', label: 'Theo chủ đề' }].map(tab => (
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
        const current = categories.find(c => c.key === activeCategory) || categories[0];
        const ids = current ? current.items.filter(({ q }) => isListenable(q)).map(({ q }) => q.id) : [];
        const allSelected = ids.length > 0 && ids.every(id => selected.includes(id));
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
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
            {current && (
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
            )}
          </div>
        );
      })()}

      {view !== 'sets' ? null : loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải bộ đề...
        </div>
      ) : !sets.length ? (
        <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
          Chưa có bộ đề nào. Hãy làm một bài thi để AI tạo bộ đề đầu tiên.
        </div>
      ) : sets.map(s => {
        const isOpen = !!expanded[s.session_id];
        const setIds = s.questions.filter(isListenable).map(q => q.id);
        const allSelected = setIds.length > 0 && setIds.every(id => selected.includes(id));
        const missingModels = s.questions.filter(q => !modelFor(q, s)).map(q => q.id);
        return (
          <div key={s.session_id} className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Set header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [s.session_id]: !isOpen }))}
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Bộ đề #{s.set_number ?? s.session_number ?? s.session_id} · {new Date(s.started_at).toLocaleDateString()}
                    {s.dev_mock && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded border border-dashed border-amber-400 text-amber-700 dark:text-amber-300">DEV</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Level {s.self_assessment_level || '?'} · {s.mode === 'exam' ? 'Strict exam' : 'Practice'} · {s.topics.map(t => t.replace(/_/g, ' ')).join(', ')}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {missingModels.length > 0 && (
                  <button
                    onClick={() => handleGenerate(missingModels)}
                    disabled={missingModels.some(id => generating[id])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 cursor-pointer disabled:opacity-60"
                  >
                    {missingModels.some(id => generating[id]) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
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
                <button
                  onClick={() => handleDeleteSet(s)}
                  title="Xóa bộ đề này"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Questions */}
            {isOpen && (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                {s.questions.map(q => renderQuestion(q, s))}
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
                  onClick={() => setLoop(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    loop ? 'border-brand-400 text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Lặp lại liên tục"
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
    </div>
  );
};
