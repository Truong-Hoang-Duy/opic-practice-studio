// Safari only lets audio/speech start from a user gesture, and the permission is granted per <audio> element.
// We therefore reuse ONE shared <audio> element for Eva and "unlock" it (plus speechSynthesis) on the
// learner's first click/tap/keypress, so later questions can autoplay without another click.

// ~10ms of silence (8kHz, 8-bit mono WAV)
const SILENT_WAV = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
// Only events WebKit treats as a user gesture for media: on iOS, pointerdown/touchstart are NOT, so a
// play() started there is rejected
const GESTURE_EVENTS = ['touchend', 'click', 'keydown'];

let sharedAudio = null;
let audioUnlocked = false;
let priming = false;
// A question whose autoplay Safari blocked; it starts on the learner's next tap anywhere on the page
let pendingPlayback = null;
let speechUnlocked = false;
let cachedVoices = [];
let beepContext = null;

// One Web Audio context for the OPIc-style "beep" that follows each question (Safari also needs it unlocked)
const getBeepContext = () => {
  if (!beepContext && typeof window !== 'undefined') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) beepContext = new Ctx();
  }
  return beepContext;
};

// Short 1 kHz tone, like the real OPIc signal that it is the test taker's turn to speak
export const playBeep = () => {
  const ctx = getBeepContext();
  if (!ctx) return;
  const start = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    // Quick fade in/out so the tone doesn't click
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

export const getSharedAudio = () => {
  if (!sharedAudio && typeof Audio !== 'undefined') {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
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
          audio.removeAttribute('src');
          audio.load();
        }
      });
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
  // Listeners stay installed: a later question can still be blocked (e.g. after the tab was backgrounded)
};

export const installAudioUnlock = () => {
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) {
    getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      cachedVoices = window.speechSynthesis.getVoices();
    });
  }
  GESTURE_EVENTS.forEach(evt => window.addEventListener(evt, unlockOnGesture, true));
};
