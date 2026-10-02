import { vocabularyApi, resolveMediaUrl } from '../api/client';
import { getSharedAudio, getVoices } from './audioUnlock';

// Pronunciation of a saved phrase / example: Eva's server voice (cached), else the browser's English voice
export const speakPhrase = async (text) => {
  if (!text) return;
  try {
    const { data } = await vocabularyApi.speak(text);
    const audio = getSharedAudio();
    if (data?.url && audio) {
      audio.pause();
      audio.src = resolveMediaUrl(data.url);
      await audio.play();
      return;
    }
  } catch (e) {
    console.warn('Server pronunciation unavailable, using browser voice', e);
  }
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getVoices().find(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en-us'));
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  synth.speak(utterance);
};
