import React, { useState, useEffect } from 'react';
import { systemApi } from '../api/client';
import { Headphones, ArrowRight, CheckCircle2, Play } from 'lucide-react';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';

// Warm-up step: laid out to fit one desktop/laptop screen without scrolling
export const PreTestSetup = ({ onStartExam }) => {
  const [sampleData, setSampleData] = useState(null);
  const [recordedPractice, setRecordedPractice] = useState(null);

  useEffect(() => {
    systemApi.getSampleQuestion()
      .then(res => setSampleData(res.data))
      .catch(err => console.error("Failed to load sample question", err));
  }, []);

  const handleRecordingComplete = ({ audioBlob, durationSeconds }) => {
    const url = audioBlob ? URL.createObjectURL(audioBlob) : null;
    setRecordedPractice({ url, durationSeconds });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3">

      {/* Compact title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Interviewer Check & Warm-up</h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
            <Headphones className="w-3.5 h-3.5" />
            <span>Step 4 of 5</span>
          </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 sm:max-w-sm sm:text-right">
          Nghe Eva đọc câu khởi động và nói thử để kiểm tra tai nghe, micro.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

        {/* Left: Eva + warm-up prompt */}
        <div className="lg:col-span-5 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2 shadow-sm">
          <EvaAvatar
            audioUrl={sampleData?.audio_path}
            text={sampleData?.question_text}
            autoPlay={true}
            allowReplay={true}
            maxReplays={2}
          />
          <div className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block mb-1">
              Sample Warm-Up Prompt
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              "{sampleData?.question_text || 'Can you introduce yourself briefly and describe what the weather is like today?'}"
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
              🇻🇳 Câu hỏi làm quen, không tính điểm.
            </p>
          </div>
        </div>

        {/* Right: practice recording + start */}
        <div className="lg:col-span-7 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Practice Recording</h2>
            {recordedPractice ? (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Microphone OK
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Nói thử 15–30 giây</span>
            )}
          </div>

          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            isPracticeMode={true}
            compact
            targetDurationMin={15}
            targetDurationMax={60}
          />

          {recordedPractice?.url && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-emerald-500/30">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">Nghe lại:</span>
              <audio src={recordedPractice.url} controls className="w-full h-8" />
            </div>
          )}

          {/* Start the test */}
          <div className="mt-auto pt-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">15 câu hỏi đã sẵn sàng. Bắt đầu từ câu 1.</p>
            <button
              onClick={onStartExam}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Begin Question 1</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
