import React, { useState, useRef, useEffect } from 'react';
import { Volume2, RotateCcw, VolumeX } from 'lucide-react';
import { ViTooltip } from './Tooltip';
import { resolveMediaUrl, vocabularyApi } from '../api/client';
import { getSharedAudio, getVoices, playBeep, endRecordingAudioSession, setPendingPlayback, clearPendingPlayback } from '../utils/audioUnlock';
import { useLanguage } from '../context/LanguageContext';

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
  onSecondReadEnded, // called right after the 2nd reading (replay) + beep finishes so the recorder can auto-start
  onPlayingChange, // (isPlaying) => void: lets the page pause its own timers while Eva speaks
  allowReplay = true,
  maxReplays = 1,
  // Strict exam: replay is only possible within this many seconds after Eva finishes reading
  replayWindowSec = null,
  // 'responsive' (horizontal on mobile, large vertical portrait on desktop) | 'horizontal' (sleek compact bar on all viewports)
  layout = 'responsive',
}) => {
  const { pick } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [onDemandUrl, setOnDemandUrl] = useState(null);
  const [onDemandFailed, setOnDemandFailed] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [replayWindowLeft, setReplayWindowLeft] = useState(null); // null = not opened yet, 0 = expired
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const speechWatchdogRef = useRef(null);
  const isReplayingRef = useRef(false);
  const autoRecordTimerRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(autoRecordTimerRef.current);
  }, [audioUrl, text]);

  const handlePlaybackEnded = () => {
    setIsPlaying(false);
    const wasReplay = isReplayingRef.current;
    if (replayWindowSec && !wasReplay && replayCount < maxReplays) {
      setReplayWindowLeft(replayWindowSec);
    }
    isReplayingRef.current = false;
    if (onAudioEnded) onAudioEnded({ isReplay: wasReplay });
    // Only play the beep signal after the 2nd reading (replay) right before transitioning into recording mode
    if (wasReplay && onSecondReadEnded) {
      if (!isMuted) playBeep();
      clearTimeout(autoRecordTimerRef.current);
      // Wait 500ms so the 0.45s OPIc beep finishes before switching the mic audio session on
      autoRecordTimerRef.current = setTimeout(() => {
        onSecondReadEnded();
      }, 500);
    }
  };
  // The shared <audio> listeners are attached once per question; route them to the latest handler
  const playbackEndedRef = useRef(handlePlaybackEnded);
  playbackEndedRef.current = handlePlaybackEnded;

  const playingChangeRef = useRef(onPlayingChange);
  playingChangeRef.current = onPlayingChange;
  useEffect(() => {
    if (playingChangeRef.current) playingChangeRef.current(isPlaying);
  }, [isPlaying]);

  // Count down the replay window; once it hits 0 the replay is lost
  useEffect(() => {
    if (!replayWindowLeft) return;
    const timer = setTimeout(() => setReplayWindowLeft(left => Math.max(0, left - 1)), 1000);
    return () => clearTimeout(timer);
  }, [replayWindowLeft]);

  const src = resolveMediaUrl(audioUrl || onDemandUrl);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  // Fall back to browser speech only when server MP3 audio is unavailable or fails to load
  const useSpeech = ((audioFailed || onDemandFailed) || (!src && !text)) && !!text && speechSupported;

  // If a question does not yet have a pre-cached audioUrl, synthesize its MP3 on demand so iOS plays
  // through the HTML5 <audio> Media channel (audible even when the iPhone Silent switch is on).
  useEffect(() => {
    setAudioFailed(false);
    setOnDemandUrl(null);
    setOnDemandFailed(false);
    if (audioUrl || !text || !text.trim()) return undefined;
    let cancelled = false;
    vocabularyApi
      .speak(text.trim().slice(0, 2400))
      .then((res) => {
        if (cancelled) return;
        if (res.data?.url) {
          setOnDemandUrl(res.data.url);
        } else {
          setOnDemandFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setOnDemandFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl, text]);

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
    endRecordingAudioSession();
    audio.pause();
    audio.muted = isMuted;
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

  // Safari blocked autoplay: start the question on the learner's next tap anywhere, not only on the button
  const firstPlayRef = useRef(handleFirstPlay);
  firstPlayRef.current = handleFirstPlay;
  useEffect(() => {
    if (!autoplayBlocked) return;
    const play = () => firstPlayRef.current();
    setPendingPlayback(play);
    return () => clearPendingPlayback(play);
  }, [autoplayBlocked]);

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

  const isAlwaysHorizontal = layout === 'horizontal';

  return (
    <div
      className={`w-full flex flex-row items-center justify-between gap-2.5 ${
        isAlwaysHorizontal ? '' : 'lg:flex-col lg:justify-center lg:gap-0'
      }`}
    >
      {/* Avatar + Name/Status */}
      <div
        className={`flex flex-row items-center gap-2.5 sm:gap-3 min-w-0 ${
          isAlwaysHorizontal ? '' : 'lg:flex-col lg:gap-0'
        }`}
      >
        {/* Avatar Container */}
        <div className="relative shrink-0">
          {/* Glow halo when talking */}
          <div
            className={`absolute -inset-1.5 ${isAlwaysHorizontal ? '' : 'lg:-inset-2'} rounded-full blur-md transition-opacity duration-300 ${
              isPlaying ? 'bg-gradient-to-tr from-sky-500/40 via-emerald-500/40 to-cyan-500/40 opacity-100' : 'opacity-0'
            }`}
          />

          {/* Avatar SVG Portrait */}
          <div
            className={`relative rounded-full p-0.5 bg-gradient-to-b from-sky-400/40 to-slate-700/80 shadow-lg overflow-hidden flex items-center justify-center ${
              isAlwaysHorizontal
                ? 'w-14 h-14 lg:w-16 lg:h-16'
                : 'w-14 h-14 lg:w-32 lg:h-32 lg:p-1 lg:shadow-2xl'
            }`}
          >
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
          <div
            className={`absolute bottom-0 right-0 ${isAlwaysHorizontal ? '' : 'lg:bottom-1 lg:right-1 lg:w-4 lg:h-4'} w-3.5 h-3.5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
              isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          >
            {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </div>

        {/* Name and State description */}
        <div className={`text-left min-w-0 ${isAlwaysHorizontal ? '' : 'lg:mt-2 lg:text-center'}`}>
          <h3 className={`text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 ${isAlwaysHorizontal ? '' : 'lg:justify-center'}`}>
            <span>Eva</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-semibold whitespace-nowrap">
              <span className="sm:hidden">AI</span>
              <span className="hidden sm:inline">ACTFL Examiner</span>
            </span>
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] lg:text-xs text-slate-600 dark:text-slate-400 font-medium truncate">
              {isPlaying
                ? replayCount > 0
                  ? pick('Đang đọc lần 2...', 'Replaying...')
                  : pick('Đang đọc câu hỏi...', 'Speaking...')
                : pick('Đang lắng nghe', 'Listening')}
            </p>
            {isAlwaysHorizontal && isPlaying && (
              <div className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-sky-500/30 overflow-hidden shrink-0">
                <div className="w-[2px] h-3 bg-sky-500 dark:bg-sky-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.1s' }} />
                <div className="w-[2px] h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.3s' }} />
                <div className="w-[2px] h-3 bg-sky-500 dark:bg-sky-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.2s' }} />
                <div className="w-[2px] h-3 bg-cyan-500 dark:bg-cyan-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.4s' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Equalizer sound wave (Responsive vertical mode only) */}
      {!isAlwaysHorizontal && (
        <div className={`${isPlaying ? 'flex' : 'hidden lg:flex'} h-5 lg:mt-1 items-center justify-center shrink-0`}>
          {isPlaying ? (
            <div className="flex items-center gap-1 h-5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-sky-500/30 shadow-xs overflow-hidden">
              <div className="w-1 h-3.5 bg-sky-500 dark:bg-sky-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.1s' }} />
              <div className="w-1 h-3.5 bg-emerald-500 dark:bg-emerald-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.3s' }} />
              <div className="w-1 h-3.5 bg-sky-500 dark:bg-sky-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.2s' }} />
              <div className="w-1 h-3.5 bg-cyan-500 dark:bg-cyan-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.4s' }} />
              <div className="w-1 h-3.5 bg-emerald-500 dark:bg-emerald-400 rounded-full origin-center animate-sound-wave" style={{ animationDelay: '0.15s' }} />
            </div>
          ) : null}
        </div>
      )}

      {/* Audio controls (Replay question button + Mute) */}
      <div className={`flex items-center gap-1.5 shrink-0 ${isAlwaysHorizontal ? '' : 'lg:gap-2 lg:mt-2'}`}>
        {autoplayBlocked && !isPlaying ? (
          <button
            onClick={handleFirstPlay}
            data-eva-play
            className="h-8 min-w-[96px] inline-flex items-center justify-center gap-1.5 px-2.5 lg:px-3 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>{pick('Phát', 'Play')}</span>
          </button>
        ) : (
        <ViTooltip vi={replayWindowSec
          ? pick(
              `Thi nghiêm túc: chỉ được nghe lại 1 lần, trong ${replayWindowSec} giây sau khi Eva đọc xong.`,
              `Real Exam: 1 replay allowed within ${replayWindowSec}s after Eva finishes.`
            )
          : pick(
              'Nghe lại câu hỏi một lần nữa (Quy chế OPIc cho phép nghe lại 1 lần).',
              'Replay the question once (OPIc allows 1 replay).'
            )}>
          <button
            onClick={handleReplay}
            disabled={!canReplay}
            className={`h-8 min-w-[104px] inline-flex items-center justify-center gap-1.5 px-2.5 lg:px-3 rounded-lg text-[11px] lg:text-xs font-semibold border transition-colors whitespace-nowrap ${
              canReplay
                ? (replayWindowSec
                    ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 cursor-pointer shadow-xs animate-pulse-subtle'
                    : 'bg-sky-50 hover:bg-sky-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/30 hover:border-sky-400 cursor-pointer shadow-xs')
                : 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>{
              !replayWindowSec
                ? `${pick('Nghe lại', 'Replay')} (${maxReplays - replayCount})`
                : replayCount >= maxReplays
                ? pick('Đã nghe lại', 'Replayed')
                : replayWindowLeft > 0
                ? `${pick('Nghe lại', 'Replay')} (${replayWindowLeft}s)`
                : replayWindowLeft === 0
                ? pick('Hết lượt', 'Expired')
                : `${pick('Nghe lại', 'Replay')} (1)`
            }</span>
          </button>
        </ViTooltip>
        )}

        <button
          onClick={toggleMute}
          title={isMuted ? pick('Bật tiếng', 'Unmute') : pick('Tắt tiếng', 'Mute')}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
