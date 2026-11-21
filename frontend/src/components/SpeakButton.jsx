import React, { useEffect } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { speakPhrase, prefetchPhrase, useSpeakingState } from '../utils/speakPhrase';

// Animated 4-bar equalizer sound wave (fixed 16x16 box, GPU scaleY only — ZERO layout shift)
export const SoundWaveMini = ({ light = false }) => (
  <span className="inline-flex items-center justify-center gap-[2px] w-4 h-4 shrink-0 overflow-hidden" aria-hidden="true">
    <span
      className={`w-[2px] h-3.5 rounded-full origin-center animate-sound-wave ${light ? 'bg-white' : 'bg-sky-500 dark:bg-sky-400'}`}
      style={{ animationDelay: '0.05s' }}
    />
    <span
      className={`w-[2px] h-3.5 rounded-full origin-center animate-sound-wave ${light ? 'bg-emerald-200' : 'bg-emerald-500 dark:bg-emerald-400'}`}
      style={{ animationDelay: '0.25s' }}
    />
    <span
      className={`w-[2px] h-3.5 rounded-full origin-center animate-sound-wave ${light ? 'bg-white' : 'bg-sky-500 dark:bg-sky-400'}`}
      style={{ animationDelay: '0.15s' }}
    />
    <span
      className={`w-[2px] h-3.5 rounded-full origin-center animate-sound-wave ${light ? 'bg-emerald-200' : 'bg-emerald-500 dark:bg-emerald-400'}`}
      style={{ animationDelay: '0.35s' }}
    />
  </span>
);

export const SpeakButton = ({
  text,
  audioUrl = null,
  id = null,
  rate = 1.0,
  label = 'Nghe',
  playingLabel = 'Đang phát · Dừng',
  loadingLabel = 'Đang tải...',
  variant = 'default', // 'default' | 'question' | 'chip' | 'icon'
  title = 'Bấm để nghe phát âm',
  className = '',
  onClick,
}) => {
  const speaking = useSpeakingState();
  const cleanText = (text || '').trim();
  const targetId = id || cleanText || audioUrl;
  const isThisActive =
    speaking.status !== 'idle' &&
    ((id && speaking.id === id) || (!id && speaking.id === targetId));
  const isLoading = isThisActive && speaking.status === 'loading';
  const isPlaying = isThisActive && speaking.status === 'playing';

  useEffect(() => {
    if (!audioUrl && cleanText && cleanText.length <= 300) {
      prefetchPhrase(cleanText);
    }
  }, [audioUrl, cleanText]);

  const handleClick = (e) => {
    if (onClick) onClick(e);
    e.stopPropagation();
    speakPhrase(cleanText, { id: targetId, rate, audioUrl });
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={isPlaying ? 'Đang phát - bấm để dừng' : title}
        aria-label={isPlaying ? 'Đang phát - bấm để dừng' : title}
        aria-pressed={isThisActive}
        className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
          isThisActive
            ? 'bg-brand-500 text-white border-brand-500 shadow-sm ring-2 ring-brand-500/30'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 border-slate-200 dark:border-slate-800 hover:border-brand-400'
        } ${className}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : isPlaying ? (
          <SoundWaveMini light />
        ) : (
          <Volume2 className="w-4 h-4 shrink-0" />
        )}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={isPlaying ? 'Đang phát - bấm để dừng' : title}
        aria-pressed={isThisActive}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl border font-semibold transition-colors cursor-pointer ${
          isThisActive
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
            : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
        } ${className}`}
      >
        <span className="w-4 h-4 inline-flex items-center justify-center shrink-0">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : isPlaying ? (
            <SoundWaveMini light />
          ) : (
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
          )}
        </span>
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'question') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={isPlaying ? 'Đang đọc câu hỏi - bấm để dừng' : 'Nghe lại giám khảo Eva đọc câu hỏi'}
        aria-pressed={isThisActive}
        className={`inline-flex items-center justify-center h-8 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
          isThisActive
            ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-md shadow-indigo-500/25 ring-2 ring-sky-400/30'
            : 'bg-indigo-50/90 hover:bg-indigo-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 text-indigo-700 dark:text-sky-200 border-indigo-200/80 dark:border-sky-500/35'
        } ${className}`}
      >
        <span className="inline-grid items-center justify-items-center">
          <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${!isThisActive ? 'visible' : 'invisible pointer-events-none'}`}>
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </span>
          <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${isPlaying ? 'visible' : 'invisible pointer-events-none'}`}>
            <SoundWaveMini light />
            <span>{playingLabel}</span>
            <Square className="w-2.5 h-2.5 fill-current opacity-80 shrink-0" />
          </span>
          <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${isLoading ? 'visible' : 'invisible pointer-events-none'}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{loadingLabel}</span>
          </span>
        </span>
      </button>
    );
  }

  // Default button ('Nghe câu đúng', 'Nghe bài mẫu', etc.) — locked size via inline-grid
  return (
    <button
      type="button"
      onClick={handleClick}
      title={isPlaying ? 'Đang phát - bấm để dừng' : title}
      aria-pressed={isThisActive}
      className={`inline-flex items-center justify-center h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
        isThisActive
          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
          : 'bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-slate-200 dark:border-slate-800'
      } ${className}`}
    >
      <span className="inline-grid items-center justify-items-center">
        <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${!isThisActive ? 'visible' : 'invisible pointer-events-none'}`}>
          <Volume2 className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </span>
        <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${isPlaying ? 'visible' : 'invisible pointer-events-none'}`}>
          <SoundWaveMini light />
          <span>{playingLabel}</span>
          <Square className="w-2.5 h-2.5 fill-current opacity-80 shrink-0" />
        </span>
        <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${isLoading ? 'visible' : 'invisible pointer-events-none'}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{loadingLabel}</span>
        </span>
      </span>
    </button>
  );
};

