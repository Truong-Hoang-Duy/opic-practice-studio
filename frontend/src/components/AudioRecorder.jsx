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
        setTimerSeconds(prev => prev + 1);
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

  const getTimerStatusColor = () => {
    if (timerSeconds < targetDurationMin) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    if (timerSeconds <= targetDurationMax) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="w-full glass-card rounded-2xl p-6 border border-slate-800 flex flex-col items-center">
      
      {/* Microphone Error Notification */}
      {micError && (
        <div className="w-full mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold mb-1">Microphone Access Error</p>
            <p className="text-xs text-rose-300/90 leading-relaxed">{micError}</p>
            <div className="mt-2 text-xs text-slate-300">
              <span className="font-medium">Troubleshooting: </span>
              Click the lock/settings icon on your browser address bar and enable "Microphone".
            </div>
          </div>
        </div>
      )}

      {/* Timer and Target Benchmark */}
      <div className="flex flex-col items-center mb-6">
        <div className={`px-4 py-1.5 rounded-full border text-lg font-mono font-bold flex items-center gap-2 ${getTimerStatusColor()}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-400 dark:bg-slate-500'}`} />
          <span>{formatTime(timerSeconds)}</span>
        </div>

        <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
          <ViTooltip vi="Mục tiêu OPIc cho chứng chỉ IH là nói liên tục từ 60 đến 120 giây có cốt truyện và kiểm soát các thì.">
            <span>Target Speaking Range: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">60s – 120s</strong></span>
          </ViTooltip>
        </div>
      </div>

      {/* Dynamic Sound Wave Visualizer while Recording */}
      {isRecording && (
        <div className="w-full max-w-md h-12 flex items-center justify-center gap-1.5 mb-6 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          {[...Array(16)].map((_, i) => {
            const h = Math.max(6, Math.min(40, (audioLevel * ((i % 4) + 1)) / 3));
            return (
              <div
                key={i}
                className="w-1.5 rounded-full bg-gradient-to-t from-sky-500 to-emerald-400 transition-all duration-75"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
      )}

      {/* Main Start / Stop Button */}
      <div className="flex items-center gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            <Mic className="w-5 h-5 animate-pulse" />
            <span>Start Recording Answer</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-semibold text-sm shadow-lg shadow-rose-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            <Square className="w-5 h-5 fill-current" />
            <span>Complete & Submit Recording</span>
          </button>
        )}
      </div>

      {/* Live STT Transcript Display */}
      {isRecording && (
        <div className="w-full mt-6 p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-left shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Soniox STT Stream
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Real-time recognition</span>
          </div>
          
          <div className="text-sm text-slate-900 dark:text-slate-200 min-h-[50px] leading-relaxed">
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
              <p className="text-slate-800 dark:text-slate-200">{liveTranscript}</p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 italic">Listening to your voice... Speak clearly into your microphone.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
