import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles, BookmarkCheck, RotateCcw, AlertCircle } from 'lucide-react';
import { sessionApi } from '../api/client';
import { ViTooltip } from '../components/Tooltip';

// The user's preset survey choices
export const USER_DEFAULT_PRESET = {
  occupation: 'No work experience',
  studentStatus: 'No',
  educationExperience: 'It has been more than 5 years since I took a class.',
  livingSituation: 'I live with family members in a house or an apartment.',
  activities: [
    'go to the movies',
    'go to parks'
  ],
  hobbies: [
    'listen to music',
    'cook'
  ],
  sports: [
    'walk'
  ],
  travel: [
    'stay at home for vacation'
  ]
};

// Full list of options from official OPIc Background Survey
export const SURVEY_DATA = {
  part1: {
    question: "What best describes your field of work?",
    options: [
      "Business / Corporation",
      "Home Business",
      "Teacher / Educator",
      "No work experience"
    ]
  },
  part2: {
    q1: {
      question: "Are you currently going to school?",
      options: [
        "Yes, Full-time or Part-time",
        "No"
      ]
    },
    q2: {
      question: "What best describes your last educational experience?",
      options: [
        "College or university to earn a degree",
        "Continuing education to improve professional skills",
        "Language classes",
        "It has been more than 5 years since I took a class."
      ]
    }
  },
  part3: {
    question: "Where do you live?",
    options: [
      "I live alone in a house or an apartment.",
      "I live with non-family members in a house or an apartment.",
      "I live with family members in a house or an apartment.",
      "I live in a school dormitory.",
      "I live in military barracks."
    ]
  },
  part4: {
    activities: {
      title: "What activities do you do?",
      options: [
        "go to the movies",
        "go to clubs/nightclubs",
        "go to the theater",
        "go to concerts",
        "go to museums",
        "go to parks",
        "go camping",
        "go to the beach",
        "watch professional sports",
        "watch your children play sports",
        "coach sports",
        "play games by yourself (cards, video games, etc.)",
        "play games with adults (cards, billiards, board games, etc.)",
        "play games with children (cards, board games, etc.)",
        "help your children with school assignments",
        "do home improvement projects",
        "maintain your car"
      ]
    },
    hobbies: {
      title: "What interests or hobbies do you enjoy?",
      options: [
        "read to children",
        "listen to music",
        "play a musical instrument",
        "sing alone",
        "sing with a group",
        "take dance class/lessons",
        "go out dancing",
        "write creatively (letters, short stories, poetry)",
        "draw, paint",
        "sew, embroider",
        "knit, crochet",
        "cook",
        "garden",
        "have pets"
      ]
    },
    sports: {
      title: "What sports or physical activities do you participate in?",
      options: [
        "play basketball",
        "play baseball/softball",
        "play soccer",
        "play football",
        "play rugby",
        "play ice hockey",
        "play field hockey",
        "play cricket",
        "play golf",
        "play volleyball",
        "play tennis",
        "play badminton",
        "play table tennis",
        "swim",
        "bike",
        "ride a motorcycle",
        "scuba dive/snorkel",
        "ski/snowboard",
        "waterski",
        "ice skate",
        "inline skate",
        "go horseback riding",
        "jog",
        "walk",
        "do martial arts",
        "do yoga",
        "go hiking/trekking",
        "go fishing",
        "go boating",
        "go to a health club or gym",
        "exercise",
        "do not participate in sports or physical activities"
      ]
    },
    travel: {
      title: "What types of vacation or travel do you do?",
      options: [
        "travel for business domestically",
        "travel for business internationally",
        "stay at home for vacation",
        "take vacation domestically",
        "take vacation internationally"
      ]
    }
  }
};

export const Survey = ({ sessionId, onSurveyCompleted }) => {
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem('opic_user_survey_preset');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to load saved preset:", e);
    }
    return USER_DEFAULT_PRESET;
  };

  const initial = getInitialState();

  const [occupation, setOccupation] = useState(initial.occupation || USER_DEFAULT_PRESET.occupation);
  const [studentStatus, setStudentStatus] = useState(initial.studentStatus || USER_DEFAULT_PRESET.studentStatus);
  const [educationExperience, setEducationExperience] = useState(initial.educationExperience || USER_DEFAULT_PRESET.educationExperience);
  const [livingSituation, setLivingSituation] = useState(initial.livingSituation || USER_DEFAULT_PRESET.livingSituation);

  const [activities, setActivities] = useState(initial.activities || USER_DEFAULT_PRESET.activities);
  const [hobbies, setHobbies] = useState(initial.hobbies || USER_DEFAULT_PRESET.hobbies);
  const [sports, setSports] = useState(initial.sports || USER_DEFAULT_PRESET.sports);
  const [travel, setTravel] = useState(initial.travel || USER_DEFAULT_PRESET.travel);

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const totalSelectedPart4 = activities.length + hobbies.length + sports.length + travel.length;
  const isPart4Valid = totalSelectedPart4 >= 6;

  const toggleItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const resetToUserPreset = () => {
    setOccupation(USER_DEFAULT_PRESET.occupation);
    setStudentStatus(USER_DEFAULT_PRESET.studentStatus);
    setEducationExperience(USER_DEFAULT_PRESET.educationExperience);
    setLivingSituation(USER_DEFAULT_PRESET.livingSituation);
    setActivities(USER_DEFAULT_PRESET.activities);
    setHobbies(USER_DEFAULT_PRESET.hobbies);
    setSports(USER_DEFAULT_PRESET.sports);
    setTravel(USER_DEFAULT_PRESET.travel);
    setNotice('Đã khôi phục các lựa chọn vàng mặc định của bạn!');
    setTimeout(() => setNotice(''), 3000);
  };

  const saveCustomPreset = () => {
    const config = {
      occupation,
      studentStatus,
      educationExperience,
      livingSituation,
      activities,
      hobbies,
      sports,
      travel
    };
    try {
      localStorage.setItem('opic_user_survey_preset', JSON.stringify(config));
      setNotice('Đã lưu cấu hình khảo sát này làm mặc định cho các phiên thi sau!');
      setTimeout(() => setNotice(''), 3500);
    } catch (e) {
      console.error("Save preset error:", e);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isPart4Valid) {
      alert("Vui lòng chọn tối thiểu 6 mục trong Phần 4 (Part 4) trước khi tiếp tục.");
      return;
    }

    if (!sessionId) {
      console.warn("Survey submission skipped: missing sessionId, proceeding to topics");
      onSurveyCompleted();
      return;
    }

    setSubmitting(true);
    try {
      await sessionApi.submitSurvey(sessionId, {
        occupation,
        student_status: studentStatus,
        education_experience: educationExperience,
        living_situation: livingSituation,
        leisure_activities: activities,
        hobbies,
        sports,
        travel
      });
      onSurveyCompleted();
    } catch (err) {
      console.error("Survey submission failed:", err);
      // Proceed gracefully to topic selection
      onSurveyCompleted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Official OPIc Style Steps Banner */}
      <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden flex flex-wrap shadow-sm">
        <div className="flex-1 min-w-[140px] px-4 py-3 bg-[#e65100] text-white flex flex-col justify-center border-r border-orange-700/50">
          <span className="text-xs font-bold uppercase tracking-wider">Step 1</span>
          <span className="text-sm font-semibold">Background Survey</span>
        </div>
        <div className="flex-1 min-w-[140px] px-4 py-3 text-slate-500 dark:text-slate-400 flex flex-col justify-center border-r border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase">Step 2</span>
          <span className="text-sm font-medium">Core Topic Focus</span>
        </div>
        <div className="flex-1 min-w-[140px] px-4 py-3 text-slate-500 dark:text-slate-400 flex flex-col justify-center border-r border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase">Step 3</span>
          <span className="text-sm font-medium">Self Assessment</span>
        </div>
        <div className="flex-1 min-w-[140px] px-4 py-3 text-slate-500 dark:text-slate-400 flex flex-col justify-center border-r border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase">Step 4</span>
          <span className="text-sm font-medium">Setup</span>
        </div>
        <div className="flex-1 min-w-[140px] px-4 py-3 text-slate-500 dark:text-slate-400 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase">Step 5</span>
          <span className="text-sm font-medium">Begin Test</span>
        </div>
      </div>

      {/* Main Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Background Survey</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Answer as accurately as possible. This test will be based on your responses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToUserPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
            <span>Nạp lựa chọn của tôi</span>
          </button>
          <button
            type="button"
            onClick={saveCustomPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-all cursor-pointer shadow-xs"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Lưu làm mặc định</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium animate-fadeIn flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{notice}</span>
        </div>
      )}

      {/* Survey Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        
        {/* ============================================================ */}
        {/* PART 1 OF 4 */}
        {/* ============================================================ */}
        <section className="bg-white dark:bg-slate-900/80 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Part 1 of 4</h2>
            <ViTooltip text="Mẹo: Chọn 'No work experience' giúp tránh hoàn toàn các câu hỏi combo phức tạp về dự án kỹ thuật hay văn hóa công sở." />
          </div>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {SURVEY_DATA.part1.question}
          </p>
          <div className="flex flex-col gap-2.5 pl-1">
            {SURVEY_DATA.part1.options.map((opt) => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="radio"
                  name="occupation"
                  value={opt}
                  checked={occupation === opt}
                  onChange={() => setOccupation(opt)}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500 focus:ring-1"
                />
                <span className={occupation === opt ? "font-semibold text-slate-900 dark:text-white" : ""}>
                  {opt}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* PART 2 OF 4 */}
        {/* ============================================================ */}
        <section className="bg-white dark:bg-slate-900/80 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Part 2 of 4</h2>
            <ViTooltip text="Mẹo: Chọn 'No' và '> 5 years' để loại trừ các câu hỏi về trường học, giáo sư hay bài tập nhóm." />
          </div>
          
          {/* Question 1 */}
          <div className="flex flex-col gap-3">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {SURVEY_DATA.part2.q1.question}
            </p>
            <div className="flex flex-col gap-2.5 pl-1">
              {SURVEY_DATA.part2.q1.options.map((opt) => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  <input
                    type="radio"
                    name="studentStatus"
                    value={opt}
                    checked={studentStatus === opt}
                    onChange={() => setStudentStatus(opt)}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500 focus:ring-1"
                  />
                  <span className={studentStatus === opt ? "font-semibold text-slate-900 dark:text-white" : ""}>
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 2 */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {SURVEY_DATA.part2.q2.question}
            </p>
            <div className="flex flex-col gap-2.5 pl-1">
              {SURVEY_DATA.part2.q2.options.map((opt) => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  <input
                    type="radio"
                    name="educationExperience"
                    value={opt}
                    checked={educationExperience === opt}
                    onChange={() => setEducationExperience(opt)}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500 focus:ring-1"
                  />
                  <span className={educationExperience === opt ? "font-semibold text-slate-900 dark:text-white" : ""}>
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* PART 3 OF 4 */}
        {/* ============================================================ */}
        <section className="bg-white dark:bg-slate-900/80 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Part 3 of 4</h2>
            <ViTooltip text="Mẹo: 'I live with family members' là chủ đề lý tưởng để miêu tả các phòng trong nhà, phân chia việc nhà và kể kỷ niệm gia đình." />
          </div>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {SURVEY_DATA.part3.question}
          </p>
          <div className="flex flex-col gap-2.5 pl-1">
            {SURVEY_DATA.part3.options.map((opt) => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="radio"
                  name="livingSituation"
                  value={opt}
                  checked={livingSituation === opt}
                  onChange={() => setLivingSituation(opt)}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500 focus:ring-1"
                />
                <span className={livingSituation === opt ? "font-semibold text-slate-900 dark:text-white" : ""}>
                  {opt}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* PART 4 OF 4 */}
        {/* ============================================================ */}
        <section className="bg-white dark:bg-slate-900/80 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Part 4 of 4</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Select a total of at least six (6) options across the various sections below.
              </p>
            </div>
            
            {/* Live counter like real OPIc screen */}
            <div className={`text-sm font-bold px-3 py-1 rounded-full border transition-all ${
              isPart4Valid
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : 'text-red-500 bg-red-500/10 border-red-500/30'
            }`}>
              You have selected {totalSelectedPart4} item(s) {isPart4Valid ? '✓' : '(Cần tối thiểu 6)'}
            </div>
          </div>

          {/* Section 1: Activities */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {SURVEY_DATA.part4.activities.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
              {SURVEY_DATA.part4.activities.options.map((opt) => {
                const checked = activities.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(activities, setActivities, opt)}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span className={checked ? "font-semibold text-slate-900 dark:text-white" : ""}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 2: Hobbies */}
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {SURVEY_DATA.part4.hobbies.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
              {SURVEY_DATA.part4.hobbies.options.map((opt) => {
                const checked = hobbies.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(hobbies, setHobbies, opt)}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span className={checked ? "font-semibold text-slate-900 dark:text-white" : ""}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 3: Sports */}
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {SURVEY_DATA.part4.sports.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-1">
              {SURVEY_DATA.part4.sports.options.map((opt) => {
                const checked = sports.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(sports, setSports, opt)}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span className={checked ? "font-semibold text-slate-900 dark:text-white" : ""}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 4: Vacation & Travel */}
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {SURVEY_DATA.part4.travel.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
              {SURVEY_DATA.part4.travel.options.map((opt) => {
                const checked = travel.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(travel, setTravel, opt)}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span className={checked ? "font-semibold text-slate-900 dark:text-white" : ""}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        {/* Submit Button (Styled identically to official OPIc orange Next button) */}
        <div className="flex items-center justify-between pt-2">
          {!isPart4Valid ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Hãy chọn thêm {6 - totalSelectedPart4} mục trong Part 4 để đủ điều kiện tiếp tục.</span>
            </div>
          ) : <div />}

          <button
            type="submit"
            disabled={!isPart4Valid || submitting}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-sm tracking-wide text-white transition-all shadow-md cursor-pointer ${
              isPart4Valid && !submitting
                ? 'bg-[#f4511e] hover:bg-[#e64a19] active:scale-95'
                : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>{submitting ? 'Saving Profile...' : 'Next >'}</span>
          </button>
        </div>

      </form>

    </div>
  );
};
