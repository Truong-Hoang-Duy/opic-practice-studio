// Safari only lets audio/speech start from a user gesture, and the permission is granted per <audio> element.
// We therefore reuse ONE shared <audio> element for Eva and ONE <audio> element for the OPIc beep,
// unlocking both on the learner's first click/tap/keypress so all audio plays through the iOS Media
// channel (same as YouTube, audible even when the iPhone hardware Ring/Silent switch is on Silent).

// ~10ms of silence (8kHz, 8-bit mono WAV)
const SILENT_WAV = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

// Build a 0.42s 1kHz sine-wave WAV data URI once so the OPIc beep plays through an HTML5 <audio>
// element (Media volume channel, ignores the iPhone Silent switch just like YouTube).
const buildBeepWav = () => {
  if (typeof btoa === 'undefined') return SILENT_WAV;
  const sampleRate = 8000;
  const duration = 0.42;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Uint8Array(44 + numSamples);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
  };
  const writeU32 = (offset, val) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
    buffer[offset + 2] = (val >> 16) & 0xff;
    buffer[offset + 3] = (val >> 24) & 0xff;
  };
  const writeU16 = (offset, val) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
  };

  writeStr(0, 'RIFF');
  writeU32(4, 36 + numSamples);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  writeU32(16, 16);
  writeU16(20, 1); // PCM
  writeU16(22, 1); // mono
  writeU32(24, sampleRate);
  writeU32(28, sampleRate);
  writeU16(32, 1);
  writeU16(34, 8); // 8-bit unsigned
  writeStr(36, 'data');
  writeU32(40, numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Smooth 20ms fade-in and 40ms fade-out
    let env = 0.25;
    if (t < 0.02) env = 0.25 * (t / 0.02);
    else if (t > duration - 0.04) env = 0.25 * Math.max(0, (duration - t) / 0.04);
    const sample = Math.sin(2 * Math.PI * 1000 * t) * env;
    buffer[44 + i] = Math.max(0, Math.min(255, Math.round(128 + sample * 127)));
  }

  let binary = '';
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
};

const BEEP_WAV = buildBeepWav();

// Only events WebKit treats as a user gesture for media: on iOS, pointerdown/touchstart are NOT, so a
// play() started there is rejected
const GESTURE_EVENTS = ['touchend', 'click', 'keydown'];

let sharedAudio = null;
let beepAudio = null;
let audioUnlocked = false;
let beepUnlocked = false;
let priming = false;
let isRecordingSession = false;
// A question whose autoplay Safari blocked; it starts on the learner's next tap anywhere on the page
let pendingPlayback = null;
let speechUnlocked = false;
let cachedVoices = [];
let beepContext = null;

export const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

// iOS treats Web Audio and speechSynthesis as "ambient" sound, which the Ring/Silent switch mutes,
// while HTML5 <audio> and AudioSession "playback" behave like YouTube and play through Media volume.
const setAudioSessionType = (type) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = type;
    }
  } catch (e) {}
};
export const beginRecordingAudioSession = () => {
  isRecordingSession = true;
  setAudioSessionType('play-and-record');
};
export const endRecordingAudioSession = () => {
  isRecordingSession = false;
  setAudioSessionType('playback');
};

const getBeepAudio = () => {
  if (!beepAudio && typeof Audio !== 'undefined') {
    // Prime with silence first so gesture unlocking can never accidentally emit a audible tone
    beepAudio = new Audio(SILENT_WAV);
    beepAudio.preload = 'auto';
    beepAudio.playsInline = true;
  }
  return beepAudio;
};

// Web Audio fallback for desktop if HTML5 beep audio isn't unlocked yet
const getBeepContext = () => {
  if (!beepContext && typeof window !== 'undefined') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) beepContext = new Ctx();
  }
  return beepContext;
};

const playOscillatorBeep = () => {
  const ctx = getBeepContext();
  if (!ctx) return;
  const start = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.setValueAtTime(0.25, now + 0.38);
    gain.gain.linearRampToValueAtTime(0, now + 0.42);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  };
  if (ctx.state === 'suspended') ctx.resume().then(start).catch(() => {});
  else start();
};

// Short 1 kHz tone on the Media channel, used ONLY right after the 2nd question reading before recording starts
export const playBeep = () => {
  if (!isRecordingSession) setAudioSessionType('playback');
  const audio = getBeepAudio();
  if (audio) {
    try {
      if (audio.src !== BEEP_WAV) {
        audio.src = BEEP_WAV;
      }
      audio.muted = false;
      audio.volume = 1;
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => playOscillatorBeep());
      }
      return;
    } catch (e) {
      // Fall through to oscillator
    }
  }
  playOscillatorBeep();
};

export const getSharedAudio = () => {
  if (!sharedAudio && typeof Audio !== 'undefined') {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
    sharedAudio.playsInline = true;
    // Ensure iOS routes through the Media playback channel (ignores hardware Silent switch)
    sharedAudio.addEventListener('play', () => {
      if (!isRecordingSession) setAudioSessionType('playback');
    });
    // Any successful playback means Safari has granted this element permission
    sharedAudio.addEventListener('playing', () => { audioUnlocked = true; });
  }
  return sharedAudio;
};

// Safari often returns [] from getVoices() on the first call; keep a cache that fills in when voices load
export const getVoices = () => {
  if (!cachedVoices.length && 'speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices;
};

export const setPendingPlayback = (fn) => { pendingPlayback = fn; };
export const clearPendingPlayback = (fn) => { if (pendingPlayback === fn) pendingPlayback = null; };

const unlockOnGesture = (event) => {
  if (!isRecordingSession) setAudioSessionType('playback');

  // Still inside the gesture: start the blocked question now (its own play button handles itself)
  if (pendingPlayback && !event.target?.closest?.('[data-eva-play]')) {
    const play = pendingPlayback;
    pendingPlayback = null;
    play();
  }

  const audio = getSharedAudio();
  // Only prime the element when it is idle, so we never replace a question that is waiting to play
  if (!audioUnlocked && !priming && audio && audio.paused && !audio.getAttribute('src')) {
    priming = true;
    audio.src = SILENT_WAV;
    audio.play()
      .then(() => { audioUnlocked = true; })
      .catch(() => {})
      .finally(() => {
        priming = false;
        if (audio.src === SILENT_WAV) {
          audio.pause();
          audio.removeAttribute('src');
        }
      });
  }

  // Unlock the HTML5 beep element using SILENT_WAV so it never makes noise on random taps
  const bAudio = getBeepAudio();
  if (!beepUnlocked && bAudio && bAudio.paused) {
    bAudio.src = SILENT_WAV;
    bAudio.play()
      .then(() => {
        bAudio.pause();
        bAudio.currentTime = 0;
        beepUnlocked = true;
      })
      .catch(() => {});
  }

  const ctx = getBeepContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  if (!speechUnlocked && synth && !synth.speaking && !synth.pending) {
    const primer = new SpeechSynthesisUtterance(' ');
    primer.volume = 0;
    synth.speak(primer);
    speechUnlocked = true;
  }
};

export const installAudioUnlock = () => {
  if (typeof window === 'undefined') return;
  setAudioSessionType('playback');
  if ('speechSynthesis' in window) {
    getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      cachedVoices = window.speechSynthesis.getVoices();
    });
  }
  GESTURE_EVENTS.forEach(evt => window.addEventListener(evt, unlockOnGesture, true));
};
