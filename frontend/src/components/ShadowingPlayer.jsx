import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { resolveMediaUrl } from '../api/client';
import { speakPhrase, stopSpeaking } from '../utils/speakPhrase';

export const ShadowingPlayer = ({
  modelAnswer,
}) => {
  if (!modelAnswer) return null;

  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(null);
  const [playingSentenceIdx, setPlayingSentenceIdx] = useState(null);

  const audioRef = useRef(null);

  const sentences = modelAnswer.sentences && modelAnswer.sentences.length > 0
    ? modelAnswer.sentences
    : (modelAnswer.text || '').split(/(?<=[.?!])\s+/).filter(Boolean);

  useEffect(() => {
    stopSpeaking();
    setIsPlayingAll(false);
    setPlayingSentenceIdx(null);
    setActiveSentenceIndex(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    return () => {
      stopSpeaking();
    };
  }, [modelAnswer?.level, modelAnswer?.text]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlayAll = async () => {
    setPlayingSentenceIdx(null);
    if (isPlayingAll) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      stopSpeaking();
      setIsPlayingAll(false);
      return;
    }

    if (modelAnswer.audio_path && audioRef.current) {
      try {
        stopSpeaking();
        audioRef.current.playbackRate = playbackSpeed;
        await audioRef.current.play();
        setIsPlayingAll(true);
        return;
      } catch (e) {
        console.warn('Direct audio element failed, falling back to on-demand TTS:', e);
      }
    }

    setLoadingAudio(true);
    setIsPlayingAll(true);
    try {
      await speakPhrase(modelAnswer.text, {
        rate: playbackSpeed,
        onEnd: () => setIsPlayingAll(false),
      });
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const playSingleSentence = async (index) => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    setIsPlayingAll(false);
    setActiveSentenceIndex(index);

    if (playingSentenceIdx === index) {
      stopSpeaking();
      setPlayingSentenceIdx(null);
      return;
    }

    setPlayingSentenceIdx(index);
    await speakPhrase(sentences[index], {
      rate: playbackSpeed,
      onEnd: () => setPlayingSentenceIdx(null),
    });
  };

  return (
    <div className="w-full glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
      {modelAnswer.audio_path && (
        <audio
          ref={audioRef}
          src={resolveMediaUrl(modelAnswer.audio_path)}
          onPlay={() => setIsPlayingAll(true)}
          onPause={() => setIsPlayingAll(false)}
          onEnded={() => setIsPlayingAll(false)}
        />
      )}

      {/* Header with Level & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase border ${
              modelAnswer.level === 'IH'
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                : modelAnswer.level === 'IM'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
                : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
            }`}>
              Bài mẫu Mức {modelAnswer.level}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Luyện nghe & nhại lại từng câu (Shadowing)
            </span>
          </div>
          {modelAnswer.rationale && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              💡 {modelAnswer.rationale}
            </p>
          )}
        </div>

        {/* Playback Controls & Speed Selectors */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
            {[0.7, 0.85, 1.0, 1.2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                  playbackSpeed === s
                    ? 'bg-brand-500 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={togglePlayAll}
            disabled={loadingAudio}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-60"
          >
            {loadingAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPlayingAll ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isPlayingAll ? 'Dừng' : 'Nghe cả bài'}</span>
          </button>
        </div>
      </div>

      {/* Sentence-by-sentence Shadowing List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">Luyện nói từng câu ({sentences.length} câu):</span>
          <span>Chạm vào từng câu để nghe Eva đọc & nói nhại theo</span>
        </div>

        {sentences.map((sent, idx) => {
          const isActive = activeSentenceIndex === idx;
          const isSpeakingThis = playingSentenceIdx === idx;
          return (
            <div
              key={idx}
              onClick={() => playSingleSentence(idx)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-300 dark:border-brand-500/40 text-brand-900 dark:text-white shadow-xs font-medium'
                  : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                  isActive
                    ? 'bg-brand-500 text-white font-bold'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-semibold'
                }`}>
                  #{idx + 1}
                </span>
                <p className="text-sm leading-relaxed">{sent}</p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playSingleSentence(idx);
                }}
                title="Nghe câu này"
                className={`p-2 rounded-lg border transition-colors shrink-0 ${
                  isSpeakingThis
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Volume2 className={`w-4 h-4 ${isSpeakingThis ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
