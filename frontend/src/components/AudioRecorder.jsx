import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle } from 'lucide-react';

export const AudioRecorder = ({
  onRecordingComplete,
  isPracticeMode = false,
  compact = false, // embedded in another card (warm-up): no fixed height, tighter spacing
  targetDurationMin = 60,
  targetDurationMax = 120,
  autoStart = false, // start recording as soon as the recorder appears (daily workout after the prep countdown)
}) => {
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
      stopAllStreams();
    };
  }, []);

  // Once per recorder (StrictMode re-runs effects; the ref survives that)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
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
    setMicError(null);
    setLastDuration(null);
    setTimerSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // 1. Audio Level Metering via Web Audio API
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
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

      // 2. Record only. The finished file is uploaded and transcribed on the server (no real-time streaming).
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
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
      };

      mediaRecorder.start(1000);
      startedAtRef.current = Date.now();
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
      setIsRecording(false);
      stopAllStreams();
    }
  };

  const stopRecording = () => {
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
      : "w-full h-full md:h-[500px] md:min-h-[500px] md:max-h-[500px] flex-shrink-0 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm"}>
      
      {/* Microphone Error Notification */}
      {micError && (
        <div className="w-full mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold mb-0.5">Microphone Access Error</p>
            <p className="text-rose-300/90 leading-relaxed">{micError}</p>
          </div>
        </div>
      )}

      {/* Top: Timer, Countdown, and Time Limit Progress Bar ("cây chạy") */}
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center gap-2.5">
          <div className={`px-3.5 py-1 rounded-full border text-base font-mono font-bold flex items-center gap-2 ${getTimerStatusColor()}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-400 dark:bg-slate-500'}`} />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Giới hạn: <strong>{formatTime(targetDurationMax)}</strong>
          </div>
        </div>

        {/* Depleting Countdown Progress Bar ("Cây chạy hiển thị dần hết") */}
        <div className="w-full max-w-sm mt-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 px-0.5">
            <span>{isRecording ? '⏱️ Đang đếm ngược' : '⏱️ Giới hạn thời gian nói'}</span>
            <span className={timeLeft <= 15 && isRecording ? 'text-rose-600 dark:text-rose-400 font-bold animate-pulse' : 'font-semibold'}>
              {isRecording ? `Còn lại: ${formatTime(timeLeft)}` : `Tối đa: ${formatTime(targetDurationMax)}`}
            </span>
          </div>
          
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-slate-300 dark:border-slate-700/60">
            {/* Marker: the bar has depleted to here once the recommended minimum has been spoken */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400/50 dark:bg-slate-500/50 z-10" 
              style={{ left: `${Math.max(0, Math.min(100, ((targetDurationMax - targetDurationMin) / targetDurationMax) * 100))}%` }} 
              title={`Nên nói tối thiểu ${targetDurationMin}s`}
            />
            {/* Depleting progress bar */}
            <div
              className={`h-full rounded-full transition-all duration-300 ease-linear ${getProgressColor()}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-0.5">
            <span>0:00</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Nên nói: {targetDurationMin}s – {targetDurationMax}s</span>
            <span>{formatTime(targetDurationMax)}</span>
          </div>
        </div>
      </div>

      {/* Middle: Sound Wave Visualizer & Record Button */}
      <div className={`flex flex-col items-center ${compact ? 'my-1' : 'my-3'}`}>
        {/* Dynamic Sound Wave Visualizer - Fixed height container */}
        <div className={`w-full max-w-sm h-10 flex items-center justify-center gap-1.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 ${compact ? 'mb-2' : 'mb-3'}`}>
          {[...Array(16)].map((_, i) => {
            const h = isRecording 
              ? Math.max(6, Math.min(30, (audioLevel * ((i % 4) + 1)) / 3))
              : 6;
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

        {/* Main Start / Stop Button */}
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white font-bold text-sm shadow-md shadow-sky-500/20 transition-all transform active:scale-95 cursor-pointer"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span>Start Recording Answer</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-bold text-sm shadow-md shadow-rose-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Complete & Submit Recording</span>
          </button>
        )}
      </div>

      {/* Bottom: recording status (speech is recognised after the recording is submitted) */}
      <div className={`w-full rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-center ${compact ? 'p-2.5 min-h-[44px]' : 'p-3.5 min-h-[72px]'}`}>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
          {isRecording
            ? 'Đang ghi âm... Hãy nói rõ vào micro. Bấm "Complete & Submit" khi trả lời xong.'
            : lastDuration !== null
            ? `Đã ghi ${lastDuration} giây. Hệ thống đang/đã nhận dạng giọng nói để chấm điểm.`
            : 'Bấm "Start Recording Answer" để trả lời. Sau khi ghi xong, hệ thống sẽ nhận dạng giọng nói và chấm điểm.'}
        </p>
      </div>
    </div>
  );
};
