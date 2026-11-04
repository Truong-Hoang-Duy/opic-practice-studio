import { useState, useEffect } from 'react';
import { vocabularyApi, resolveMediaUrl } from '../api/client';
import { getSharedAudio, getVoices, endRecordingAudioSession } from './audioUnlock';

let currentEndCleanup = null;
let activePlayId = 0;

// Global reactive state so every listen button across the app knows when it is loading or playing
let speakingState = {
  id: null,
  text: null,
  status: 'idle', // 'idle' | 'loading' | 'playing'
};

const listeners = new Set();

const setSpeakingState = (next) => {
  speakingState = next;
  listeners.forEach((fn) => {
    try {
      fn(speakingState);
    } catch (e) {
      // Ignore listener errors
    }
  });
};

export const getSpeakingState = () => speakingState;

export const useSpeakingState = () => {
  const [state, setState] = useState(speakingState);
  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);
  return state;
};

export const stopSpeaking = () => {
  activePlayId += 1;
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
  if (speakingState.status !== 'idle') {
    setSpeakingState({ id: null, text: null, status: 'idle' });
  }
};

// Pronunciation of a phrase, sentence, question, or upgraded script: Eva's server voice (cached), else browser fallback.
// Calling speakPhrase with the same item while it is already loading/playing stops playback (toggle behavior).
export const speakPhrase = async (text, options = {}) => {
  const { rate = 1.0, onEnd, id = null, audioUrl = null } = options;
  const cleanText = (text || '').trim();
  if (!cleanText && !audioUrl) return;

  const targetId = id || cleanText || audioUrl;

  // Toggle off if the user clicked the same button that is currently active
  if (
    speakingState.status !== 'idle' &&
    ((id && speakingState.id === id) || (!id && speakingState.text === cleanText))
  ) {
    stopSpeaking();
    if (onEnd) onEnd();
    return;
  }

  stopSpeaking();
  const myPlayId = ++activePlayId;
  setSpeakingState({ id: targetId, text: cleanText, status: 'loading' });

  const finish = () => {
    if (myPlayId === activePlayId) {
      setSpeakingState({ id: null, text: null, status: 'idle' });
    }
    if (onEnd) onEnd();
  };

  try {
    let mediaUrl = audioUrl ? resolveMediaUrl(audioUrl) : null;
    if (!mediaUrl && cleanText) {
      const { data } = await vocabularyApi.speak(cleanText.slice(0, 2400));
      if (myPlayId !== activePlayId) return;
      if (data?.url) {
        mediaUrl = resolveMediaUrl(data.url);
      }
    }

    const audio = getSharedAudio();
    if (mediaUrl && audio) {
      if (myPlayId !== activePlayId) return;
      endRecordingAudioSession();
      audio.pause();
      audio.muted = false;
      audio.src = mediaUrl;
      audio.playbackRate = rate;

      const handlePlaying = () => {
        if (myPlayId === activePlayId) {
          setSpeakingState({ id: targetId, text: cleanText, status: 'playing' });
        }
      };
      const handleEnded = () => {
        cleanupListeners();
        currentEndCleanup = null;
        finish();
      };
      const cleanupListeners = () => {
        audio.removeEventListener('playing', handlePlaying);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handleEnded);
        audio.removeEventListener('error', handleEnded);
      };

      currentEndCleanup = cleanupListeners;
      audio.addEventListener('playing', handlePlaying);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('pause', handleEnded);
      audio.addEventListener('error', handleEnded);

      setSpeakingState({ id: targetId, text: cleanText, status: 'playing' });
      await audio.play();
      return;
    }
  } catch (e) {
    if (myPlayId !== activePlayId) return;
    console.warn('Server pronunciation unavailable, using browser voice', e);
  }

  if (myPlayId !== activePlayId) return;

  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !cleanText) {
    finish();
    return;
  }
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voice = getVoices().find((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en-us'));
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = Math.min(1.3, Math.max(0.6, rate * 0.92));
  utterance.onstart = () => {
    if (myPlayId === activePlayId) {
      setSpeakingState({ id: targetId, text: cleanText, status: 'playing' });
    }
  };
  utterance.onend = () => finish();
  utterance.onerror = () => finish();
  setSpeakingState({ id: targetId, text: cleanText, status: 'playing' });
  synth.speak(utterance);
};
