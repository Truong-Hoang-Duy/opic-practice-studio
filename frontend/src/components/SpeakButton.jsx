import React from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { speakPhrase, useSpeakingState } from '../utils/speakPhrase';

// Animated 4-bar equalizer sound wave matching Eva's speaking state
export const SoundWaveMini = ({ light = false }) => (
  <span className="inline-flex items-center gap-0.5 h-3.5 px-0.5" aria-hidden="true">
    <span
      className={`w-0.5 rounded-full animate-sound-wave ${light ? 'bg-white' : 'bg-sky-500 dark:bg-sky-400'}`}
      style={{ animationDelay: '0.05s' }}
    />
    <span
      className={`w-0.5 rounded-full animate-sound-wave ${light ? 'bg-emerald-200' : 'bg-emerald-500 dark:bg-emerald-400'}`}
      style={{ animationDelay: '0.25s' }}
    />
    <span
      className={`w-0.5 rounded-full animate-sound-wave ${light ? 'bg-white' : 'bg-sky-500 dark:bg-sky-400'}`}
      style={{ animationDelay: '0.15s' }}
    />
    <span
      className={`w-0.5 rounded-full animate-sound-wave ${light ? 'bg-emerald-200' : 'bg-emerald-500 dark:bg-emerald-400'}`}
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
        className={`inline-flex items-center justify-center gap-1 p-2 rounded-lg border transition-all cursor-pointer shrink-0 ${
          isThisActive
            ? 'bg-brand-500 text-white border-brand-500 shadow-sm ring-2 ring-brand-500/30'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 border-slate-200 dark:border-slate-800 hover:border-brand-400'
        } ${className}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <SoundWaveMini light />
        ) : (
          <Volume2 className="w-4 h-4" />
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
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl border font-semibold transition-all cursor-pointer ${
          isThisActive
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
            : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
        } ${className}`}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : isPlaying ? (
          <SoundWaveMini light />
        ) : (
          <Volume2 className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{label}</span>
        {isPlaying && <span className="text-[10px] opacity-90 font-normal">(Đang đọc)</span>}
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
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
          isThisActive
            ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20 ring-2 ring-sky-400/30'
            : 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30'
        } ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{loadingLabel}</span>
          </>
        ) : isPlaying ? (
          <>
            <SoundWaveMini light />
            <span>{playingLabel}</span>
            <Square className="w-2.5 h-2.5 fill-current opacity-80 ml-0.5" />
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </>
        )}
      </button>
    );
  }

  // Default button ('Nghe câu đúng', 'Nghe bài mẫu', etc.)
  return (
    <button
      type="button"
      onClick={handleClick}
      title={isPlaying ? 'Đang phát - bấm để dừng' : title}
      aria-pressed={isThisActive}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
        isThisActive
          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
          : 'bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-slate-200 dark:border-slate-800'
      } ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{loadingLabel}</span>
        </>
      ) : isPlaying ? (
        <>
          <SoundWaveMini light />
          <span>{playingLabel}</span>
          <Square className="w-2.5 h-2.5 fill-current opacity-80" />
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

