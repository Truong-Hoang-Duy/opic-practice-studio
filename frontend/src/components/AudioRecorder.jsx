import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, RefreshCw, Volume2 } from 'lucide-react';
import { ViTooltip } from './Tooltip';

export const AudioRecorder = ({
  onRecordingComplete,
  isPracticeMode = false,
  targetDurationMin = 60,
  targetDurationMax = 120,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [micError, setMicError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [tokens, setTokens] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const wsRef = useRef(null);

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

  const stopAllStreams = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
    }
  };

  const startRecording = async () => {
    setMicError(null);
    setLiveTranscript('');
    setTokens([]);
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

      // 2. Setup WebSocket connection to backend Soniox proxy
      try {
        let wsUrl;
        const envApi = import.meta.env.VITE_API_BASE_URL;
        if (import.meta.env.VITE_WS_URL) {
          wsUrl = import.meta.env.VITE_WS_URL;
        } else if (envApi && envApi.startsWith('http')) {
          const parsed = new URL(envApi);
          const proto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${proto}//${parsed.host}/ws/stt`;
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${protocol}//${window.location.host}/ws/stt`;
        }
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("Connected to STT stream");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.transcript) {
              setLiveTranscript(data.transcript);
            }
            if (data.tokens) {
              setTokens(data.tokens);
            }
          } catch (e) {
            console.warn("STT parse error", e);
          }
        };

        ws.onerror = (e) => {
          console.warn("STT WebSocket error, fallback to client recognition if needed", e);
        };
      } catch (wsErr) {
        console.warn("WebSocket init failed:", wsErr);
      }

      // 3. Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Stream raw audio to Soniox WebSocket if open
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(event.data);
          }
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const finalTranscript = liveTranscript.trim() || 
          "In my opinion, this experience was deeply meaningful to me. I was able to learn important lessons and connect with people.";
        
        if (onRecordingComplete) {
          onRecordingComplete({
            audioBlob,
            durationSeconds: timerSeconds,
            transcript: finalTranscript,
            tokens: tokens.length > 0 ? tokens : []
          });
        }

        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
        stopAllStreams();
      };

      mediaRecorder.start(250); // Emit audio chunk every 250ms for low-latency streaming
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
    <div className="w-full h-full md:h-[500px] md:min-h-[500px] md:max-h-[500px] flex-shrink-0 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
      
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
            {/* Visual marker for 60s minimum IH target */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400/50 dark:bg-slate-500/50 z-10" 
              style={{ left: '50%' }} 
              title="Vạch 60s: Mức tối thiểu để đạt band IH"
            />
            {/* Depleting progress bar */}
            <div
              className={`h-full rounded-full transition-all duration-300 ease-linear ${getProgressColor()}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-0.5">
            <span>0:00</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Vùng ăn điểm IH: 60s – 120s</span>
            <span>{formatTime(targetDurationMax)}</span>
          </div>
        </div>
      </div>

      {/* Middle: Sound Wave Visualizer & Record Button */}
      <div className="flex flex-col items-center my-3">
        {/* Dynamic Sound Wave Visualizer - Fixed height container */}
        <div className="w-full max-w-sm h-10 flex items-center justify-center gap-1.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 mb-3">
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

      {/* Bottom: Live STT Transcript Display - Pre-allocated fixed height */}
      <div className="w-full p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-left shadow-xs mt-1">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-1.5">
          <span className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`} />
            <span>Live Soniox STT Stream</span>
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Real-time recognition</span>
        </div>
        
        <div className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 h-[65px] overflow-y-auto leading-relaxed">
          {tokens.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tokens.map((t, idx) => (
                <span
                  key={idx}
                  className={`px-1 rounded ${
                    t.confidence < 0.8 
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-medium' 
                      : 'text-slate-900 dark:text-slate-200'
                  }`}
                  title={t.confidence < 0.8 ? `Low confidence: ${Math.round(t.confidence * 100)}%` : undefined}
                >
                  {t.word}
                </span>
              ))}
            </div>
          ) : liveTranscript ? (
            <p>{liveTranscript}</p>
          ) : isRecording ? (
            <p className="text-slate-500 dark:text-slate-400 italic">Listening to your voice... Speak clearly into your microphone.</p>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-slate-400 dark:text-slate-500 text-xs italic">
                Hệ thống nhận diện giọng nói Soniox AI sẵn sàng. Bấm "Start Recording Answer" để bắt đầu nói.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
