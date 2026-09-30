import React, { useState, useRef, useEffect } from 'react';
import { Volume2, RotateCcw, VolumeX } from 'lucide-react';
import { ViTooltip } from './Tooltip';
import { resolveMediaUrl } from '../api/client';

// Browser voices closest to Eva (calm young American female), used when server audio is unavailable
const PREFERRED_VOICES = ['Aria', 'Jenny', 'Ava', 'Samantha', 'Google US English', 'Zira'];

const loadVoices = () => new Promise((resolve) => {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length) return resolve(voices);
  const timer = setTimeout(() => resolve(synth.getVoices()), 1000);
  synth.addEventListener('voiceschanged', () => {
    clearTimeout(timer);
    resolve(synth.getVoices());
  }, { once: true });
});

const pickEvaVoice = (voices) => {
  const english = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en-us'));
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
  maxReplays = 1
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  const src = resolveMediaUrl(audioUrl);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  // Fall back to browser speech when the server has no audio for this question or it fails to load
  const useSpeech = (!src || audioFailed) && !!text && speechSupported;

  const stopSpeech = () => {
    if (!speechSupported) return;
    utteranceRef.current = null;
    window.speechSynthesis.cancel();
  };

  const speakText = async () => {
    if (!speechSupported || !text) return;
    stopSpeech();
    const voices = await loadVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickEvaVoice(voices);
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.volume = isMuted ? 0 : 1;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      // Ignore events from utterances that were cancelled/replaced
      if (utteranceRef.current !== utterance) return;
      setIsPlaying(false);
      if (onAudioEnded) onAudioEnded();
    };
    utterance.onerror = () => {
      if (utteranceRef.current === utterance) setIsPlaying(false);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // New question: reset the failure flag
  useEffect(() => {
    setAudioFailed(false);
  }, [audioUrl]);

  useEffect(() => {
    if (!autoPlay) return;
    if (src && !audioFailed && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.warn("Autoplay blocked by browser policy; user interaction needed:", e);
      });
    } else if (useSpeech) {
      speakText();
    }
    return () => {
      stopSpeech();
      setIsPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, text, autoPlay, audioFailed]);

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

  const handleReplay = () => {
    if (replayCount >= maxReplays) return;
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
      {/* Audio element */}
      {src && !audioFailed && (
        <audio
          ref={audioRef}
          src={src}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            console.warn("Eva audio failed to load; falling back to browser speech.");
            setIsPlaying(false);
            setAudioFailed(true);
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (onAudioEnded) onAudioEnded();
          }}
        />
      )}
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
        <ViTooltip vi="Nghe lại câu hỏi một lần nữa (Quy chế OPIc cho phép nghe lại 1 lần).">
          <button
            onClick={handleReplay}
            disabled={replayCount >= maxReplays || isPlaying}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              replayCount < maxReplays && !isPlaying
                ? 'bg-sky-50 hover:bg-sky-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/30 hover:border-sky-400 cursor-pointer shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay ({maxReplays - replayCount} left)</span>
          </button>
        </ViTooltip>

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
