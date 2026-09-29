import React, { useState, useEffect } from 'react';
import { ArrowRight, Check, ListChecks, Sparkles, BookmarkCheck, RotateCcw } from 'lucide-react';
import { sessionApi } from '../api/client';
import { ViTooltip } from '../components/Tooltip';

// The ACTFL/OPIc Golden Survey Preset for Vietnamese learners targeting Intermediate High (IH)
const IH_GOLDEN_PRESET = {
  occupation: 'Employed in business / technology',
  studentStatus: 'Not a student',
  livingSituation: 'Live alone in an apartment',
  leisureActivities: [
    'Going to cafes / coffee shops',
    'Going to parks',
    'Watching movies at the cinema',
    'Listening to live music'
  ],
  hobbies: [
    'Listening to music',
    'Cooking / trying new recipes',
    'Reading novels'
  ],
  sports: [
    'Jogging / running',
    'Gym / fitness workout',
    'Walking'
  ],
  travel: [
    'Domestic travel / beach trips',
    'Overseas vacations'
  ]
};

export const Survey = ({ sessionId, onSurveyCompleted }) => {
  // Load initial state from saved custom preset if present, else fallback to Golden preset
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem('opic_custom_survey_preset');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse custom survey preset:", e);
    }
    return IH_GOLDEN_PRESET;
  };

  const initial = getInitialState();

  const [occupation, setOccupation] = useState(initial.occupation || 'Employed in business / technology');
  const [studentStatus, setStudentStatus] = useState(initial.studentStatus || 'Not a student');
  const [livingSituation, setLivingSituation] = useState(initial.livingSituation || 'Live alone in an apartment');
  const [leisureActivities, setLeisureActivities] = useState(initial.leisureActivities || IH_GOLDEN_PRESET.leisureActivities);
  const [hobbies, setHobbies] = useState(initial.hobbies || IH_GOLDEN_PRESET.hobbies);
  const [sports, setSports] = useState(initial.sports || IH_GOLDEN_PRESET.sports);
  const [travel, setTravel] = useState(initial.travel || IH_GOLDEN_PRESET.travel);

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const toggleItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const applyIhGoldenPreset = () => {
    setOccupation(IH_GOLDEN_PRESET.occupation);
    setStudentStatus(IH_GOLDEN_PRESET.studentStatus);
    setLivingSituation(IH_GOLDEN_PRESET.livingSituation);
    setLeisureActivities(IH_GOLDEN_PRESET.leisureActivities);
    setHobbies(IH_GOLDEN_PRESET.hobbies);
    setSports(IH_GOLDEN_PRESET.sports);
    setTravel(IH_GOLDEN_PRESET.travel);
    setNotice('Đã nạp Bộ khảo sát Vàng Chuẩn Mục Tiêu IH!');
    setTimeout(() => setNotice(''), 3000);
  };

  const saveCustomPreset = () => {
    const customConfig = {
      occupation,
      studentStatus,
      livingSituation,
      leisureActivities,
      hobbies,
      sports,
      travel
    };
    try {
      localStorage.setItem('opic_custom_survey_preset', JSON.stringify(customConfig));
      setNotice('Đã lưu các lựa chọn này làm khảo sát mặc định cho các lần thi sau!');
      setTimeout(() => setNotice(''), 3500);
    } catch (e) {
      console.error("Failed to save custom preset:", e);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      await sessionApi.submitSurvey(sessionId, {
        occupation,
        student_status: studentStatus,
        living_situation: livingSituation,
        leisure_activities: leisureActivities,
        hobbies,
        sports,
        travel
      });
      onSurveyCompleted();
    } catch (err) {
      console.error("Survey submission failed:", err);
      // Proceed gracefully
      onSurveyCompleted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Title */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-2">
          <ListChecks className="w-3.5 h-3.5" />
          <span>Step 2 of 5: Candidate Profile Survey</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Background Survey</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl mx-auto">
          The official OPIc selects tailored question combos based on your survey answers. Select your actual occupation, living style, and leisure interests.
        </p>
      </div>

      {/* Preset Banner (Khảo sát mặc định) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-transparent border border-sky-500/30 dark:border-sky-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 p-0.5 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Bộ Khảo Sát Vàng Chuẩn Mục Tiêu IH</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold">Tối ưu đề thi</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Tự động chọn các chủ đề dễ ăn điểm (Nhà ở, Quán cafe, Công viên, Chạy bộ, Du lịch biển) giúp kiểm soát thì & sự cố bất ngờ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={applyIhGoldenPreset}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nạp Khảo Sát Chuẩn IH</span>
          </button>
          
          <button
            type="button"
            onClick={saveCustomPreset}
            title="Lưu lựa chọn hiện tại làm mặc định cho các lần thi sau"
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-sky-500" />
            <span>Lưu làm mặc định</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-bounce-subtle">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        {/* 1. Occupation & Student Status */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span>1. Work & Education</span>
            <ViTooltip vi="Tình trạng nghề nghiệp và học vấn của bạn sẽ quyết định các câu hỏi liên quan đến nơi làm việc hoặc trường học.">
              <span className="text-[11px] text-brand-600 dark:text-brand-400 font-normal normal-case">Gợi ý OPIc</span>
            </ViTooltip>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Occupation</label>
              <div className="space-y-2">
                {[
                  'Employed in business / technology',
                  'Healthcare / education professional',
                  'Freelancer / remote contractor',
                  'Currently not employed'
                ].map((opt) => (
                  <label key={opt} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer text-xs text-slate-800 dark:text-slate-200 shadow-sm">
                    <input
                      type="radio"
                      name="occupation"
                      checked={occupation === opt}
                      onChange={() => setOccupation(opt)}
                      className="text-brand-500 focus:ring-0"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Student Status</label>
              <div className="space-y-2">
                {[
                  'Not a student',
                  'Undergraduate college student',
                  'Graduate student (Master / PhD)',
                  'Taking professional certification courses'
                ].map((opt) => (
                  <label key={opt} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer text-xs text-slate-800 dark:text-slate-200 shadow-sm">
                    <input
                      type="radio"
                      name="studentStatus"
                      checked={studentStatus === opt}
                      onChange={() => setStudentStatus(opt)}
                      className="text-brand-500 focus:ring-0"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Living Situation */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            2. Housing & Living Situation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Live alone in an apartment',
              'Live with family in a house / apartment',
              'Live with roommates / flatmates',
              'Living in a dormitory / studio'
            ].map((opt) => (
              <label key={opt} className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer text-xs text-slate-800 dark:text-slate-200 shadow-sm">
                <input
                  type="radio"
                  name="livingSituation"
                  checked={livingSituation === opt}
                  onChange={() => setLivingSituation(opt)}
                  className="text-brand-500 focus:ring-0"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 3. Leisure Activities (Multi-select) */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              3. Leisure Activities (Choose 3 or more)
            </h2>
            <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold">{leisureActivities.length} selected</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              'Going to cafes / coffee shops',
              'Going to parks',
              'Watching movies at the cinema',
              'Listening to live music',
              'Going to the beach / lakeside',
              'Attending sporting events',
              'Camping / glamping',
              'Going shopping',
              'Visiting art galleries / museums'
            ].map((item) => {
              const checked = leisureActivities.includes(item);
              return (
                <div
                  key={item}
                  onClick={() => toggleItem(leisureActivities, setLeisureActivities, item)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    checked
                      ? 'bg-brand-500/10 border-brand-500/50 text-brand-700 dark:text-brand-200 font-medium'
                      : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shadow-sm'
                  }`}
                >
                  <span>{item}</span>
                  {checked && <Check className="w-4 h-4 text-brand-500 shrink-0 ml-1" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Hobbies, Sports & Travel */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col gap-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            4. Hobbies, Exercise & Travel
          </h2>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Hobbies & Pastimes:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                'Listening to music',
                'Cooking / trying new recipes',
                'Reading novels',
                'Photography',
                'Writing / journaling',
                'Playing video games'
              ].map((item) => {
                const checked = hobbies.includes(item);
                return (
                  <div
                    key={item}
                    onClick={() => toggleItem(hobbies, setHobbies, item)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      checked 
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-medium' 
                        : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 shadow-sm'
                    }`}
                  >
                    <span>{item}</span>
                    {checked && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Sports & Workouts:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                'Jogging / running',
                'Gym / fitness workout',
                'Walking',
                'Swimming',
                'Cycling',
                'Yoga / Pilates'
              ].map((item) => {
                const checked = sports.includes(item);
                return (
                  <div
                    key={item}
                    onClick={() => toggleItem(sports, setSports, item)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      checked 
                        ? 'bg-sky-500/10 border-sky-500/50 text-sky-700 dark:text-sky-300 font-medium' 
                        : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 shadow-sm'
                    }`}
                  >
                    <span>{item}</span>
                    {checked && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Travel & Vacations:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                'Domestic travel / beach trips',
                'Overseas vacations',
                'Staycations at home',
                'Business trips'
              ].map((item) => {
                const checked = travel.includes(item);
                return (
                  <div
                    key={item}
                    onClick={() => toggleItem(travel, setTravel, item)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      checked 
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300 font-medium' 
                        : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 shadow-sm'
                    }`}
                  >
                    <span>{item}</span>
                    {checked && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Mẹo: Nhấn nút <strong>Nạp Khảo Sát Chuẩn IH</strong> phía trên để chọn nhanh combo dễ ăn điểm nhất.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white font-semibold text-sm shadow-xl shadow-sky-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            <span>{submitting ? 'Saving Survey...' : 'Next: Self-Assessment (Level 1-6)'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </form>

    </div>
  );
};
