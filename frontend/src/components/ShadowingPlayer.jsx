import React, { useState, useRef, useEffect } from 'react';
import { Play, Volume2, Loader2, Square, Languages } from 'lucide-react';
import { resolveMediaUrl } from '../api/client';
import { speakPhrase, stopSpeaking } from '../utils/speakPhrase';
import { SoundWaveMini } from './SpeakButton';
import { TranslatableText } from './TranslatableText';
import { useLanguage } from '../context/LanguageContext';

export const ShadowingPlayer = ({ modelAnswer }) => {
  const { isVi, pick } = useLanguage();
  if (!modelAnswer) return null;

  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(null);
  const [playingSentenceIdx, setPlayingSentenceIdx] = useState(null);
  const [showVi, setShowVi] = useState(false);

  const audioRef = useRef(null);

  const sentences =
    modelAnswer.sentences && modelAnswer.sentences.length > 0
      ? modelAnswer.sentences
      : (modelAnswer.text || '').split(/(?<=[.?!])\s+/).filter(Boolean);
  const sentencesVi = Array.isArray(modelAnswer.sentences_vi) ? modelAnswer.sentences_vi : [];

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

  const levelBadgeCls =
    modelAnswer.level === 'IH'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40'
      : modelAnswer.level === 'IM'
        ? 'bg-indigo-500/15 text-indigo-700 dark:text-sky-300 border-indigo-300/60 dark:border-sky-500/35'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40';

  return (
    <div className="w-full lg:flex-1 lg:min-h-0 glass-panel rounded-2xl overflow-hidden flex flex-col">
      {modelAnswer.audio_path && (
        <audio
          ref={audioRef}
          src={resolveMediaUrl(modelAnswer.audio_path)}
          onPlay={() => setIsPlayingAll(true)}
          onPause={() => setIsPlayingAll(false)}
          onEnded={() => setIsPlayingAll(false)}
        />
      )}

      {/* Compact Pinned Header */}
      <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border shrink-0 ${levelBadgeCls}`}>
              {pick(`Bài mẫu ${modelAnswer.level}`, `${modelAnswer.level} Model`)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate">
              {pick(`Shadowing · ${sentences.length} câu`, `Shadowing · ${sentences.length} sentences`)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-[#0b1120] rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-[11px]">
              {[0.7, 0.85, 1.0, 1.2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSpeedChange(s)}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    playbackSpeed === s
                      ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {isVi && (
              <button
                type="button"
                onClick={() => setShowVi((v) => !v)}
                className={`h-7 inline-flex items-center justify-center px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                  showVi
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                }`}
              >
                <span className="inline-grid items-center justify-items-center">
                  <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showVi ? 'visible' : 'invisible pointer-events-none'}`}>
                    <Languages className="w-3 h-3 shrink-0" />
                    <span>Dịch</span>
                  </span>
                  <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showVi ? 'visible' : 'invisible pointer-events-none'}`}>
                    <Languages className="w-3 h-3 shrink-0" />
                    <span>Ẩn dịch</span>
                  </span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={togglePlayAll}
              disabled={loadingAudio}
              className={`h-7 inline-flex items-center justify-center px-3 rounded-lg font-extrabold text-[11px] transition-colors cursor-pointer disabled:opacity-60 shrink-0 ${
                isPlayingAll ? 'btn-speak-gradient' : 'btn-brand-gradient'
              }`}
            >
              <span className="inline-grid items-center justify-items-center">
                <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap ${!loadingAudio && !isPlayingAll ? 'visible' : 'invisible pointer-events-none'}`}>
                  <Play className="w-3 h-3 fill-current shrink-0" />
                  <span>{pick('Nghe hết', 'Play all')}</span>
                </span>
                <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap ${!loadingAudio && isPlayingAll ? 'visible' : 'invisible pointer-events-none'}`}>
                  <SoundWaveMini light />
                  <span>{pick('Dừng', 'Stop')}</span>
                  <Square className="w-2.5 h-2.5 fill-current opacity-85 shrink-0" />
                </span>
                <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap ${loadingAudio ? 'visible' : 'invisible pointer-events-none'}`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{pick('Đang tải', 'Loading')}</span>
                </span>
              </span>
            </button>
          </div>
        </div>

        {modelAnswer.rationale && (
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
            {modelAnswer.rationale}
          </p>
        )}
      </div>

      {/* Compact Numbered Sentences (Scrolls independently only when needed) */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
        {sentences.map((sent, idx) => {
          const isActive = activeSentenceIndex === idx;
          const isSpeakingThis = playingSentenceIdx === idx;
          return (
            <div
              key={idx}
              className={`px-4 py-2.5 flex items-start gap-3 transition-colors ${
                isSpeakingThis || isActive
                  ? 'bg-indigo-50/75 dark:bg-sky-500/10'
                  : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-extrabold mt-0.5 shrink-0 ${
                  isSpeakingThis || isActive
                    ? 'bg-gradient-to-br from-indigo-600 to-sky-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>

              <div className="flex-1 min-w-0">
                <TranslatableText
                  text={sent}
                  preTranslatedVi={sentencesVi[idx] || null}
                  showControls={false}
                  externalShowTranslation={showVi}
                  className="text-[13.5px] sm:text-sm leading-relaxed text-slate-800 dark:text-slate-100 font-medium"
                />
              </div>

              <button
                type="button"
                onClick={() => playSingleSentence(idx)}
                title={isSpeakingThis ? 'Đang phát - bấm để dừng' : 'Nghe câu này'}
                aria-label="Nghe câu này"
                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
                  isSpeakingThis
                    ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-xs'
                    : 'bg-white dark:bg-slate-800/90 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-sky-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                }`}
              >
                {isSpeakingThis ? <SoundWaveMini light /> : <Volume2 className="w-4 h-4 shrink-0" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
