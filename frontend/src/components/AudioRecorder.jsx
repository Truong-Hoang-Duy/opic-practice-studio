import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle } from 'lucide-react';
import { beginRecordingAudioSession, endRecordingAudioSession, getSharedAudio } from '../utils/audioUnlock';
import { useLanguage } from '../context/LanguageContext';

export const AudioRecorder = ({
  onRecordingComplete,
  isPracticeMode = false,
  compact = false, // embedded in another card (warm-up): no fixed height, tighter spacing
  targetDurationMin = 60,
  targetDurationMax = 120,
  autoStart = false, // start recording automatically (e.g. after 2nd question reading or daily prep countdown)
}) => {
  const { pick } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [micError, setMicError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastDuration, setLastDuration] = useState(null); // seconds of the last finished take

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const startedAtRef = useRef(0);
  const startingRef = useRef(false);
  const isRecordingRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Leaving mid-recording (e.g. "Next" on Q1): discard the take and release the microphone
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch (e) {}
        }
        recorder.stream?.getTracks().forEach(track => track.stop());
      }
      isRecordingRef.current = false;
      startingRef.current = false;
      stopAllStreams();
      endRecordingAudioSession();
    };
  }, []);

  // Once per recorder (StrictMode re-runs effects; the ref survives that)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || isRecordingRef.current || startingRef.current || lastDuration !== null) return;
    autoStartedRef.current = true;
    startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const stopAllStreams = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
    }
  };

  const startRecording = async () => {
    if (startingRef.current || isRecordingRef.current) return;
    startingRef.current = true;
    setMicError(null);
    setLastDuration(null);
    setTimerSeconds(0);
    audioChunksRef.current = [];

    try {
      // Stop any ongoing Eva playback so her voice is never recorded into the microphone
      try {
        const shared = getSharedAudio();
        if (shared && !shared.paused) shared.pause();
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {}

      beginRecordingAudioSession();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // 1. Audio Level Metering via Web Audio API (isolated so iOS Safari AudioContext state never blocks recording)
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (meterErr) {
        console.warn("Audio level metering unavailable:", meterErr);
      }

      // 2. Record only. The finished file is uploaded and transcribed on the server (no real-time streaming).
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      let mediaRecorder;
      try {
        const opts = mimeType ? { mimeType, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 };
        mediaRecorder = new MediaRecorder(stream, opts);
      } catch {
        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        isRecordingRef.current = false;
        startingRef.current = false;
        const type = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type });
        // Wall-clock duration (the timer state is stale inside this callback)
        const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        setLastDuration(durationSeconds);

        if (onRecordingComplete) {
          onRecordingComplete({ audioBlob, durationSeconds, mimeType: type });
        }

        stream.getTracks().forEach(track => track.stop());
        stopAllStreams();
        endRecordingAudioSession();
      };

      mediaRecorder.start(1000);
      startedAtRef.current = Date.now();
      isRecordingRef.current = true;
      startingRef.current = false;
      setIsRecording(true);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          const next = prev + 1;
          if (next >= targetDurationMax) {
            stopRecording();
          }
          return next;
        });
      }, 1000);

    } catch (err) {
      console.error("Microphone access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError("Microphone permission denied. Please allow microphone access in your browser settings to record your answer.");
      } else {
        setMicError(`Unable to start microphone: ${err.message || 'Unknown error'}`);
      }
      isRecordingRef.current = false;
      startingRef.current = false;
      setIsRecording(false);
      stopAllStreams();
      endRecordingAudioSession();
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    startingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Timer color indicator based on OPIc target duration (60-120s)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const timeLeft = Math.max(0, targetDurationMax - timerSeconds);
  const progressPercent = isRecording 
    ? Math.max(0, Math.min(100, (timeLeft / targetDurationMax) * 100))
    : 100;

  const getTimerStatusColor = () => {
    if (timerSeconds < targetDurationMin) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    if (timerSeconds <= targetDurationMax) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getProgressColor = () => {
    if (!isRecording) return 'bg-gradient-to-r from-sky-500 to-emerald-400 opacity-60';
    if (timeLeft > 45) return 'bg-gradient-to-r from-emerald-500 to-teal-400';
    if (timeLeft >= 15) return 'bg-gradient-to-r from-amber-500 to-orange-400';
    return 'bg-gradient-to-r from-rose-500 to-red-500 animate-pulse';
  };

  return (
    <div className={compact
      ? "w-full flex flex-col gap-2"
      : "w-full lg:h-full flex-shrink-0 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-200 dark:border-slate-800 flex flex-col lg:justify-between gap-2.5 lg:gap-0 shadow-sm"}>
      
      {/* Microphone Error Notification */}
      {micError && (
        <div className="w-full p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-0.5">Microphone Error</p>
            <p className="opacity-90 leading-snug">{micError}</p>
          </div>
        </div>
      )}

      {/* Top: Timer, Countdown, and Time Limit Progress Bar */}
      <div className="flex flex-col items-center w-full shrink-0">
        <div className="flex items-center gap-2">
          <div className={`px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full border text-sm sm:text-base font-mono font-bold flex items-center gap-1.5 sm:gap-2 ${getTimerStatusColor()}`}>
            <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-400 dark:bg-slate-500'}`} />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          <div className="px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {pick('Giới hạn:', 'Limit:')} <strong>{formatTime(targetDurationMax)}</strong>
          </div>
        </div>

        {/* Depleting Countdown Progress Bar */}
        <div className="w-full max-w-sm mt-1.5 lg:mt-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 px-0.5">
            <span>{isRecording ? pick('⏱️ Đang đếm ngược', '⏱️ Recording') : pick('⏱️ Thời gian nói', '⏱️ Speaking time')}</span>
            <span className={timeLeft <= 15 && isRecording ? 'text-rose-600 dark:text-rose-400 font-bold animate-pulse' : 'font-semibold'}>
              {isRecording
                ? `${pick('Còn:', 'Left:')} ${formatTime(timeLeft)}`
                : `${pick('Nên nói:', 'Target:')} ${targetDurationMin}s–${targetDurationMax}s`}
            </span>
          </div>
          
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-slate-300 dark:border-slate-700/60">
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400/50 dark:bg-slate-500/50 z-10" 
              style={{ left: `${Math.max(0, Math.min(100, ((targetDurationMax - targetDurationMin) / targetDurationMax) * 100))}%` }} 
              title={pick(`Nên nói tối thiểu ${targetDurationMin}s`, `Aim for at least ${targetDurationMin}s`)}
            />
            <div
              className={`h-full rounded-full transition-all duration-300 ease-linear ${getProgressColor()}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="hidden lg:flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-0.5">
            <span>0:00</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {pick(`Nên nói: ${targetDurationMin}s – ${targetDurationMax}s`, `Target: ${targetDurationMin}s – ${targetDurationMax}s`)}
            </span>
            <span>{formatTime(targetDurationMax)}</span>
          </div>
        </div>
      </div>

      {/* Middle: Sound Wave Visualizer & Fixed-Position Start/Stop Action Row */}
      <div className={`flex flex-col items-center w-full shrink-0 ${compact ? 'my-1' : 'lg:my-3'}`}>
        {/* Dynamic Sound Wave Visualizer */}
        <div className={`w-full max-w-sm h-7 lg:h-10 flex items-center justify-center gap-1.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 ${compact ? 'mb-2' : 'mb-2 lg:mb-3'}`}>
          {[...Array(16)].map((_, i) => {
            const h = isRecording 
              ? Math.max(5, Math.min(22, (audioLevel * ((i % 4) + 1)) / 3))
              : 5;
            return (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-75 ${
                  isRecording 
                    ? 'bg-gradient-to-t from-sky-500 to-emerald-400' 
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>

        {/* Locked Single Row: Blue Start / Red Stop NEVER moves position vertically or horizontally */}
        <div className="w-full max-w-sm lg:max-w-none flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex-1 lg:flex-none h-11 px-4 lg:px-6 rounded-xl font-bold text-xs sm:text-sm inline-flex items-center justify-center cursor-pointer transition-colors ${
              isRecording
                ? 'bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white shadow-md shadow-rose-500/25 active:scale-95'
                : 'btn-brand-gradient'
            }`}
          >
            <span className="inline-grid items-center justify-items-center">
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap ${!isRecording ? 'visible' : 'invisible pointer-events-none'}`}>
                <Mic className="w-4 h-4 animate-pulse shrink-0" />
                <span>{pick('Ghi âm', 'Record')}</span>
              </span>
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap ${isRecording ? 'visible' : 'invisible pointer-events-none'}`}>
                <Square className="w-4 h-4 fill-current shrink-0" />
                <span>{pick('Nộp bài', 'Submit')}</span>
              </span>
            </span>
          </button>

          {import.meta.env.DEV && onRecordingComplete && (
            <button
              type="button"
              disabled={isRecording}
              onClick={() => {
                setLastDuration(65);
                onRecordingComplete({ audioBlob: null, durationSeconds: 65, devMock: true });
              }}
              title="Chỉ hiện ở môi trường local (npm run dev). Giả lập 1 bài nói 65 giây để kiểm tra chấm điểm & giao diện."
              className="h-11 px-3 lg:px-3.5 rounded-xl border border-dashed border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-extrabold cursor-pointer transition-colors shrink-0 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              DEV · 65s
            </button>
          )}
        </div>
      </div>

      {/* Bottom: recording status (Desktop lg+ only — kept strictly hidden on mobile so button never jumps!) */}
      <div className={`hidden lg:flex w-full rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 items-center justify-center text-center ${
        compact ? 'p-2.5 min-h-[44px]' : 'p-3.5 min-h-[68px]'
      }`}>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
          {isRecording
            ? pick('Đang ghi âm... Bấm "Nộp bài" khi trả lời xong.', 'Recording... Click "Submit" when you finish speaking.')
            : lastDuration !== null
            ? pick(`Đã ghi ${lastDuration} giây. Đang nhận dạng giọng nói...`, `Recorded ${lastDuration}s. Transcribing your response...`)
            : pick('Bấm "Ghi âm" để nói ngay, hoặc nghe lại lần 2 để tự bật ghi âm.', 'Click "Record" to speak now, or replay once to auto-start recording.')}
        </p>
      </div>
    </div>
  );
};
