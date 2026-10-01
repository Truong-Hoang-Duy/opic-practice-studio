// Safari only lets audio/speech start from a user gesture, and the permission is granted per <audio> element.
// We therefore reuse ONE shared <audio> element for Eva and "unlock" it (plus speechSynthesis) on the
// learner's first click/tap/keypress, so later questions can autoplay without another click.

// ~10ms of silence (8kHz, 8-bit mono WAV)
const SILENT_WAV = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown'];

let sharedAudio = null;
let audioUnlocked = false;
let speechUnlocked = false;
let cachedVoices = [];

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

const unlockOnGesture = () => {
  const audio = getSharedAudio();
  // Only prime the element when it is idle, so we never replace a question that is waiting to play
  if (!audioUnlocked && audio && audio.paused && !audio.getAttribute('src')) {
    audio.src = SILENT_WAV;
    audio.play()
      .then(() => { audioUnlocked = true; })
      .catch(() => {})
      .finally(() => {
        if (audio.src === SILENT_WAV) {
          audio.removeAttribute('src');
          audio.load();
        }
      });
  }

  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  if (!speechUnlocked && synth && !synth.speaking && !synth.pending) {
    const primer = new SpeechSynthesisUtterance(' ');
    primer.volume = 0;
    synth.speak(primer);
    speechUnlocked = true;
  }

  if ((audioUnlocked || !audio) && (speechUnlocked || !synth)) {
    GESTURE_EVENTS.forEach(evt => window.removeEventListener(evt, unlockOnGesture, true));
  }
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
