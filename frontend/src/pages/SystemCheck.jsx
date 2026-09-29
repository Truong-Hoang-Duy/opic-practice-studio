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
  Play, 
  Square, 
  ArrowRight,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { ViTooltip } from '../components/Tooltip';

export const SystemCheck = ({ onAllChecksPassed }) => {
  // Check statuses: 'pending', 'testing', 'passed', 'failed'
  const [bandwidthStatus, setBandwidthStatus] = useState('pending');
  const [latencyMs, setLatencyMs] = useState(null);

  const [browserStatus, setBrowserStatus] = useState('pending');
  const [browserName, setBrowserName] = useState('');
  const [showMicHelp, setShowMicHelp] = useState(false);

  const [micStatus, setMicStatus] = useState('pending');
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [micQuestionAnswered, setMicQuestionAnswered] = useState(null);

  const [videoStatus, setVideoStatus] = useState('pending');
  const [videoQuestionAnswered, setVideoQuestionAnswered] = useState(null);

  const [captionsStatus, setCaptionsStatus] = useState('pending');
  const [captionsQuestionAnswered, setCaptionsQuestionAnswered] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);

  // 1. Check Browser & Bandwidth automatically on load
  useEffect(() => {
    checkBrowser();
    checkBandwidth();
  }, []);

  const checkBrowser = () => {
    const userAgent = navigator.userAgent;
    let bName = 'Unknown Browser';
    let supported = false;

    if (userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Edg") === -1) {
      bName = "Google Chrome";
      supported = true;
    } else if (userAgent.indexOf("Edg") > -1) {
      bName = "Microsoft Edge";
      supported = true;
    } else if (userAgent.indexOf("Firefox") > -1) {
      bName = "Mozilla Firefox";
      supported = true;
    } else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
      bName = "Apple Safari";
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
    } catch (e) {
      setBandwidthStatus('failed');
    }
  };

  // 3. Microphone Check
  const startMicRecording = async () => {
    setAudioUrl(null);
    setMicQuestionAnswered(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start();
      setIsRecording(true);
    } catch (e) {
      setShowMicHelp(true);
      setMicStatus('failed');
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleMicAnswer = (answeredYes) => {
    setMicQuestionAnswered(answeredYes);
    setMicStatus(answeredYes ? 'passed' : 'failed');
  };

  // 4. Video Canvas Animation (Neutral test video)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;
    let angle = 0;

    const render = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Rotating sample graphics
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(angle);

      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.fillRect(-15, -15, 30, 30);
      ctx.restore();

      // Sample caption text at bottom
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[Sample Video Stream & Audio Neutral Check]', canvas.width / 2, canvas.height - 18);

      angle += 0.03;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleVideoAnswer = (answeredYes) => {
    setVideoQuestionAnswered(answeredYes);
    setVideoStatus(answeredYes ? 'passed' : 'failed');
  };

  const handleCaptionsAnswer = (answeredYes) => {
    setCaptionsQuestionAnswered(answeredYes);
    // Note: official OPIc warns that automated browser captions must be disabled during the exam
    setCaptionsStatus(answeredYes !== null ? 'passed' : 'failed');
  };

  // All 5 checks pass condition
  const allPassed = 
    bandwidthStatus === 'passed' &&
    browserStatus === 'passed' &&
    micStatus === 'passed' &&
    videoStatus === 'passed' &&
    captionsStatus === 'passed';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Title */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Step 1: System Readiness Check</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-lg mx-auto">
          Before entering the test environment, your hardware, network, and browser permissions must pass all 5 criteria to guarantee an uninterrupted speaking session.
        </p>
      </div>

      {/* 5-Step Checks Table */}
      <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden shadow-sm dark:shadow-2xl transition-colors">
        
        {/* Row 1: Bandwidth */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">1. Network Bandwidth & Latency</span>
                <ViTooltip vi="Kiểm tra kết nối mạng để đảm bảo đường truyền âm thanh thời gian thực không bị giật lag.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                </ViTooltip>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {latencyMs !== null ? `Server latency: ${latencyMs}ms (Acceptable < 1000ms)` : 'Testing network ping to speech server...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {bandwidthStatus === 'passed' && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" /> Passed
              </span>
            )}
            {bandwidthStatus === 'failed' && (
              <button
                onClick={checkBandwidth}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Ping
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Web Browser */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">2. Web Browser Compatibility</span>
                <ViTooltip vi="Trình duyệt hợp lệ: Google Chrome, Microsoft Edge, Mozilla Firefox hoặc Apple Safari.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                </ViTooltip>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Detected: <strong className="text-slate-800 dark:text-slate-200">{browserName}</strong> (Chrome, Edge, Firefox, Safari supported)
              </p>
              {showMicHelp && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Please ensure microphone permissions are granted in site settings.</span>
                </div>
              )}
            </div>
          </div>

          <div className="self-end sm:self-center">
            {browserStatus === 'passed' ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" /> Passed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30">
                <XCircle className="w-4 h-4" /> Unsupported
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Microphone Check */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">3. Microphone Recording & Playback</span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Record 3 seconds of your voice, play it back, and confirm you can hear yourself clearly.
                </p>
              </div>
            </div>

            {micStatus === 'passed' && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" /> Passed
              </span>
            )}
          </div>

          {/* Mic controls */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 ml-0 sm:ml-14">
            {!isRecording ? (
              <button
                onClick={startMicRecording}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-sm"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Start Recording Voice</span>
              </button>
            ) : (
              <button
                onClick={stopMicRecording}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors animate-pulse cursor-pointer shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Recording</span>
              </button>
            )}

            {audioUrl && (
              <audio src={audioUrl} controls className="h-8 max-w-[200px]" />
            )}

            {audioUrl && (
              <div className="flex items-center gap-2 ml-auto text-xs text-slate-700 dark:text-slate-300">
                <span>Were you able to record and hear your voice?</span>
                <button
                  onClick={() => handleMicAnswer(true)}
                  className={`px-3 py-1 rounded-lg border font-medium cursor-pointer transition-all ${
                    micQuestionAnswered === true
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleMicAnswer(false)}
                  className={`px-3 py-1 rounded-lg border font-medium cursor-pointer transition-all ${
                    micQuestionAnswered === false
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                      : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Video Check */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">4. Sample Video Display Check</span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Verify your screen can render HTML5 animations and video elements without frame stutter.
                </p>
              </div>
            </div>

            {videoStatus === 'passed' && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" /> Passed
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 ml-0 sm:ml-14">
            <canvas ref={canvasRef} width="280" height="100" className="rounded-xl border border-slate-300 dark:border-slate-800 shadow-md bg-slate-900" />

            <div className="flex flex-col gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span>Were you able to view the sample graphic animation playing smoothly?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVideoAnswer(true)}
                  className={`px-3 py-1 rounded-lg border font-medium cursor-pointer transition-all ${
                    videoQuestionAnswered === true
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleVideoAnswer(false)}
                  className={`px-3 py-1 rounded-lg border font-medium cursor-pointer transition-all ${
                    videoQuestionAnswered === false
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                      : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 5: Captions Setting Check */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Subtitles className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">5. Captions & Accessibility Check</span>
                <ViTooltip vi="Cảnh báo: Trong kỳ thi OPIc thực tế, phụ đề tự động của trình duyệt phải được tắt để phản ánh chính xác kỹ năng nghe hiểu.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                </ViTooltip>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Did automatic browser live captions appear while the video played?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => handleCaptionsAnswer(false)}
              className={`px-3 py-1 rounded-lg text-xs border font-medium cursor-pointer transition-all ${
                captionsQuestionAnswered === false
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 shadow-sm'
              }`}
            >
              No (Standard)
            </button>
            <button
              onClick={() => handleCaptionsAnswer(true)}
              className={`px-3 py-1 rounded-lg text-xs border font-medium cursor-pointer transition-all ${
                captionsQuestionAnswered === true
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                  : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 shadow-sm'
              }`}
            >
              Yes
            </button>
          </div>
        </div>

      </div>

      {/* Next Step Action Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onAllChecksPassed}
          disabled={!allPassed}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-xl ${
            allPassed
              ? 'bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white shadow-sky-500/25 cursor-pointer transform active:scale-95'
              : 'bg-slate-200 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-800'
          }`}
        >
          <span>Next: Background Survey</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
