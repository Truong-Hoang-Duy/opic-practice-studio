import React, { useState, useEffect } from 'react';
import { systemApi } from '../api/client';
import { Headphones, ArrowRight, CheckCircle2, Play } from 'lucide-react';
import { EvaAvatar } from '../components/EvaAvatar';
import { AudioRecorder } from '../components/AudioRecorder';
import { useLanguage } from '../context/LanguageContext';

// Warm-up step: laid out to fit one desktop/laptop screen without scrolling
export const PreTestSetup = ({ onStartExam }) => {
  const { pick } = useLanguage();
  const [sampleData, setSampleData] = useState(null);
  const [recordedPractice, setRecordedPractice] = useState(null);
  const [autoStartRecord, setAutoStartRecord] = useState(false);

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
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 overflow-y-auto overscroll-contain lg:static lg:inset-auto lg:z-auto lg:h-full lg:overflow-hidden w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[820px] lg:my-auto flex flex-col gap-2.5 sm:gap-4 lg:gap-5">
        {/* Compact title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 shrink-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {pick('Khởi động cùng Eva', 'Warm-Up with Eva')}
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-700 dark:text-emerald-300 text-[10px] sm:text-[11px] font-bold">
              <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{pick('Bước 4/4', 'Step 4/4')}</span>
            </div>
          </div>
          <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400 sm:max-w-sm sm:text-right">
            {pick('Nghe Eva đọc câu khởi động và nói thử để kiểm tra tai nghe, micro.', 'Listen to Eva read a warm-up prompt and test your mic before starting.')}
          </p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2.5 sm:gap-4 items-stretch">
          {/* Left / Top: Eva + warm-up prompt */}
          <div className="lg:col-span-5 glass-panel rounded-2xl sm:rounded-3xl p-3 sm:p-5 lg:p-6 flex flex-col justify-between gap-2.5 sm:gap-4">
            <div className="w-full shrink-0">
              <EvaAvatar
                layout="horizontal"
                audioUrl={sampleData?.audio_path}
                text={sampleData?.question_text}
                autoPlay={true}
                allowReplay={true}
                maxReplays={1}
                onSecondReadEnded={() => setAutoStartRecord(true)}
              />
            </div>
            <div className="w-full flex-1 p-3 sm:p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 text-left flex flex-col justify-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400 block mb-1">
                {pick('Câu hỏi khởi động', 'Warm-Up Prompt')}
              </span>
              {/* Question ALWAYS stays in English */}
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
                "{sampleData?.question_text || 'Can you introduce yourself briefly and describe what the weather is like today?'}"
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 italic">
                {pick('Câu hỏi làm quen, không tính điểm.', 'Unscored warm-up question to check your audio.')}
              </p>
            </div>
          </div>

          {/* Right / Bottom: practice recording + start */}
          <div className="flex-1 lg:col-span-7 glass-panel rounded-2xl sm:rounded-3xl p-3 sm:p-5 lg:p-6 flex flex-col justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <h2 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                {pick('Nói thử micro', 'Mic Test Recording')}
              </h2>
              {recordedPractice ? (
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {pick('Mic sẵn sàng', 'Mic Ready')}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {pick('Nói thử 15–30 giây', 'Speak for 15–30s')}
                </span>
              )}
            </div>

            <div className="my-auto">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isPracticeMode={true}
                compact
                autoStart={autoStartRecord}
                targetDurationMin={15}
                targetDurationMax={60}
              />
            </div>

            {recordedPractice?.url && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-emerald-500/30 shrink-0">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  {pick('Nghe lại:', 'Playback:')}
                </span>
                <audio src={recordedPractice.url} controls className="w-full h-8" />
              </div>
            )}

            {/* Start the test */}
            <div className="pt-2.5 sm:pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-row items-center justify-between gap-3 shrink-0">
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                {pick('15 câu đã sẵn sàng.', '15 questions are ready.')}
              </p>
              <button
                onClick={onStartExam}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-speak-gradient font-extrabold text-sm shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{pick('Bắt đầu', 'Start')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
