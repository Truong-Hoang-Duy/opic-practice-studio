import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Zap, Flame, Loader2, Clock3, History as HistoryIcon, Lightbulb, CheckCircle2, AlertCircle, XCircle, RotateCcw, Mic, EyeOff
} from 'lucide-react';
import { dailyApi, formatApiError, recordingFileName } from '../api/client';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { useResetCountdown, formatCountdown, WeekDots } from '../components/DailyChallengeCard';

const SHOW_MOCK_OPTION = import.meta.env.DEV;

const VERDICT = {
  good: { label: 'Đạt', icon: CheckCircle2, cls: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30' },
  partial: { label: 'Cần cải thiện', icon: AlertCircle, cls: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30' },
  missing: { label: 'Chưa đạt', icon: XCircle, cls: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30' },
};

export const VerdictBadge = ({ verdict }) => {
  const v = VERDICT[verdict] || VERDICT.partial;
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${v.cls}`}>
      <Icon className="w-3.5 h-3.5" />{v.label}
    </span>
  );
};

const Pillar = ({ index, title, verdict, children, accent = '' }) => (
  <div className={`glass-card rounded-2xl p-4 border bg-white dark:bg-slate-900/85 flex flex-col gap-2.5 shadow-sm ${accent || 'border-slate-200 dark:border-slate-800'}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[11px] flex items-center justify-center">{index}</span>
        {title}
      </span>
      {verdict && <VerdictBadge verdict={verdict} />}
    </div>
    {children}
  </div>
);

export const QuickFeedback = ({ workout, onRegrade, regrading }) => {
  const fb = workout.feedback;
  if (!fb) return null;
  if (fb.grading_failed) {
    return (
      <div className="glass-card rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-amber-800 dark:text-amber-200">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span className="flex-1">
          {onRegrade
            ? 'Bài nói đã được ghi nhận nhưng AI chấm điểm đang gặp lỗi. Bấm "Chấm lại" (không cần ghi âm lại).'
            : 'Bài nói đã được ghi nhận nhưng AI chưa chấm được. Mở Daily Challenge hôm nay để chấm lại.'}
        </span>
        {onRegrade && <button onClick={onRegrade} disabled={regrading} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
          {regrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Chấm lại
        </button>}
      </div>
    );
  }
  const { tense, fluency, golden_tip: tip } = fb;
  const lengthPct = Math.min(100, (fluency.duration_sec / fluency.target_max_sec) * 100);
  const minPct = (fluency.target_min_sec / fluency.target_max_sec) * 100;

  return (
    <div className="flex flex-col gap-4">
      {fb.no_speech && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {fb.reason === 'transcription_failed'
              ? 'Không nhận dạng được giọng nói (lỗi dịch vụ nhận dạng). Bài chưa được tính vào chuỗi ngày - hãy bấm Làm lại.'
              : 'Không nghe thấy lời nói trong bản ghi. Bài chưa được tính vào chuỗi ngày - kiểm tra micro rồi bấm Làm lại.'}
          </span>
        </div>
      )}

      {(fb.task?.note_vi || fb.level_cap_note_vi) && (
        <div className="flex flex-col gap-1.5 text-xs">
          {fb.task?.note_vi && (
            <p className={`flex items-start gap-2 ${fb.task.met === false ? 'text-amber-800 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300'}`}>
              {fb.task.met === false ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
              <span><strong>Yêu cầu đề bài:</strong> {fb.task.note_vi}</span>
            </p>
          )}
          {fb.level_cap_note_vi && (
            <p className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Band được giới hạn ở {fb.estimated_level} (AI đánh giá {fb.ai_level}): {fb.level_cap_note_vi}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Pillar index={1} title="Kiểm soát thì" verdict={tense.verdict}>
          <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">Thì trọng tâm: {tense.focus_label_vi}</p>
          {tense.note_vi && <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{tense.note_vi}</p>}
          {tense.evidence?.length > 0 && (
            <ul className="flex flex-col gap-1">
              {tense.evidence.map((e, i) => (
                <li key={i} className="text-[11px] leading-snug flex gap-1.5">
                  {e.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-500" />
                    : <XCircle className="w-3.5 h-3.5 shrink-0 mt-px text-rose-500" />}
                  <span className={e.ok ? 'text-slate-600 dark:text-slate-400' : 'text-rose-700 dark:text-rose-300'}>
                    "{e.quote}"{!e.ok && e.fix && <> → <strong className="text-emerald-700 dark:text-emerald-300">{e.fix}</strong></>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {tense.example_fix && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2 leading-relaxed">
              ✓ {tense.example_fix}
            </p>
          )}
        </Pillar>

        <Pillar index={2} title="Độ dài & Mạch lạc" verdict={fluency.verdict}>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{fluency.duration_sec}s</span>
              <span className="text-slate-500 dark:text-slate-400">mục tiêu {fluency.target_min_sec}–{fluency.target_max_sec}s</span>
            </div>
            <div className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${fluency.length_status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${lengthPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-slate-500/60" style={{ left: `${minPct}%` }} title={`${fluency.target_min_sec}s`} />
            </div>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{fluency.length_note_vi}</p>
          {fluency.coherence_note_vi && <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{fluency.coherence_note_vi}</p>}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {fluency.wpm != null && <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{fluency.wpm} WPM</span>}
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{fluency.pause_count} khoảng lặng ≥2s</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{fluency.filler_total} từ đệm</span>
          </div>
        </Pillar>

        <Pillar index={3} title="Gợi ý hành động vàng" accent="border-amber-300 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-slate-900/85">
          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed flex gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{tip.tip_vi}</span>
          </p>
          {tip.example && (
            <p className="text-xs italic text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-950/50 rounded-lg p-2 leading-relaxed border border-amber-200/70 dark:border-amber-500/20">
              "{tip.example}"
            </p>
          )}
        </Pillar>
      </div>

      {workout.transcript && (
        <details className="glass-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">Bản ghi lời nói của bạn</summary>
          <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">{workout.transcript}</p>
        </details>
      )}
    </div>
  );
};

const HistoryList = ({ items, todayDate }) => {
  if (!items?.length) return null;
  return (
    <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
        <HistoryIcon className="w-4 h-4" /> Lịch sử Daily Workout
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(it => (
          <li key={it.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs">
            <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0 w-24">{new Date(`${it.challenge_date}T00:00:00`).toLocaleDateString('vi-VN')}</span>
            {it.status === 'completed' && (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 w-fit">{it.badge}</span>
            )}
            <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-300">
              {it.status === 'completed' ? it.question_text : <span className="italic text-slate-400 dark:text-slate-500">Câu hỏi ẩn (chưa trả lời)</span>}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {it.status === 'completed' ? (
                <>
                  {it.estimated_level && <span className="font-bold text-sky-700 dark:text-sky-300">{it.estimated_level}</span>}
                  {it.tense_verdict && <VerdictBadge verdict={it.tense_verdict} />}
                </>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">{it.challenge_date === todayDate ? 'Chưa làm' : 'Bỏ lỡ'}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// phase: loading | listening | prep | recording | submitting | result | error
export const DailyWorkout = ({ onBack }) => {
  const [today, setToday] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [phase, setPhase] = useState('loading');
  const [prepLeft, setPrepLeft] = useState(10);
  const [attemptKey, setAttemptKey] = useState(0);
  const [error, setError] = useState(null);
  const [useMock, setUseMock] = useState(false);
  const [evaSpeaking, setEvaSpeaking] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const loadHistory = () => dailyApi.history().then(res => setHistoryItems(res.data.items)).catch(() => {});

  const load = async () => {
    try {
      const { data } = await dailyApi.today();
      setToday(data);
      // Straight into the workout; a finished challenge opens on its feedback
      const fb = data.workout.feedback;
      setPhase(fb && (data.workout.status === 'completed' || fb.grading_failed) ? 'result' : 'listening');
    } catch (err) {
      setError(formatApiError(err, 'Không tải được thử thách hôm nay.'));
      setPhase('error');
    }
  };

  useEffect(() => { load(); loadHistory(); }, []);

  // Day rolled over while the page was open: load the new challenge unless mid-recording
  const left = useResetCountdown(today?.resets_at, today?.server_now, () => {
    if (!['recording', 'submitting'].includes(phaseRef.current)) load();
  });

  const prepSeconds = today?.workout?.timing?.prep_sec || 10;

  // 10-second preparation countdown, then recording starts on its own.
  // It is paused while Eva reads (the learner pressed Replay) so recording never starts over her voice.
  useEffect(() => {
    if (phase !== 'prep' || evaSpeaking) return undefined;
    if (prepLeft <= 0) { setPhase('recording'); return undefined; }
    const t = setTimeout(() => setPrepLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, prepLeft, evaSpeaking]);

  // First reading finished -> preparation; a replay finished during preparation -> a fresh 10 seconds
  const handleEvaEnded = () => {
    if (phaseRef.current === 'listening' || phaseRef.current === 'prep') {
      setPrepLeft(prepSeconds);
      setPhase('prep');
    }
  };

  const startPrep = () => {
    if (phaseRef.current !== 'listening') return;
    setPrepLeft(prepSeconds);
    setPhase('prep');
  };

  const handleRecordingComplete = async ({ audioBlob, durationSeconds }) => {
    setPhase('submitting');
    try {
      const formData = new FormData();
      formData.append('duration_seconds', durationSeconds);
      if (useMock) formData.append('mock', 'true');
      if (audioBlob) formData.append('audio_file', audioBlob, recordingFileName(audioBlob, 'daily'));
      const { data } = await dailyApi.submit(today.workout.id, formData);
      setToday(prev => ({ ...prev, workout: data.workout, streak: data.streak }));
      setPhase('result');
      loadHistory();
    } catch (err) {
      setError(formatApiError(err, 'Không gửi được bài nói. Vui lòng thử lại.'));
      setPhase('error');
    }
  };

  const regrade = async () => {
    setRegrading(true);
    try {
      const formData = new FormData();
      if (useMock) formData.append('mock', 'true');
      const { data } = await dailyApi.regrade(today.workout.id, formData);
      setToday(prev => ({ ...prev, workout: data.workout, streak: data.streak }));
      loadHistory();
    } catch (err) {
      setError(formatApiError(err, 'Chưa chấm lại được. Vui lòng thử lại sau ít phút.'));
      setPhase('error');
    } finally {
      setRegrading(false);
    }
  };

  const retry = () => {
    setError(null);
    setAttemptKey(k => k + 1);
    setPhase('listening');
  };

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Đang chuẩn bị thử thách hôm nay...
      </div>
    );
  }

  const workout = today?.workout;
  const streak = today?.streak;
  const timing = workout?.timing || { target_min_sec: 60, time_limit_sec: 90 };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 flex flex-col gap-4 sm:gap-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-600 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
        {streak && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm font-bold text-slate-900 dark:text-white">
              <Flame className={`w-5 h-5 ${streak.current ? 'text-orange-500' : 'text-slate-400'}`} />
              {streak.current} ngày
            </span>
            <WeekDots days={streak.last_7_days} />
          </div>
        )}
      </div>

      {workout && (
        <div className="glass-card rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-white dark:bg-slate-900/85 p-4 sm:p-5 flex flex-col gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-amber-300">
              <Zap className="w-4 h-4" /> 5-Minute Daily Workout
            </span>
            {phase === 'result' && (
              <>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">[{workout.badge}]</span>
                {workout.topic_label && <span className="text-[11px] text-slate-500 dark:text-slate-400">{workout.topic_label}</span>}
              </>
            )}
            {left != null && (
              <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock3 className="w-3.5 h-3.5" /> Câu mới sau <span className="font-mono">{formatCountdown(left)}</span>
              </span>
            )}
          </div>

          {(phase === 'listening' || phase === 'prep') && (
            <EvaAvatar key={`${workout.id}-${attemptKey}`} audioUrl={workout.audio_path} text={workout.question_text} autoPlay maxReplays={1} onAudioEnded={handleEvaEnded} onPlayingChange={setEvaSpeaking} />
          )}

          {phase === 'result' ? (
            <>
              <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed">"{workout.question_text}"</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">Thì trọng tâm: <span className="font-semibold">{workout.focus_label_vi}</span></p>
            </>
          ) : (
            // Listening practice: the text (and the tense hint, which gives the question away) stays hidden until the result
            <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <EyeOff className="w-4 h-4 shrink-0" />
              Nội dung câu hỏi được ẩn - hãy nghe Eva đọc (được nghe lại 1 lần). Câu hỏi sẽ hiện khi có kết quả.
            </p>
          )}

          {phase === 'listening' && (
            <button onClick={startPrep} className="self-start text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer">
              Đã hiểu câu hỏi - bắt đầu 10 giây chuẩn bị →
            </button>
          )}
        </div>
      )}

      {phase === 'prep' && (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/85 p-5 flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chuẩn bị ý tưởng</span>
          <span className={`text-5xl font-black tabular-nums ${evaSpeaking ? 'text-slate-400 dark:text-slate-500' : 'text-brand-600 dark:text-brand-400'}`} aria-live="polite">{prepLeft}</span>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm">
            {evaSpeaking
              ? '⏸ Eva đang đọc lại câu hỏi - đồng hồ tạm dừng. Nghe xong bạn có lại đủ 10 giây chuẩn bị.'
              : 'Nghĩ nhanh: mở bài → 2 ý chính có chi tiết → kết. Hết giờ, micro sẽ tự bật. Có thể bấm Replay ở trên để nghe lại 1 lần.'}
          </p>
          <button onClick={() => setPhase('recording')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold cursor-pointer">
            <Mic className="w-4 h-4" /> Bắt đầu nói ngay
          </button>
        </div>
      )}

      {phase === 'recording' && (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/85 p-4 sm:p-5">
          <AudioRecorder
            key={attemptKey}
            compact
            autoStart
            isPracticeMode
            targetDurationMin={timing.target_min_sec}
            targetDurationMax={timing.time_limit_sec}
            onRecordingComplete={handleRecordingComplete}
          />
        </div>
      )}

      {SHOW_MOCK_OPTION && ['listening', 'prep', 'recording'].includes(phase) && (
        <label className="self-start flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300 cursor-pointer">
          <input type="checkbox" checked={useMock} onChange={(e) => setUseMock(e.target.checked)} />
          DEV: giả lập STT & AI (không gọi Soniox/OpenAI)
        </label>
      )}

      {phase === 'submitting' && (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/85 p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Eva đang nghe lại và chấm nhanh...</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Nhận dạng giọng nói → kiểm tra thì, độ dài, mạch lạc</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="glass-card rounded-2xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-rose-800 dark:text-rose-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => (today ? retry() : load())} className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer">Thử lại</button>
        </div>
      )}

      {phase === 'result' && workout?.feedback && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Phản hồi nhanh chuẩn IH</h1>
            {workout.feedback.estimated_level && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-500 text-white">Ước lượng: {workout.feedback.estimated_level}</span>
            )}
            {workout.status === 'completed' && streak?.done_today && (
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-300">🔥 Chuỗi {streak.current} ngày - hẹn gặp lại ngày mai!</span>
            )}
          </div>
          <QuickFeedback workout={workout} onRegrade={regrade} regrading={regrading} />
          <div className="flex flex-wrap gap-2.5">
            <button onClick={retry} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              <RotateCcw className="w-4 h-4" /> Làm lại câu này
            </button>
            <button onClick={onBack} className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold cursor-pointer">
              Về Dashboard
            </button>
          </div>
        </>
      )}

      {['result', 'listening', 'error'].includes(phase) && <HistoryList items={historyItems} todayDate={workout?.challenge_date} />}
    </div>
  );
};
