import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, Mic, CheckCircle, FastForward } from 'lucide-react';
import { ViTooltip } from './Tooltip';

export const ShadowingPlayer = ({
  modelAnswer,
  onRecordSentence
}) => {
  if (!modelAnswer) return null;

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [isShadowRecording, setIsShadowRecording] = useState(false);
  const [userRepetition, setUserRepetition] = useState({});

  const audioRef = useRef(null);

  const sentences = modelAnswer.sentences && modelAnswer.sentences.length > 0
    ? modelAnswer.sentences
    : modelAnswer.text.split(/(?<=[.?!])\s+/).filter(Boolean);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const playSentenceAudio = (index) => {
    setActiveSentenceIndex(index);
    if (audioRef.current) {
      // Approximate sentence offset based on index
      const totalSentences = sentences.length;
      if (audioRef.current.duration) {
        const estTime = (index / totalSentences) * audioRef.current.duration;
        audioRef.current.currentTime = estTime;
        audioRef.current.play();
      }
    }
  };

  return (
    <div className="w-full glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
      
      {/* Audio element */}
      {modelAnswer.audio_path && (
        <audio
          ref={audioRef}
          src={modelAnswer.audio_path}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Header with Level & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase border ${
              modelAnswer.level === 'IH'
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                : modelAnswer.level === 'IM'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
                : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
            }`}>
              Level {modelAnswer.level} Model
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Interactive Shadowing & Pacing Studio</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic font-normal">"{modelAnswer.rationale}"</p>
        </div>

        {/* Playback Controls & Speed Selectors */}
        <div className="flex items-center gap-2">
          {/* Speed Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
            {[0.7, 0.85, 1.0, 1.2].map((s) => (
              <button
                key={s}
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

          {/* Master Play Button */}
          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play All'}</span>
          </button>
        </div>
      </div>

      {/* Sentence-by-sentence Shadowing List */}
      <div className="flex flex-col gap-2.5 mt-2">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">Sentence-by-Sentence Practice:</span>
          <span className="font-normal">Click a sentence to jump & listen, then repeat aloud</span>
        </div>

        {sentences.map((sent, idx) => {
          const isActive = activeSentenceIndex === idx;
          return (
            <div
              key={idx}
              onClick={() => playSentenceAudio(idx)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-300 dark:border-brand-500/40 text-brand-900 dark:text-white shadow-sm font-medium'
                  : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5 flex-1">
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded mt-0.5 ${
                  isActive 
                    ? 'bg-brand-500 text-white font-bold' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-semibold'
                }`}>
                  #{idx + 1}
                </span>
                <p className="text-sm leading-relaxed">{sent}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSentenceAudio(idx);
                  }}
                  title="Listen to this sentence"
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-800 transition-colors shadow-xs"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
