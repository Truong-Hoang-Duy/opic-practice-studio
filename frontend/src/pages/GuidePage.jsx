import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Captions,
  Maximize2,
  BookOpen,
  Mic,
  TrendingUp,
  Home,
  ArrowRight,
  Award,
  Sparkles,
  HelpCircle,
  MessageCircleQuestion,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';

const SPEEDS = [0.75, 1, 1.25];

const FALLBACK_CHAPTERS = {
  vi: {
    video: '/tutorials/guide-vi.mp4',
    poster: '/tutorials/poster-vi.jpg',
    vtt: '/tutorials/guide-vi.vtt',
    duration: 134,
    chapters: [
      {
        id: 'overview',
        index: 1,
        start: 0,
        end: 33,
        title: 'Làm quen giao diện',
        summary: '5 mục chính, đổi ngôn ngữ VI/EN, Sáng/Tối và vòng tiến độ.',
        actionTab: 'dashboard',
        actionLabel: 'Trang chủ',
      },
      {
        id: 'study_hub',
        index: 2,
        start: 33,
        end: 76,
        title: 'Học trong Kho ôn tập',
        summary: 'Lọc chủ đề 2 tầng, 1 bài mẫu nhiều biến thể, Điền khuyết & MP3.',
        actionTab: 'library',
        actionLabel: 'Kho ôn tập',
      },
      {
        id: 'mock_exam',
        index: 3,
        start: 76,
        end: 112,
        title: 'Thi thử 15 câu với Eva',
        summary: 'Thi thật (ẩn đề, chấm cuối) vs Thi từ bộ đề (hiện đề, chấm ngay).',
        actionTab: 'mock_center',
        actionLabel: 'Thi thử',
      },
      {
        id: 'report',
        index: 4,
        start: 112,
        end: 134,
        title: 'Báo cáo AI & Tiến độ',
        summary: 'Biểu đồ Radar 6 tiêu chí, điểm mạnh, lỗi sửa, lộ trình 4 tuần & PDF.',
        actionTab: 'history',
        actionLabel: 'Tiến độ',
      },
    ],
    cues: [],
  },
  en: {
    video: '/tutorials/guide-en.mp4',
    poster: '/tutorials/poster-en.jpg',
    vtt: '/tutorials/guide-en.vtt',
    duration: 141,
    chapters: [
      {
        id: 'overview',
        index: 1,
        start: 0,
        end: 34,
        title: 'Studio Overview',
        summary: '5 main tabs, VI/EN mode, Light/Dark themes, and mastery ring.',
        actionTab: 'dashboard',
        actionLabel: 'Home',
      },
      {
        id: 'study_hub',
        index: 2,
        start: 34,
        end: 78,
        title: 'Master the Study Hub',
        summary: '2-tier topic filter, master scripts, Cloze drills, MP3 & Vocab.',
        actionTab: 'library',
        actionLabel: 'Study Hub',
      },
      {
        id: 'mock_exam',
        index: 3,
        start: 78,
        end: 116,
        title: '15-Question Mock Exam',
        summary: 'Real Exam (blind, final score) vs Study Pack (visible, instant).',
        actionTab: 'mock_center',
        actionLabel: 'Mock Test',
      },
      {
        id: 'report',
        index: 4,
        start: 116,
        end: 141,
        title: 'AI Report & Progress',
        summary: '6-criteria Radar chart, strengths, 4-week study plan & PDF export.',
        actionTab: 'history',
        actionLabel: 'Progress',
      },
    ],
    cues: [],
  },
};

const CHAPTER_ICONS = {
  overview: Home,
  study_hub: BookOpen,
  mock_exam: Mic,
  report: TrendingUp,
};

const CHAPTER_COLORS = {
  overview: 'from-indigo-500 to-sky-500',
  study_hub: 'from-emerald-500 to-teal-500',
  mock_exam: 'from-violet-500 to-fuchsia-500',
  report: 'from-amber-500 to-orange-500',
};

const formatTime = (sec) => {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const FaqGuideModal = ({ isOpen, onClose, faqs, pick }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl glass-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <MessageCircleQuestion className="w-5 h-5 text-indigo-600 dark:text-sky-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {pick('Câu hỏi thường gặp (FAQ)', 'Frequently Asked Questions')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={pick('Đóng', 'Close')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-3">
          {faqs.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800 flex flex-col gap-1.5"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {item.q}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-6">
                {item.a}
              </p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl btn-brand-gradient text-xs font-bold cursor-pointer"
          >
            {pick('Đã hiểu', 'Got It')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const GuidePage = ({
  onOpenDashboard,
  onOpenLibrary,
  onOpenRandom,
  onOpenMockCenter,
  onOpenHistory,
  onOpenRubric,
}) => {
  const { lang, isVi, pick } = useLanguage();
  const { pausePlayer } = useAudioPlayer();

  const videoRef = useRef(null);
  const playerWrapRef = useRef(null);

  const [meta, setMeta] = useState(FALLBACK_CHAPTERS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/tutorials/chapters.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && (data.vi || data.en)) {
          setMeta((prev) => ({
            vi: data.vi || prev.vi,
            en: data.en || prev.en,
          }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const track = meta[lang] || meta.vi;
  const chapters = track.chapters || [];
  const cues = track.cues || [];
  const totalDuration = duration || track.duration || 135;

  // Automatically switch video track whenever sidebar VI/EN language changes
  useEffect(() => {
    const vid = videoRef.current;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    setVideoError(false);
    if (vid) {
      vid.pause();
      vid.load();
      vid.playbackRate = speed;
    }
  }, [lang, track.video]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  const activeChapter = useMemo(() => {
    if (!chapters.length) return null;
    for (let i = chapters.length - 1; i >= 0; i -= 1) {
      if (currentTime >= chapters[i].start - 0.15) return chapters[i];
    }
    return chapters[0];
  }, [chapters, currentTime]);

  const activeCue = useMemo(() => {
    if (!showCaptions || !cues.length) return null;
    return cues.find((c) => currentTime >= c.start && currentTime <= c.end) || null;
  }, [showCaptions, cues, currentTime]);

  const togglePlay = async () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      pausePlayer();
      try {
        await vid.play();
      } catch {}
    } else {
      vid.pause();
    }
  };

  const seekTo = async (sec, autoPlay = false) => {
    const vid = videoRef.current;
    if (!vid) return;
    const clamped = Math.max(0, Math.min(totalDuration, sec));
    vid.currentTime = clamped;
    setCurrentTime(clamped);
    if (autoPlay) {
      pausePlayer();
      try {
        await vid.play();
      } catch {}
    }
  };

  const handleToggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
  };

  const handleFullscreen = () => {
    const vid = videoRef.current;
    const wrap = playerWrapRef.current;
    if (vid && typeof vid.webkitEnterFullscreen === 'function' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      vid.webkitEnterFullscreen();
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (wrap?.requestFullscreen) {
      wrap.requestFullscreen().catch(() => {});
    } else if (vid?.requestFullscreen) {
      vid.requestFullscreen().catch(() => {});
    }
  };

  const handleNavigateAction = (tabKey) => {
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    if (tabKey === 'dashboard' && onOpenDashboard) onOpenDashboard();
    else if (tabKey === 'library' && onOpenLibrary) onOpenLibrary();
    else if (tabKey === 'random' && onOpenRandom) onOpenRandom();
    else if (tabKey === 'mock_center' && onOpenMockCenter) onOpenMockCenter();
    else if (tabKey === 'history' && onOpenHistory) onOpenHistory();
  };

  const faqs = [
    {
      q: pick('Khác nhau giữa "Thi thật" và "Thi từ bộ đề" là gì?', 'What is the difference between "Real Exam" and "From Study Pack"?'),
      a: pick(
        'Cả hai đều đi qua 5 bước cài đặt giống nhau (Kiểm tra thiết bị → Khảo sát → 3 chủ đề → Mức độ → Khởi động). "Thi thật" tạo 15 câu AI mới, ẩn chữ câu hỏi và chấm toàn bộ ở cuối bài. "Thi từ bộ đề" lọc 15 câu khớp nhất từ Kho bạn đang học, hiện chữ câu hỏi và chấm chữa ngay sau từng câu.',
        'Both follow the same 5 setup steps (System Check → Survey → 3 Topics → Level → Warm-up). "Real Exam" creates 15 fresh AI questions with hidden prompts and final grading. "From Study Pack" filters 15 matching questions from your Study Hub with visible prompts and instant per-question AI coaching.'
      ),
    },
    {
      q: pick('Câu 1 (Tự giới thiệu) có bị chấm điểm không?', 'Is Question 1 (Self-Introduction) scored?'),
      a: pick(
        'Không. Giống hệt kỳ thi OPIc thực tế, Câu 1 là phần khởi động để làm quen giọng nói và không tính vào điểm cuối cùng (hệ thống chấm điểm từ Câu 2 đến Câu 15).',
        'No. Just like the real OPIc exam, Question 1 is a warm-up self-introduction and is never included in your final score (scoring covers Questions 2–15).'
      ),
    },
    {
      q: pick('Làm sao nghe bài mẫu khi tắt màn hình điện thoại?', 'How do I listen to model answers with my phone screen off?'),
      a: pick(
        'Vào Kho ôn tập → tab Nghe → chọn nhóm câu hỏi rồi bấm "Tạo bài nghe". Hệ thống ghép câu hỏi + bài mẫu thành 1 file MP3 liền mạch hỗ trợ điều khiển trên màn hình khóa và tải về nghe offline.',
        'Open Study Hub → Audio tab → select a topic group and click "Build Audio". The app compiles prompts and model answers into one seamless MP3 track with lock-screen controls and offline download.'
      ),
    },
    {
      q: pick('Micro không thu được tiếng thì xử lý thế nào?', 'What if my microphone does not record audio?'),
      a: pick(
        'Kiểm tra biểu tượng ổ khóa / micro trên thanh địa chỉ trình duyệt và chọn "Cho phép" (Allow) micro, sau đó thử lại ở Bước 1 (Kiểm tra Micro). Bạn nên dùng Chrome, Edge hoặc Safari bản mới nhất.',
        'Click the lock/microphone icon in your browser address bar, select "Allow" for microphone access, and retest in Step 1 (Microphone Check). Latest Chrome, Edge, or Safari works best.'
      ),
    },
  ];

  const progressPct = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 overflow-hidden overscroll-none bg-[#f3f6fc] dark:bg-[#090e1a] lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:dark:bg-transparent lg:h-full lg:overflow-hidden w-full max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6 flex flex-col">
      <div className="w-full flex-1 min-h-0 lg:max-h-[820px] lg:my-auto flex flex-col gap-2.5 sm:gap-4">
        {/* Compact Fixed Header: Title + 2 Clean Popup Buttons (FAQ & ACTFL Rubric) */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-sky-400">
              <HelpCircle className="w-3.5 h-3.5" />
              {pick('Hướng dẫn nhanh · ~2 phút', 'Quick Guided Tour · ~2 min')}
            </span>
            <h1 className="text-base sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {pick('Hướng dẫn sử dụng', 'User Guide')}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFaqOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <MessageCircleQuestion className="w-3.5 h-3.5 text-indigo-500 dark:text-sky-400 shrink-0" />
              <span>{pick('Hỏi đáp', 'FAQ')}</span>
            </button>

            {onOpenRubric && (
              <button
                type="button"
                onClick={onOpenRubric}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Award className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{pick('Thang điểm', 'Rubric')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Zero-Scroll Bounded 12-Col Studio Grid: Video Player (8 cols) + 4 Chapters (4 cols) */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2.5 sm:gap-4 items-stretch">
          {/* Video Theater Card */}
          <div
            ref={playerWrapRef}
            className="shrink-0 lg:shrink lg:col-span-8 lg:h-full lg:min-h-0 studio-surface rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl shadow-indigo-950/20 flex flex-col justify-between border border-slate-800"
          >
            {/* Video Stage: 16:9 on Mobile, Fluid Flex-1 on Desktop (Zero Clipping!) */}
            <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 lg:min-h-0 bg-[#070d1c] select-none overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                key={track.video}
                src={track.video}
                poster={track.poster}
                playsInline
                preload="metadata"
                onClick={togglePlay}
                onPlay={() => {
                  pausePlayer();
                  setIsPlaying(true);
                }}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (Number.isFinite(dur) && dur > 0) setDuration(dur);
                  e.currentTarget.playbackRate = speed;
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onError={() => setVideoError(true)}
                className="w-full h-full object-contain cursor-pointer"
              >
                {track.vtt && (
                  <track
                    kind="subtitles"
                    src={track.vtt}
                    srcLang={lang}
                    label={isVi ? 'Tiếng Việt' : 'English'}
                  />
                )}
              </video>

              {/* Top Active Chapter Pill */}
              {activeChapter && (
                <div className="pointer-events-none absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-bold text-white shadow-lg">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span>
                    {pick(`Chương ${activeChapter.index}`, `Ch. ${activeChapter.index}`)} · {activeChapter.title}
                  </span>
                </div>
              )}

              {/* Synced Subtitle Overlay */}
              {showCaptions && activeCue && (
                <div className="pointer-events-none absolute inset-x-2.5 sm:inset-x-5 bottom-2.5 sm:bottom-3.5 flex justify-center">
                  <div className="max-w-2xl px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 text-center text-[11px] sm:text-[13px] font-semibold text-white leading-snug shadow-xl">
                    {activeCue.text}
                  </div>
                </div>
              )}

              {/* Center Play Button Overlay */}
              {!isPlaying && !videoError && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={pick('Phát video hướng dẫn', 'Play tutorial video')}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/35 hover:bg-slate-950/25 transition-colors cursor-pointer"
                >
                  <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-teal-400 text-white flex items-center justify-center shadow-2xl shadow-sky-500/40 ring-4 ring-white/20 hover:scale-105 active:scale-95 transition-transform">
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-white/15 text-[11px] sm:text-xs font-extrabold text-white shadow-lg">
                    {currentTime > 1
                      ? pick('Tiếp tục xem', 'Resume Video')
                      : pick('Phát hướng dẫn chi tiết', 'Play Guided Tour')}
                  </span>
                </button>
              )}

              {videoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center bg-slate-950/90 text-slate-300">
                  <Sparkles className="w-7 h-7 text-sky-400" />
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {pick('Không tải được video hướng dẫn', 'Could not load tutorial video')}
                  </p>
                </div>
              )}
            </div>

            {/* Compact Studio Controls Bar */}
            <div className="px-3 sm:px-4 py-2.5 bg-[#0b1120] border-t border-white/10 flex flex-col gap-2 shrink-0">
              <div className="relative h-2 w-full rounded-full bg-slate-800 cursor-pointer flex items-center">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-teal-400 transition-[width] duration-100 pointer-events-none"
                  style={{ width: `${progressPct}%` }}
                />
                {chapters.slice(1).map((ch) => {
                  const leftPct = totalDuration > 0 ? (ch.start / totalDuration) * 100 : 0;
                  return (
                    <span
                      key={ch.id}
                      style={{ left: `${leftPct}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-950/90 pointer-events-none"
                    />
                  );
                })}
                <input
                  type="range"
                  min={0}
                  max={totalDuration}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => seekTo(Number(e.target.value), false)}
                  aria-label={pick('Thanh tiến độ video', 'Video progress')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-slate-200">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:brightness-110 text-white flex items-center justify-center cursor-pointer shadow-sm shrink-0"
                    aria-label={isPlaying ? pick('Tạm dừng', 'Pause') : pick('Phát', 'Play')}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime - 10, false)}
                    title={pick('Lùi 10 giây', 'Back 10s')}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime + 10, false)}
                    title={pick('Tua tới 10 giây', 'Forward 10s')}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <span className="ml-1 font-mono text-[10px] sm:text-[11px] font-bold text-slate-300 whitespace-nowrap">
                    {formatTime(currentTime)} <span className="text-slate-500">/</span> {formatTime(totalDuration)}
                  </span>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-white/10 text-[10px] sm:text-[11px]">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                          speed === s ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCaptions((v) => !v)}
                    title={pick('Bật/tắt phụ đề', 'Toggle captions')}
                    className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg border text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                      showCaptions
                        ? 'bg-teal-500/20 border-teal-400/50 text-teal-200'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Captions className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">CC</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMute}
                    title={muted ? pick('Bật tiếng', 'Unmute') : pick('Tắt tiếng', 'Mute')}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    title={pick('Toàn màn hình', 'Fullscreen')}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right 4-Chapter Interactive Panel (Fixed Equal-Height 4 Rows — Zero Scroll!) */}
          <div className="flex-1 min-h-0 lg:col-span-4 glass-panel rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-2.5 overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {pick('Mục lục 4 chương', '4 Guided Chapters')}
                </h2>
                <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {pick('Chạm chương bất kỳ để xem ngay', 'Tap any chapter to jump right in')}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-sky-300 text-[10px] sm:text-[11px] font-extrabold shrink-0">
                {formatTime(totalDuration)}
              </span>
            </div>

            <div className="flex-1 min-h-0 grid grid-rows-4 gap-1.5 sm:gap-2">
              {chapters.map((ch) => {
                const Icon = CHAPTER_ICONS[ch.id] || BookOpen;
                const grad = CHAPTER_COLORS[ch.id] || 'from-indigo-500 to-sky-500';
                const isActive = activeChapter?.id === ch.id;
                return (
                  <div
                    key={ch.id}
                    onClick={() => seekTo(ch.start, true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        seekTo(ch.start, true);
                      }
                    }}
                    className={`rounded-xl sm:rounded-2xl px-3 py-2 sm:p-3 border transition-all cursor-pointer flex flex-col justify-between gap-1 min-h-0 ${
                      isActive
                        ? 'bg-indigo-50/90 dark:bg-sky-500/15 border-indigo-300 dark:border-sky-400/50 shadow-sm'
                        : 'bg-white/85 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center shadow-xs shrink-0`}>
                          <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </span>
                        <p className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                          {ch.index}. {ch.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-extrabold ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          {formatTime(ch.start)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateAction(ch.actionTab);
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>{ch.actionLabel}</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                      {ch.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <FaqGuideModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
        faqs={faqs}
        pick={pick}
      />
    </div>
  );
};
