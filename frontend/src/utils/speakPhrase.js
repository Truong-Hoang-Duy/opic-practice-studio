import { vocabularyApi, resolveMediaUrl } from '../api/client';
import { getSharedAudio, getVoices } from './audioUnlock';

let currentEndCleanup = null;

export const stopSpeaking = () => {
  if (currentEndCleanup) {
    currentEndCleanup();
    currentEndCleanup = null;
  }
  const audio = getSharedAudio();
  if (audio && !audio.paused) {
    audio.pause();
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
  }
};

// Pronunciation of a phrase, sentence, or upgraded script: Eva's server voice (cached), else browser fallback
export const speakPhrase = async (text, options = {}) => {
  const { rate = 1.0, onEnd } = options;
  if (!text || !text.trim()) return;

  stopSpeaking();

  try {
    const { data } = await vocabularyApi.speak(text.trim().slice(0, 2400));
    const audio = getSharedAudio();
    if (data?.url && audio) {
      audio.pause();
      audio.src = resolveMediaUrl(data.url);
      audio.playbackRate = rate;
      if (onEnd) {
        const handleEnded = () => {
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleEnded);
          currentEndCleanup = null;
          onEnd();
        };
        currentEndCleanup = () => {
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleEnded);
        };
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleEnded);
      }
      await audio.play();
      return;
    }
  } catch (e) {
    console.warn('Server pronunciation unavailable, using browser voice', e);
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getVoices().find(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en-us'));
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = Math.min(1.3, Math.max(0.6, rate * 0.92));
  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }
  synth.speak(utterance);
};
