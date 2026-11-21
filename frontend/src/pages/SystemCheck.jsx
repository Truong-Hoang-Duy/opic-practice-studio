import React, { useState, useEffect, useRef } from 'react';
import { systemApi } from '../api/client';
import {
  Wifi,
  Globe,
  Mic,
  Video,
  Subtitles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Square,
  Play,
  Pause,
  ArrowRight,
  HelpCircle,
  RefreshCw,
  Volume2,
  Activity,
} from 'lucide-react';
import { ViTooltip } from '../components/Tooltip';
import { useLanguage } from '../context/LanguageContext';
import { beginRecordingAudioSession, endRecordingAudioSession } from '../utils/audioUnlock';

const MIC_BAR_COUNT = 20;

export const SystemCheck = ({ onAllChecksPassed }) => {
  const { isVi, pick } = useLanguage();

  const [bandwidthStatus, setBandwidthStatus] = useState('pending');
  const [latencyMs, setLatencyMs] = useState(null);

  const [browserStatus, setBrowserStatus] = useState('pending');
  const [browserName, setBrowserName] = useState('');
  const [showMicHelp, setShowMicHelp] = useState(false);

  const [micStatus, setMicStatus] = useState('pending');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [micQuestionAnswered, setMicQuestionAnswered] = useState(null);

  const [videoStatus, setVideoStatus] = useState('pending');
  const [videoQuestionAnswered, setVideoQuestionAnswered] = useState(null);
  const [liveFps, setLiveFps] = useState(60);

  const [captionsStatus, setCaptionsStatus] = useState('pending');
  const [captionsQuestionAnswered, setCaptionsQuestionAnswered] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const meterFrameRef = useRef(null);
  const recTimerRef = useRef(null);
  const recStartRef = useRef(0);
  const playbackRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    checkBrowser();
    checkBandwidth();
    return () => {
      stopMicStreams();
      if (playbackRef.current) {
        try { playbackRef.current.pause(); } catch {}
      }
    };
  }, []);

  const stopMicStreams = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current);
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    setMicLevel(0);
  };

  const checkBrowser = () => {
    const userAgent = navigator.userAgent;
    let bName = 'Unknown Browser';
    let supported = false;

    if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edg') === -1) {
      bName = 'Google Chrome';
      supported = true;
    } else if (userAgent.indexOf('Edg') > -1) {
      bName = 'Microsoft Edge';
      supported = true;
    } else if (userAgent.indexOf('Firefox') > -1) {
      bName = 'Mozilla Firefox';
      supported = true;
    } else if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1) {
      bName = 'Apple Safari';
      supported = true;
    }

    setBrowserName(bName);
    setBrowserStatus(supported ? 'passed' : 'failed');
  };

  const checkBandwidth = async () => {
    setBandwidthStatus('testing');
    const start = Date.now();
    try {
      await systemApi.ping();
      const latency = Date.now() - start;
      setLatencyMs(latency);
      setBandwidthStatus(latency < 1000 ? 'passed' : 'failed');
    } catch {
      setBandwidthStatus('failed');
    }
  };

  const startMicRecording = async () => {
    if (playbackRef.current) {
      try { playbackRef.current.pause(); } catch {}
      setIsPlayingBack(false);
    }
    setAudioUrl(null);
    setAudioDuration(0);
    setMicQuestionAnswered(null);
    setShowMicHelp(false);
    setRecordSec(0);
    audioChunksRef.current = [];

    try {
      beginRecordingAudioSession();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Live real-time input meter via Web Audio API
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          const src = ctx.createMediaStreamSource(stream);
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i += 1) sum += data[i];
            const avg = sum / data.length;
            setMicLevel(Math.min(100, Math.round((avg / 110) * 100)));
            meterFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {}

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const dur = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000));
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioDuration(dur);
        stream.getTracks().forEach((t) => t.stop());
        stopMicStreams();
        endRecordingAudioSession();
      };

      recStartRef.current = Date.now();
      mr.start();
      setIsRecording(true);
      recTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recStartRef.current) / 1000);
        setRecordSec(elapsed);
        if (elapsed >= 8 && mr.state !== 'inactive') {
          mr.stop();
          setIsRecording(false);
        }
      }, 250);
    } catch {
      stopMicStreams();
      endRecordingAudioSession();
      setShowMicHelp(true);
      setMicStatus('failed');
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    if (isPlayingBack && playbackRef.current) {
      playbackRef.current.pause();
      setIsPlayingBack(false);
      return;
    }
    const audio = new Audio(audioUrl);
    playbackRef.current = audio;
    audio.onended = () => setIsPlayingBack(false);
    audio.onerror = () => setIsPlayingBack(false);
    setIsPlayingBack(true);
    audio.play().catch(() => setIsPlayingBack(false));
  };

  const handleMicAnswer = (answeredYes) => {
    setMicQuestionAnswered(answeredYes);
    setMicStatus(answeredYes ? 'passed' : 'failed');
  };

  // Smooth HD widescreen Eva Studio Video Stream canvas with live FPS readout
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;
    let t = 0;
    let frames = 0;
    let lastFpsStamp = performance.now();

    const render = (now) => {
      frames += 1;
      if (now - lastFpsStamp >= 600) {
        const fps = Math.min(120, Math.round((frames * 1000) / (now - lastFpsStamp)));
        setLiveFps(fps);
        frames = 0;
        lastFpsStamp = now;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Deep studio gradient background
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0b1224');
      bg.addColorStop(0.55, '#111d38');
      bg.addColorStop(1, '#0c1f35');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle technical grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
      ctx.lineWidth = 1;
      for (let x = 24; x < w; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 24; y < h; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Smooth pulsing acoustic rings
      for (let i = 0; i < 3; i += 1) {
        const phase = (t * 0.45 + i * 0.33) % 1;
        const r = 18 + phase * 58;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - phase) * 0.45})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Animated equalizer waves flanking center orb
      const barCount = 14;
      for (let i = 0; i < barCount; i += 1) {
        const dist = Math.abs(i - (barCount - 1) / 2);
        const amp = Math.max(4, (Math.sin(t * 3.2 + i * 0.7) * 0.5 + 0.5) * (28 - dist * 2.5));
        const bx = cx - 98 + i * 15;
        const grad = ctx.createLinearGradient(0, cy - amp, 0, cy + amp);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#10b981');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(bx, cy - amp, 5, amp * 2);
        ctx.globalAlpha = 1;
      }

      // Rotating luminous core emblem
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.9);
      const orb = ctx.createLinearGradient(-22, -22, 22, 22);
      orb.addColorStop(0, '#6366f1');
      orb.addColorStop(0.5, '#0ea5e9');
      orb.addColorStop(1, '#10b981');
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();

      t += 0.03;
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleVideoAnswer = (answeredYes) => {
    setVideoQuestionAnswered(answeredYes);
    setVideoStatus(answeredYes ? 'passed' : 'failed');
  };

  const handleCaptionsAnswer = (answeredYes) => {
    setCaptionsQuestionAnswered(answeredYes);
    setCaptionsStatus(answeredYes !== null ? 'passed' : 'failed');
  };

  const passedCount = [bandwidthStatus, browserStatus, micStatus, videoStatus, captionsStatus].filter(
    (s) => s === 'passed'
  ).length;
  const allPassed = passedCount === 5;

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 overflow-y-auto overscroll-contain lg:static lg:inset-auto lg:z-auto lg:h-full lg:overflow-hidden w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[820px] lg:my-auto flex flex-col gap-2.5 sm:gap-4 lg:gap-5">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {pick('Bước 1: Kiểm tra thiết bị', 'Step 1: System Check')}
              </h1>
              <span
                className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold border shrink-0 ${
                  allPassed
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40'
                    : 'bg-indigo-500/15 text-indigo-700 dark:text-sky-300 border-indigo-300/60 dark:border-sky-500/30'
                }`}
              >
                {passedCount}/5 {pick('đạt', 'passed')}
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {pick(
                'Kiểm tra nhanh mạng, trình duyệt, micro, hiển thị và phụ đề trước khi vào bài thi.',
                'Verify your connection, browser, microphone, display animation, and captions before starting.'
              )}
            </p>
          </div>
        </div>

        {/* Balanced 2-Column Bento Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:gap-4 lg:grid-rows-[auto_1fr_auto]">
          {/* 1. Network Bandwidth */}
          <div className="glass-card rounded-2xl p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {pick('1. Kết nối mạng', '1. Network')}
                  </span>
                  <span className="hidden sm:inline">
                    <ViTooltip vi={pick('Kiểm tra độ trễ mạng để âm thanh Eva và gửi bài nói ổn định.', 'Checks server latency so audio playback and uploads run smoothly.')}>
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </ViTooltip>
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {latencyMs !== null ? `Ping: ${latencyMs}ms` : pick('Đang đo...', 'Testing...')}
                </p>
              </div>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              {bandwidthStatus === 'passed' && (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {pick('Đạt', 'Passed')}
                </span>
              )}
              {bandwidthStatus === 'failed' && (
                <button
                  onClick={checkBandwidth}
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-700 dark:text-rose-300 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-rose-500/15 border border-rose-500/30 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {pick('Thử lại', 'Retry')}
                </button>
              )}
            </div>
          </div>

          {/* 2. Web Browser */}
          <div className="glass-card rounded-2xl p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {pick('2. Trình duyệt', '2. Browser')}
                  </span>
                  <span className="hidden sm:inline">
                    <ViTooltip vi={pick('Hỗ trợ Google Chrome, Microsoft Edge, Firefox và Safari.', 'Supports Google Chrome, Microsoft Edge, Firefox, and Safari.')}>
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </ViTooltip>
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  <strong className="text-slate-800 dark:text-slate-200">{browserName}</strong>
                </p>
              </div>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              {browserStatus === 'passed' ? (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {pick('Đạt', 'Passed')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-700 dark:text-rose-300 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-rose-500/15 border border-rose-500/30">
                  <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {pick('Chưa hỗ trợ', 'Unsupported')}
                </span>
              )}
            </div>
          </div>

          {/* 3. Redesigned Studio Microphone Console (Sample Read-Aloud + Live Level Meter + Playback) */}
          <div className="col-span-2 md:col-span-1 glass-card rounded-2xl p-3 sm:p-4 lg:p-5 flex flex-col justify-between gap-2.5 sm:gap-3.5">
            <div className="flex items-start justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block truncate">
                    {pick('3. Kiểm tra Micro', '3. Microphone Check')}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {pick('Đọc thử câu mẫu, nghe lại và xác nhận rõ tiếng.', 'Read the test sentence, play it back, and confirm clear audio.')}
                  </p>
                </div>
              </div>
              {micStatus === 'passed' && (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 px-2 sm:px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {pick('Đạt', 'Passed')}
                </span>
              )}
            </div>

            {/* Sample Read-Aloud Sentence (ALWAYS in English!) */}
            <div className="px-3 py-2 sm:py-2.5 rounded-xl bg-indigo-50/70 dark:bg-sky-950/35 border border-indigo-200/70 dark:border-sky-500/25 flex flex-col gap-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
                {pick('Câu đọc thử tiếng Anh', 'Sample sentence to read aloud')}
              </span>
              <p className="text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                "Hello, I am checking my microphone before starting the OPIc test."
              </p>
            </div>

            {showMicHelp && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pick('Vui lòng cấp quyền Micro cho trang web trong trình duyệt.', 'Please allow microphone access in your browser settings.')}</span>
              </div>
            )}

            {/* Studio Live Meter & Action Bar */}
            <div className="flex-1 min-h-0 p-3 sm:p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-center gap-2.5 sm:gap-3">
              {/* Live 20-bar Audio Input Waveform */}
              <div className="w-full h-9 sm:h-11 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : audioUrl ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span>0:0{Math.min(9, isRecording ? recordSec : audioDuration)}</span>
                </div>

                <div className="flex-1 flex items-center justify-center gap-1 h-6">
                  {[...Array(MIC_BAR_COUNT)].map((_, i) => {
                    const waveScale = isRecording
                      ? Math.max(0.2, Math.min(1, ((micLevel / 100) * (0.55 + ((i * 7) % 5) * 0.14))))
                      : isPlayingBack
                        ? 0.35 + ((i % 4) * 0.16)
                        : 0.2;
                    return (
                      <span
                        key={i}
                        className={`w-1 sm:w-1.5 h-full rounded-full transition-transform duration-75 origin-center ${
                          isRecording
                            ? 'bg-gradient-to-t from-sky-500 to-emerald-400'
                            : isPlayingBack
                              ? 'bg-gradient-to-t from-indigo-500 to-sky-400 animate-pulse'
                              : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                        style={{ transform: `scaleY(${waveScale})` }}
                      />
                    );
                  })}
                </div>

                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase shrink-0">
                  {isRecording ? (micLevel > 10 ? pick('Có tiếng', 'Signal') : pick('Im lặng', 'Quiet')) : audioUrl ? pick('Đã ghi', 'Saved') : 'MIC'}
                </span>
              </div>

              {/* Action Controls Row (Fixed width / zero jump) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={isRecording ? stopMicRecording : startMicRecording}
                    className={`h-9 inline-flex items-center justify-center px-3.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                      isRecording
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                        : 'btn-brand-gradient'
                    }`}
                  >
                    <span className="inline-grid items-center justify-items-center">
                      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap ${!isRecording ? 'visible' : 'invisible pointer-events-none'}`}>
                        <Mic className="w-3.5 h-3.5 shrink-0" />
                        <span>{pick('Ghi thử', 'Record')}</span>
                      </span>
                      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap ${isRecording ? 'visible' : 'invisible pointer-events-none'}`}>
                        <Square className="w-3.5 h-3.5 fill-current shrink-0" />
                        <span>{pick('Dừng ghi', 'Stop')}</span>
                      </span>
                    </span>
                  </button>

                  {audioUrl && (
                    <button
                      type="button"
                      onClick={togglePlayback}
                      className={`h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                        isPlayingBack
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {isPlayingBack ? <Pause className="w-3.5 h-3.5 shrink-0" /> : <Play className="w-3.5 h-3.5 fill-current shrink-0" />}
                      <span>{isPlayingBack ? pick('Dừng', 'Pause') : pick('Nghe lại', 'Playback')}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="hidden sm:inline text-slate-500 dark:text-slate-400 font-medium mr-0.5">
                    {pick('Rõ tiếng?', 'Clear?')}
                  </span>
                  <button
                    type="button"
                    disabled={!audioUrl}
                    onClick={() => handleMicAnswer(true)}
                    className={`px-3 py-1.5 rounded-lg border font-bold transition-all whitespace-nowrap ${
                      !audioUrl
                        ? 'opacity-45 cursor-not-allowed bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
                        : micQuestionAnswered === true
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 cursor-pointer'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-400 cursor-pointer'
                    }`}
                  >
                    {pick('Có', 'Yes')}
                  </button>
                  <button
                    type="button"
                    disabled={!audioUrl}
                    onClick={() => handleMicAnswer(false)}
                    className={`px-3 py-1.5 rounded-lg border font-bold transition-all whitespace-nowrap ${
                      !audioUrl
                        ? 'opacity-45 cursor-not-allowed bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
                        : micQuestionAnswered === false
                          ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50 cursor-pointer'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-rose-400 cursor-pointer'
                    }`}
                  >
                    {pick('Không', 'No')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Redesigned Widescreen HD Studio Video Check */}
          <div className="col-span-2 md:col-span-1 glass-card rounded-2xl p-3 sm:p-4 lg:p-5 flex flex-col justify-between gap-2.5 sm:gap-3.5">
            <div className="flex items-start justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block truncate">
                    {pick('4. Kiểm tra hiển thị', '4. Display & Video Check')}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {pick('Kiểm tra đồ họa và hoạt ảnh chạy mượt trên màn hình.', 'Check that animations and examiner visuals render smoothly.')}
                  </p>
                </div>
              </div>
              {videoStatus === 'passed' && (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 px-2 sm:px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {pick('Đạt', 'Passed')}
                </span>
              )}
            </div>

            {/* Full-Width Widescreen Studio Preview Monitor */}
            <div className="relative flex-1 min-h-[110px] sm:min-h-[145px] w-full rounded-xl overflow-hidden border border-slate-300/80 dark:border-slate-700/80 shadow-inner bg-[#0b1224]">
              <canvas
                ref={canvasRef}
                width="480"
                height="180"
                className="w-full h-full object-cover block"
              />
              <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/75 border border-white/15 text-[10px] font-bold text-sky-300 backdrop-blur-xs">
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span>{pick('Luồng mô phỏng Eva', 'Eva Studio Stream')}</span>
              </div>
              <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/35 text-[10px] font-mono font-bold text-emerald-300 backdrop-blur-xs">
                <Activity className="w-3 h-3" />
                <span>{liveFps} FPS</span>
              </div>
            </div>

            {/* Crisp Bottom Confirmation Strip */}
            <div className="flex items-center justify-between gap-2 pt-0.5 shrink-0 text-xs">
              <span className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300">
                {pick('Hình động trên chạy mượt chứ?', 'Does the animation run smoothly?')}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleVideoAnswer(true)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] border font-bold cursor-pointer transition-all whitespace-nowrap ${
                    videoQuestionAnswered === true
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-400'
                  }`}
                >
                  {pick('Mượt', 'Smooth')}
                </button>
                <button
                  type="button"
                  onClick={() => handleVideoAnswer(false)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] border font-bold cursor-pointer transition-all whitespace-nowrap ${
                    videoQuestionAnswered === false
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-rose-400'
                  }`}
                >
                  {pick('Bị giật', 'Laggy')}
                </button>
              </div>
            </div>
          </div>

          {/* 5. Captions Check (Full-width compact bottom card) */}
          <div className="col-span-2 glass-card rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <Subtitles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {pick('5. Phụ đề trình duyệt', '5. Browser Captions')}
                  </span>
                  <span className="hidden sm:inline">
                    <ViTooltip vi={pick('Trong kỳ thi OPIc thực tế, phụ đề tự động của trình duyệt cần được tắt.', 'In an actual OPIc exam, automatic browser live captions must stay off.')}>
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </ViTooltip>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                  {pick('Phụ đề tự động của trình duyệt có tự hiện không?', 'Did automatic browser live captions appear?')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => handleCaptionsAnswer(false)}
                className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl text-xs border font-bold cursor-pointer transition-all whitespace-nowrap ${
                  captionsQuestionAnswered === false
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {pick('Không (Chuẩn)', 'No (Standard)')}
              </button>
              <button
                type="button"
                onClick={() => handleCaptionsAnswer(true)}
                className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl text-xs border font-bold cursor-pointer transition-all whitespace-nowrap ${
                  captionsQuestionAnswered === true
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {pick('Có', 'Yes')}
              </button>
            </div>
          </div>
        </div>

        {/* Action Row (Pinned symmetrically at bottom) */}
        <div className="flex justify-end shrink-0">
          <button
            type="button"
            onClick={onAllChecksPassed}
            title={allPassed ? undefined : pick('Bạn có thể bỏ qua bước kiểm tra và sang bước tiếp theo', 'You may skip the check and continue')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl btn-brand-gradient font-extrabold text-sm cursor-pointer whitespace-nowrap"
          >
            <span>{allPassed ? pick('Tiếp tục', 'Next') : pick('Bỏ qua', 'Skip')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
