import React, { useState, useEffect } from 'react';
import { systemApi } from '../api/client';
import { Headphones, Mic, Volume2, ArrowRight, CheckCircle2, Play } from 'lucide-react';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { ViTooltip } from '../components/Tooltip';

export const PreTestSetup = ({ onStartExam }) => {
  const [sampleData, setSampleData] = useState(null);
  const [practiceDone, setPracticeDone] = useState(false);
  const [recordedPractice, setRecordedPractice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSample = async () => {
      try {
        const res = await systemApi.getSampleQuestion();
        setSampleData(res.data);
      } catch (err) {
        console.error("Failed to load sample question", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSample();
  }, []);

  const handleRecordingComplete = ({ audioBlob, durationSeconds, transcript }) => {
    const url = URL.createObjectURL(audioBlob);
    setRecordedPractice({ url, durationSeconds, transcript });
    setPracticeDone(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Title */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2">
          <Headphones className="w-3.5 h-3.5" />
          <span>Step 4 of 5: Pre-Test Setup & Audio Practice</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Interviewer Check & Warm-up</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl mx-auto">
          Meet your AI examiner, Eva. Listen to her warm-up question through your headphones, and practice speaking into your microphone to calibrate your audio levels.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left: Eva Avatar Card */}
        <div className="md:col-span-5 glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col items-center shadow-sm">
          <EvaAvatar
            audioUrl={sampleData?.audio_path}
            autoPlay={true}
            allowReplay={true}
            maxReplays={2}
          />

          <div className="mt-6 w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block mb-1">
              Sample Warm-Up Prompt:
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              "{sampleData?.question_text || 'Can you introduce yourself briefly and describe what the weather is like today?'}"
            </p>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
              🇻🇳 Đây là câu hỏi làm quen để bạn khởi động giọng nói trước khi vào bài thi chính thức.
            </div>
          </div>
        </div>

        {/* Right: Audio Recording Practice */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <div className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Practice Recording Your Voice</span>
              {practiceDone && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Microphone Calibrated
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Press the button below and speak for 15-30 seconds. Your speech will be transcribed in real time.
            </p>

            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              isPracticeMode={true}
              targetDurationMin={15}
              targetDurationMax={60}
            />

            {/* Playback recorded practice */}
            {recordedPractice && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-emerald-500/30 flex flex-col gap-2">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Your Recorded Practice Audio:</span>
                <audio src={recordedPractice.url} controls className="w-full h-8" />
                <p className="text-xs text-slate-700 dark:text-slate-300 italic mt-1">"{recordedPractice.transcript}"</p>
              </div>
            )}
          </div>

          {/* Start Test Call-to-action */}
          <div className="glass-panel bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">All Set for the Official Flow?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">15 questions are loaded. Click below to begin with Question 1.</p>
            </div>

            <button
              onClick={onStartExam}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform active:scale-95 shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Begin Question 1: Self-Introduction</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
