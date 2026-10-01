import React, { useState, useRef, useEffect } from 'react';
import { Volume2, RotateCcw, VolumeX } from 'lucide-react';
import { ViTooltip } from './Tooltip';
import { resolveMediaUrl } from '../api/client';
import { getSharedAudio, getVoices } from '../utils/audioUnlock';

// Browser voices closest to Eva (calm young American female), used when server audio is unavailable
const PREFERRED_VOICES = ['Aria', 'Jenny', 'Ava', 'Samantha', 'Google US English', 'Zira'];
// Safari drops speech that wasn't started by a user gesture without firing any event
const SPEECH_START_TIMEOUT_MS = 2000;

const pickEvaVoice = (voices) => {
  const english = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en-us'));
  for (const name of PREFERRED_VOICES) {
    const match = english.find(v => v.name.includes(name));
    if (match) return match;
  }
  return english[0] || null;
};

export const EvaAvatar = ({
  audioUrl,
  text,
  autoPlay = true,
  onAudioEnded,
  allowReplay = true,
  maxReplays = 1,
  // Strict exam: replay is only possible within this many seconds after Eva finishes reading
  replayWindowSec = null
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [replayWindowLeft, setReplayWindowLeft] = useState(null); // null = not opened yet, 0 = expired
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const speechWatchdogRef = useRef(null);
  const isReplayingRef = useRef(false);

  const handlePlaybackEnded = () => {
    setIsPlaying(false);
    if (replayWindowSec && !isReplayingRef.current && replayCount < maxReplays) {
      setReplayWindowLeft(replayWindowSec);
    }
    isReplayingRef.current = false;
    if (onAudioEnded) onAudioEnded();
  };
  // The shared <audio> listeners are attached once per question; route them to the latest handler
  const playbackEndedRef = useRef(handlePlaybackEnded);
  playbackEndedRef.current = handlePlaybackEnded;

  // Count down the replay window; once it hits 0 the replay is lost
  useEffect(() => {
    if (!replayWindowLeft) return;
    const timer = setTimeout(() => setReplayWindowLeft(left => Math.max(0, left - 1)), 1000);
    return () => clearTimeout(timer);
  }, [replayWindowLeft]);

  const src = resolveMediaUrl(audioUrl);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  // Fall back to browser speech when the server has no audio for this question or it fails to load
  const useSpeech = (!src || audioFailed) && !!text && speechSupported;

  const stopSpeech = () => {
    if (!speechSupported) return;
    clearTimeout(speechWatchdogRef.current);
    utteranceRef.current = null;
    window.speechSynthesis.cancel();
  };

  // Must stay synchronous: Safari only honours speak() while still inside the click that triggered it
  const speakText = () => {
    if (!speechSupported || !text) return;
    const synth = window.speechSynthesis;
    clearTimeout(speechWatchdogRef.current);
    // Safari may swallow the next utterance after cancel(), so only cancel when something is queued
    if (synth.speaking || synth.pending) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickEvaVoice(getVoices());
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.volume = isMuted ? 0 : 1;
    utterance.onstart = () => {
      if (utteranceRef.current !== utterance) return;
      clearTimeout(speechWatchdogRef.current);
      setAutoplayBlocked(false);
      setIsPlaying(true);
    };
    utterance.onend = () => {
      // Ignore events from utterances that were cancelled/replaced
      if (utteranceRef.current !== utterance) return;
      clearTimeout(speechWatchdogRef.current);
      handlePlaybackEnded();
    };
    utterance.onerror = (e) => {
      if (utteranceRef.current !== utterance) return;
      clearTimeout(speechWatchdogRef.current);
      setIsPlaying(false);
      if (e.error === 'not-allowed') setAutoplayBlocked(true);
    };
    utteranceRef.current = utterance;
    synth.speak(utterance);
    speechWatchdogRef.current = setTimeout(() => {
      if (utteranceRef.current !== utterance) return;
      console.warn("Browser speech did not start (autoplay blocked); user interaction needed.");
      stopSpeech();
      setIsPlaying(false);
      setAutoplayBlocked(true);
    }, SPEECH_START_TIMEOUT_MS);
  };

  // New question: reset the failure flag
  useEffect(() => {
    setAudioFailed(false);
  }, [audioUrl]);

  // Server audio: load it into the shared (Safari-unlocked) element and autoplay
  useEffect(() => {
    if (!src || audioFailed) return;
    const audio = getSharedAudio();
    if (!audio) return;
    audioRef.current = audio;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => playbackEndedRef.current();
    const onError = () => {
      console.warn("Eva audio failed to load; falling back to browser speech.");
      setIsPlaying(false);
      setAudioFailed(true);
    };
    audio.pause();
    audio.muted = false;
    audio.src = src;
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    if (autoPlay) {
      audio.play().catch(e => {
        // AbortError just means the question changed before playback started
        if (e.name === 'AbortError') return;
        console.warn("Autoplay blocked by browser policy; user interaction needed:", e);
        setAutoplayBlocked(true);
      });
    }
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
      setIsPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, audioFailed]);

  // Browser speech fallback autoplay
  useEffect(() => {
    if (!autoPlay || !useSpeech) return;
    speakText();
    return () => {
      stopSpeech();
      setIsPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSpeech, text, autoPlay]);

  const handlePlayToggle = () => {
    if (useSpeech) {
      if (isPlaying) {
        stopSpeech();
        setIsPlaying(false);
      } else {
        speakText();
      }
      return;
    }
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const windowOpen = !replayWindowSec || replayWindowLeft > 0;
  const canReplay = replayCount < maxReplays && !isPlaying && windowOpen;

  const handleFirstPlay = () => {
    // Autoplay was blocked: the learner starts the first reading manually (doesn't use the replay)
    setAutoplayBlocked(false);
    if (useSpeech) {
      speakText();
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setAutoplayBlocked(true));
    }
  };

  const handleReplay = () => {
    if (!canReplay) return;
    isReplayingRef.current = true;
    setReplayWindowLeft(null);
    if (useSpeech) {
      setReplayCount(prev => prev + 1);
      speakText();
      return;
    }
    if (!audioRef.current) return;
    setReplayCount(prev => prev + 1);
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    if (useSpeech && next && isPlaying) {
      stopSpeech();
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Avatar Container */}
      <div className="relative">
        {/* Glow halo when talking */}
        <div className={`absolute -inset-2 rounded-full blur-md transition-opacity duration-300 ${
          isPlaying ? 'bg-gradient-to-tr from-sky-500/40 via-emerald-500/40 to-cyan-500/40 opacity-100' : 'opacity-0'
        }`} />

        {/* Avatar SVG Portrait */}
        <div className="relative w-32 h-32 rounded-full p-1 bg-gradient-to-b from-sky-400/40 to-slate-700/80 shadow-2xl overflow-hidden flex items-center justify-center">
          <svg viewBox="0 0 160 160" className="w-full h-full rounded-full bg-slate-900">
            {/* Background gradient */}
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fed7aa" />
                <stop offset="100%" stopColor="#fdba74" />
              </linearGradient>
              <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
              <linearGradient id="blazerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#0c4a6e" />
              </linearGradient>
            </defs>

            <rect width="160" height="160" fill="url(#bgGrad)" />

            {/* Shoulders & Professional Blazer */}
            <path d="M25 160 C30 120, 60 115, 80 115 C100 115, 130 120, 135 160 Z" fill="url(#blazerGrad)" />
            {/* Inner blouse */}
            <polygon points="68,120 92,120 80,145" fill="#f8fafc" />

            {/* Neck */}
            <rect x="72" y="90" width="16" height="28" fill="url(#skinGrad)" rx="4" />

            {/* Back Hair */}
            <path d="M42 60 C38 105, 45 130, 52 140 C52 120, 48 90, 56 60 Z" fill="url(#hairGrad)" />
            <path d="M118 60 C122 105, 115 130, 108 140 C108 120, 112 90, 104 60 Z" fill="url(#hairGrad)" />

            {/* Face */}
            <ellipse cx="80" cy="74" rx="26" ry="32" fill="url(#skinGrad)" />

            {/* Front Hair Bangs */}
            <path d="M54 62 C60 40, 100 40, 106 62 C96 52, 64 52, 54 62 Z" fill="url(#hairGrad)" />
            <path d="M54 62 C50 78, 54 95, 57 100 C56 85, 58 70, 62 62 Z" fill="url(#hairGrad)" />
            <path d="M106 62 C110 78, 106 95, 103 100 C104 85, 102 70, 98 62 Z" fill="url(#hairGrad)" />

            {/* Eyes */}
            <ellipse cx="70" cy="73" rx="3.5" ry="4" fill="#1e293b" />
            <circle cx="71" cy="71.5" r="1.2" fill="#ffffff" />
            <ellipse cx="90" cy="73" rx="3.5" ry="4" fill="#1e293b" />
            <circle cx="91" cy="71.5" r="1.2" fill="#ffffff" />

            {/* Eyebrows */}
            <path d="M65 67 Q70 65 75 67" stroke="#451a03" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M85 67 Q90 65 95 67" stroke="#451a03" strokeWidth="1.6" fill="none" strokeLinecap="round" />

            {/* Subtle Blush */}
            <circle cx="64" cy="80" r="4" fill="#f43f5e" opacity="0.25" />
            <circle cx="96" cy="80" r="4" fill="#f43f5e" opacity="0.25" />

            {/* Nose */}
            <path d="M80 74 Q81 81 79 82" stroke="#ea580c" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />

            {/* Mouth */}
            {isPlaying ? (
              /* Animated talking mouth */
              <ellipse 
                cx="80" 
                cy="90" 
                rx="5.5" 
                ry="4.5" 
                fill="#be123c" 
                className="animate-talking" 
              />
            ) : (
              /* Calm, friendly closed smile */
              <path d="M74 88 Q80 92 86 88" stroke="#be123c" strokeWidth="2" fill="none" strokeLinecap="round" />
            )}

            {/* Interviewer Headset Microphone */}
            <path d="M56 68 C50 68, 48 76, 50 82" stroke="#0284c7" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="50" cy="82" r="3" fill="#0369a1" />
            <path d="M50 82 Q56 94 68 94" stroke="#0284c7" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <circle cx="68" cy="94" r="2.2" fill="#38bdf8" />
          </svg>
        </div>

        {/* Status indicator dot */}
        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
          isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
        }`}>
          {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>

      {/* Name and State description */}
      <div className="mt-2 text-center">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1.5">
          <span>Eva</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 font-semibold">
            ACTFL Examiner
          </span>
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {isPlaying ? 'Speaking question...' : 'Listening attentively'}
        </p>
      </div>

      {/* Equalizer sound wave animation while Eva talks - Fixed height reserved */}
      <div className="h-5 mt-1 flex items-center justify-center">
        {isPlaying ? (
          <div className="flex items-center gap-1 h-5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-sky-500/30 shadow-xs">
            <div className="w-1 bg-sky-500 dark:bg-sky-400 rounded-full animate-sound-wave" style={{ animationDelay: '0.1s' }} />
            <div className="w-1 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-sound-wave" style={{ animationDelay: '0.3s' }} />
            <div className="w-1 bg-sky-500 dark:bg-sky-400 rounded-full animate-sound-wave" style={{ animationDelay: '0.2s' }} />
            <div className="w-1 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-sound-wave" style={{ animationDelay: '0.4s' }} />
            <div className="w-1 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-sound-wave" style={{ animationDelay: '0.15s' }} />
          </div>
        ) : null}
      </div>

      {/* Audio controls (Replay question button) */}
      <div className="flex items-center gap-2 mt-2">
        {autoplayBlocked && !isPlaying ? (
          <button
            onClick={handleFirstPlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-sm cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Phát câu hỏi</span>
          </button>
        ) : (
        <ViTooltip vi={replayWindowSec
          ? `Thi nghiêm túc: chỉ được nghe lại 1 lần, trong ${replayWindowSec} giây sau khi Eva đọc xong.`
          : 'Nghe lại câu hỏi một lần nữa (Quy chế OPIc cho phép nghe lại 1 lần).'}>
          <button
            onClick={handleReplay}
            disabled={!canReplay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              canReplay
                ? (replayWindowSec
                    ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 cursor-pointer shadow-xs animate-pulse-subtle'
                    : 'bg-sky-50 hover:bg-sky-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/30 hover:border-sky-400 cursor-pointer shadow-xs')
                : 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{
              !replayWindowSec
                ? `Replay (${maxReplays - replayCount} left)`
                : replayCount >= maxReplays
                ? 'Đã nghe lại'
                : replayWindowLeft > 0
                ? `Nghe lại (${replayWindowLeft}s)`
                : replayWindowLeft === 0
                ? 'Hết lượt nghe lại'
                : 'Replay (1 left)'
            }</span>
          </button>
        </ViTooltip>
        )}

        <button
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer shadow-xs"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>

    </div>
  );
};
