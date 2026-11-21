import React, { useState } from 'react';
import { ArrowRight, Check, BookmarkCheck, RotateCcw, AlertCircle } from 'lucide-react';
import { sessionApi } from '../api/client';
import { ViTooltip } from '../components/Tooltip';
import { notify } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

// Complete Vietnamese translations for all official OPIc Survey options (canonical English values are always stored & sent to backend)
const SURVEY_OPTION_VI = {
  // Part 1: Work
  "Business / Corporation": "Doanh nghiệp / Công ty",
  "Home Business": "Kinh doanh tại nhà",
  "Teacher / Educator": "Giáo viên / Giảng viên",
  "No work experience": "Chưa có kinh nghiệm làm việc",
  // Part 2: Education
  "Yes, Full-time or Part-time": "Có (Toàn thời gian hoặc bán thời gian)",
  "No": "Không",
  "College or university to earn a degree": "Học cao đẳng / đại học để lấy bằng",
  "Continuing education to improve professional skills": "Học bổ túc nâng cao kỹ năng chuyên môn",
  "Language classes": "Học các lớp ngoại ngữ",
  "It has been more than 5 years since I took a class.": "Đã hơn 5 năm kể từ lần cuối tôi đi học",
  // Part 3: Living
  "I live alone in a house or an apartment.": "Sống một mình trong nhà riêng hoặc căn hộ",
  "I live with non-family members in a house or an apartment.": "Sống cùng bạn bè / người không cùng gia đình",
  "I live with family members in a house or an apartment.": "Sống cùng gia đình trong nhà riêng hoặc căn hộ",
  "I live in a school dormitory.": "Sống ở ký túc xá trường học",
  "I live in military barracks.": "Sống trong doanh trại quân đội",
  // Part 4: Activities
  "go to the movies": "Đi xem phim ở rạp",
  "go to clubs/nightclubs": "Đi câu lạc bộ / hộp đêm",
  "go to the theater": "Đi xem kịch / nhà hát",
  "go to concerts": "Đi xem hòa nhạc / ca nhạc",
  "go to museums": "Đi tham quan bảo tàng",
  "go to parks": "Đi dạo công viên",
  "go camping": "Đi cắm trại",
  "go to the beach": "Đi biển",
  "watch professional sports": "Xem thể thao chuyên nghiệp",
  "watch your children play sports": "Xem con chơi thể thao",
  "coach sports": "Huấn luyện thể thao",
  "play games by yourself (cards, video games, etc.)": "Chơi game một mình (điện tử, bài...)",
  "play games with adults (cards, billiards, board games, etc.)": "Chơi game cùng người lớn (bi-a, board game...)",
  "play games with children (cards, board games, etc.)": "Chơi trò chơi cùng trẻ em",
  "help your children with school assignments": "Giúp con làm bài tập về nhà",
  "do home improvement projects": "Sửa chữa / trang trí nhà cửa",
  "maintain your car": "Bảo dưỡng xe ô tô",
  // Part 4: Hobbies
  "read to children": "Đọc sách cho trẻ em",
  "listen to music": "Nghe nhạc",
  "play a musical instrument": "Chơi nhạc cụ",
  "sing alone": "Hát một mình",
  "sing with a group": "Hát cùng nhóm / karaoke",
  "take dance class/lessons": "Học nhảy / khiêu vũ",
  "go out dancing": "Đi khiêu vũ",
  "write creatively (letters, short stories, poetry)": "Viết sáng tạo (truyện ngắn, thơ, thư)",
  "draw, paint": "Vẽ tranh / hội họa",
  "sew, embroider": "May vá, thêu thùa",
  "knit, crochet": "Đan len, móc len",
  "cook": "Nấu ăn",
  "garden": "Làm vườn",
  "have pets": "Nuôi thú cưng",
  // Part 4: Sports
  "play basketball": "Chơi bóng rổ",
  "play baseball/softball": "Chơi bóng chày",
  "play soccer": "Chơi bóng đá",
  "play football": "Chơi bóng bầu dục Mỹ",
  "play rugby": "Chơi bóng bầu dục Rugby",
  "play ice hockey": "Khúc côn cầu trên băng",
  "play field hockey": "Khúc côn cầu trên cỏ",
  "play cricket": "Chơi cricket",
  "play golf": "Chơi golf",
  "play volleyball": "Chơi bóng chuyền",
  "play tennis": "Chơi quần vợt (tennis)",
  "play badminton": "Chơi cầu lông",
  "play table tennis": "Chơi bóng bàn",
  "swim": "Bơi lội",
  "bike": "Đạp xe",
  "ride a motorcycle": "Lái xe máy",
  "scuba dive/snorkel": "Lặn biển",
  "ski/snowboard": "Trượt tuyết",
  "waterski": "Lướt ván nước",
  "ice skate": "Trượt băng",
  "inline skate": "Trượt patin",
  "go horseback riding": "Cưỡi ngựa",
  "jog": "Chạy bộ",
  "walk": "Đi bộ",
  "do martial arts": "Tập võ thuật",
  "do yoga": "Tập yoga",
  "go hiking/trekking": "Đi bộ đường dài / leo núi",
  "go fishing": "Đi câu cá",
  "go boating": "Chèo thuyền",
  "go to a health club or gym": "Tập gym / thể hình",
  "exercise": "Tập thể dục",
  "do not participate in sports or physical activities": "Không tham gia thể thao",
  // Part 4: Travel
  "travel for business domestically": "Đi công tác trong nước",
  "travel for business internationally": "Đi công tác nước ngoài",
  "stay at home for vacation": "Ở nhà nghỉ ngơi vào kỳ nghỉ",
  "take vacation domestically": "Đi du lịch trong nước",
  "take vacation internationally": "Đi du lịch nước ngoài",
};

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
  const { isVi, pick } = useLanguage();
  const optLabel = (opt) => (isVi ? SURVEY_OPTION_VI[opt] || opt : opt);
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
  const [part4Tab, setPart4Tab] = useState('activities');

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
    setNotice(pick('Đã khôi phục lựa chọn mặc định!', 'Restored default survey choices!'));
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
      setNotice(pick('Đã lưu cấu hình mặc định!', 'Saved as your default survey preset!'));
      setTimeout(() => setNotice(''), 3500);
    } catch (e) {
      console.error("Save preset error:", e);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isPart4Valid) {
      notify.warning(pick('Vui lòng chọn tối thiểu 6 mục trong Phần 4 trước khi tiếp tục.', 'Please select at least 6 items in Part 4 before continuing.'));
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

  const part4Sections = [
    { key: 'activities', label: pick('Hoạt động', 'Activities'), title: pick('Bạn thường làm những hoạt động gì?', SURVEY_DATA.part4.activities.title), options: SURVEY_DATA.part4.activities.options, selected: activities, setter: setActivities },
    { key: 'hobbies', label: pick('Sở thích', 'Hobbies'), title: pick('Bạn có những sở thích nào?', SURVEY_DATA.part4.hobbies.title), options: SURVEY_DATA.part4.hobbies.options, selected: hobbies, setter: setHobbies },
    { key: 'sports', label: pick('Thể thao', 'Sports'), title: pick('Bạn tham gia môn thể thao nào?', SURVEY_DATA.part4.sports.title), options: SURVEY_DATA.part4.sports.options, selected: sports, setter: setSports },
    { key: 'travel', label: pick('Du lịch', 'Travel'), title: pick('Bạn thường đi nghỉ / du lịch theo hình thức nào?', SURVEY_DATA.part4.travel.title), options: SURVEY_DATA.part4.travel.options, selected: travel, setter: setTravel },
  ];
  const activePart4 = part4Sections.find((s) => s.key === part4Tab) || part4Sections[0];

  return (
    <div className="w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 lg:h-full lg:min-h-0 lg:overflow-hidden flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[860px] lg:my-auto flex flex-col gap-3 sm:gap-4">
      {/* Compact Top Header + Preset Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-xl bg-[#e65100] text-white text-[11px] font-extrabold uppercase tracking-wider shrink-0">
            {pick('Bước 1/4 · Khảo sát', 'Step 1/4 · Survey')}
          </span>
          <div>
            <h1 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
              {pick('Khảo sát cá nhân', 'Background Survey')}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {notice && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
              <Check className="w-3.5 h-3.5" />
              {notice}
            </span>
          )}
          <button
            type="button"
            onClick={resetToUserPreset}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-orange-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>{pick('Mặc định', 'Reset')}</span>
          </button>
          <button
            type="button"
            onClick={saveCustomPreset}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-sky-500/30 bg-indigo-50 dark:bg-sky-500/15 text-xs font-bold text-indigo-700 dark:text-sky-300 hover:bg-indigo-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{pick('Lưu', 'Save')}</span>
          </button>
        </div>
      </div>

      {/* Fixed-Frame 2-Column Survey Workspace (Zero Outer Scroll on Laptop!) */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 lg:flex-1 lg:min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:flex-1 lg:min-h-0">
          {/* Left Column (5 cols): Parts 1, 2 & 3 */}
          <div className="lg:col-span-5 glass-card rounded-2xl p-3 sm:p-4 flex flex-col gap-3 lg:h-full lg:overflow-y-auto">
            {/* Part 1 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
                  {pick('Phần 1 · Công việc', 'Part 1 · Work')}
                </h2>
                <ViTooltip vi={pick("Mẹo: Chọn 'Chưa có kinh nghiệm làm việc' để tránh câu hỏi phức tạp về công sở.", "Tip: Choose 'No work experience' to avoid complex office questions.")} />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {pick('Lĩnh vực công việc nào mô tả đúng nhất về bạn?', SURVEY_DATA.part1.question)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SURVEY_DATA.part1.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      occupation === opt
                        ? 'bg-indigo-50/90 dark:bg-sky-500/15 border-indigo-400 dark:border-sky-400 text-slate-900 dark:text-white font-bold'
                        : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="occupation"
                      value={opt}
                      checked={occupation === opt}
                      onChange={() => setOccupation(opt)}
                      className="text-indigo-600 focus:ring-0 shrink-0"
                    />
                    <span className="truncate">{optLabel(opt)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Part 2 */}
            <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
                  {pick('Phần 2 · Học vấn', 'Part 2 · Education')}
                </h2>
                <ViTooltip vi={pick("Mẹo: Chọn 'Không' và '> 5 năm' để tránh câu hỏi về trường học.", "Tip: Choose 'No' and '> 5 years' to avoid school questions.")} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mr-1">
                  {pick('Hiện đang đi học?', 'Currently in school?')}
                </span>
                {SURVEY_DATA.part2.q1.options.map((opt) => (
                  <label
                    key={opt}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs cursor-pointer ${
                      studentStatus === opt
                        ? 'bg-indigo-50/90 dark:bg-sky-500/15 border-indigo-400 dark:border-sky-400 text-slate-900 dark:text-white font-bold'
                        : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="studentStatus"
                      value={opt}
                      checked={studentStatus === opt}
                      onChange={() => setStudentStatus(opt)}
                    />
                    <span>{optLabel(opt)}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {SURVEY_DATA.part2.q2.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] cursor-pointer ${
                      educationExperience === opt
                        ? 'bg-indigo-50/90 dark:bg-sky-500/15 border-indigo-400 dark:border-sky-400 text-slate-900 dark:text-white font-bold'
                        : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="educationExperience"
                      value={opt}
                      checked={educationExperience === opt}
                      onChange={() => setEducationExperience(opt)}
                    />
                    <span className="leading-snug">{optLabel(opt)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Part 3 */}
            <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
                  {pick('Phần 3 · Nơi ở', 'Part 3 · Living')}
                </h2>
                <ViTooltip vi={pick("Mẹo: Chọn sống cùng gia đình giúp dễ miêu tả nhà cửa & kỷ niệm gia đình.", "Tip: Living with family makes home & family stories easier to describe.")} />
              </div>
              <div className="flex flex-col gap-1">
                {SURVEY_DATA.part3.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] cursor-pointer ${
                      livingSituation === opt
                        ? 'bg-indigo-50/90 dark:bg-sky-500/15 border-indigo-400 dark:border-sky-400 text-slate-900 dark:text-white font-bold'
                        : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="livingSituation"
                      value={opt}
                      checked={livingSituation === opt}
                      onChange={() => setLivingSituation(opt)}
                    />
                    <span className="leading-snug">{optLabel(opt)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Part 4 Tabbed Selector */}
          <div className="lg:col-span-7 glass-card rounded-2xl p-3 sm:p-4 flex flex-col gap-3 lg:h-full lg:min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800 shrink-0">
              <div>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
                  {pick('Phần 4 · Hoạt động, Sở thích, Thể thao & Du lịch', 'Part 4 · Leisure, Hobbies, Sports & Travel')}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {pick('Chọn tổng cộng tối thiểu 6 mục xuyên suốt 4 nhóm bên dưới.', 'Select at least 6 items total across the 4 tabs below.')}
                </p>
              </div>
              <span
                className={`text-xs font-extrabold px-3 py-1 rounded-full border shrink-0 ${
                  isPart4Valid
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-400/40'
                    : 'text-rose-600 dark:text-rose-300 bg-rose-500/15 border-rose-400/40'
                }`}
              >
                {pick('Đã chọn', 'Selected')} {totalSelectedPart4} {isPart4Valid ? '✓' : '/ 6'}
              </span>
            </div>

            {/* 4 Mini Tabs for Part 4 */}
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shrink-0">
              {part4Sections.map((sec) => {
                const active = part4Tab === sec.key;
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => setPart4Tab(sec.key)}
                    className={`py-1.5 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="truncate">{sec.label}</span>
                    {sec.selected.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${
                          active ? 'bg-white/25 text-white' : 'bg-indigo-500/15 text-indigo-700 dark:text-sky-300'
                        }`}
                      >
                        {sec.selected.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Part 4 Section Options */}
            <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">{activePart4.title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {activePart4.options.map((opt) => {
                  const checked = activePart4.selected.includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
                        checked
                          ? 'bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-200 font-bold'
                          : 'bg-white/80 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(activePart4.selected, activePart4.setter, opt)}
                        className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 shrink-0"
                      />
                      <span className="leading-snug">{optLabel(opt)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Bottom Action Row */}
        <div className="flex items-center justify-between pt-1 shrink-0">
          {!isPart4Valid ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {pick(
                  `Hãy chọn thêm ${6 - totalSelectedPart4} mục trong Phần 4 để tiếp tục.`,
                  `Select ${6 - totalSelectedPart4} more item(s) in Part 4 to continue.`
                )}
              </span>
            </div>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={!isPart4Valid || submitting}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-sm transition-all cursor-pointer whitespace-nowrap ${
              isPart4Valid && !submitting
                ? 'btn-brand-gradient'
                : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>{submitting ? pick('Đang lưu...', 'Saving...') : pick('Tiếp tục', 'Next')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};
