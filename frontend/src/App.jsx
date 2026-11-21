import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { AudioPlayerProvider, GlobalAudioPlayerBar, useAudioPlayer } from './context/AudioPlayerContext';
import { NotificationProvider, notify } from './context/NotificationContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { RubricGuideModal } from './components/RubricGuideModal';
import { ScrollToTopButton, scrollPageToTop } from './components/ScrollToTopButton';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MockTestCenter } from './pages/MockTestCenter';
import { SystemCheck } from './pages/SystemCheck';
import { Survey, USER_DEFAULT_PRESET } from './pages/Survey';
import { SelfAssessment } from './pages/SelfAssessment';
import { TopicSelection } from './pages/TopicSelection';
import { PreTestSetup } from './pages/PreTestSetup';
import { TestSession } from './pages/TestSession';
import { SessionReport } from './pages/SessionReport';
import { HistoryPage } from './pages/HistoryPage';
import { QuestionLibrary } from './pages/QuestionLibrary';
import { DailyWorkout } from './pages/DailyWorkout';
import { GuidePage } from './pages/GuidePage';

import { sessionApi, formatApiError } from './api/client';

const TEST_FLOW_TABS = ['system_check', 'survey', 'topic_selection', 'self_assessment', 'pre_test', 'test'];
const VIEWPORT_LOCKED_TABS = [
  'dashboard',
  'library',
  'mock_center',
  'history',
  'guide',
  'system_check',
  'survey',
  'topic_selection',
  'self_assessment',
  'pre_test',
];

const AppShell = () => {
  const { user, loading } = useAuth();
  const { pick } = useLanguage();
  const { pausePlayer } = useAudioPlayer();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('opic_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('opic_sidebar_collapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  const [currentTab, setCurrentTab] = useState(() => {
    const saved = sessionStorage.getItem('opic_active_tab') || 'dashboard';
    return saved === 'vocabulary' ? 'library' : saved;
  });
  const [librarySubTab, setLibrarySubTab] = useState('topics');
  const [libraryGroupIntent, setLibraryGroupIntent] = useState(null);
  const [openFlashcardsIntent, setOpenFlashcardsIntent] = useState(false);
  const [openRandomIntent, setOpenRandomIntent] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = sessionStorage.getItem('opic_active_session_id');
    const num = Number(saved);
    return Number.isInteger(num) && num > 0 ? num : null;
  });
  const [activeSessionMode, setActiveSessionMode] = useState(() => {
    return sessionStorage.getItem('opic_active_session_mode') || 'exam';
  });
  const [activeExamSource, setActiveExamSource] = useState(() => {
    return sessionStorage.getItem('opic_active_exam_source') || 'ai';
  });
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [sessionSetup, setSessionSetup] = useState({});

  const isExamScreen = currentTab === 'test' && !!user;
  const isViewportLockedTab = VIEWPORT_LOCKED_TABS.includes(currentTab) && !isExamScreen;

  useEffect(() => {
    document.documentElement.classList.toggle('exam-locked', isExamScreen);
    if (isExamScreen) pausePlayer();
    return () => document.documentElement.classList.remove('exam-locked');
  }, [isExamScreen]);

  useEffect(() => {
    if (activeSessionId) {
      sessionStorage.setItem('opic_active_session_id', String(activeSessionId));
    } else {
      sessionStorage.removeItem('opic_active_session_id');
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (activeSessionMode) {
      sessionStorage.setItem('opic_active_session_mode', activeSessionMode);
    }
  }, [activeSessionMode]);

  useEffect(() => {
    if (activeExamSource) {
      sessionStorage.setItem('opic_active_exam_source', activeExamSource);
    }
  }, [activeExamSource]);

  useEffect(() => {
    sessionStorage.setItem('opic_active_tab', currentTab);
    scrollPageToTop('instant');
  }, [currentTab]);

  const isCreatingSessionRef = useRef(false);

  useEffect(() => {
    if (user && TEST_FLOW_TABS.includes(currentTab) && !activeSessionId && !isCreatingSessionRef.current) {
      isCreatingSessionRef.current = true;
      sessionApi
        .create({ mode: activeSessionMode || 'practice' })
        .then((res) => setActiveSessionId(res.data.id))
        .catch((err) => {
          console.error('Auto session initialization failed:', err);
          setCurrentTab('dashboard');
        })
        .finally(() => {
          isCreatingSessionRef.current = false;
        });
    }
  }, [user, currentTab, activeSessionId, activeSessionMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {pick('Đang tải OPIc Practice Studio...', 'Loading OPIc Practice Studio...')}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-dvh overflow-hidden">
        <Login onLoginSuccess={() => setCurrentTab('dashboard')} />
      </div>
    );
  }

  const handleStartNewTest = async (mode, source = 'ai') => {
    if (isCreatingSessionRef.current) return;
    isCreatingSessionRef.current = true;
    const resolvedMode = source === 'pack' ? 'practice' : (mode || 'exam');
    setActiveSessionMode(resolvedMode);
    setActiveExamSource(source);
    try {
      const res = await sessionApi.create({ mode: resolvedMode });
      setActiveSessionId(res.data.id);
      setSessionSetup({});
      // Both Block 1 (Real Exam) & Block 2 (Filter from Study Pack) walk through the exact same setup steps
      setCurrentTab('system_check');
    } catch (err) {
      notify.error(formatApiError(err, 'Không thể khởi tạo bài thi. Vui lòng thử lại.'));
    } finally {
      isCreatingSessionRef.current = false;
    }
  };

  const handleDeleteSession = (deletedSessionId) => {
    if (activeSessionId === deletedSessionId) {
      setActiveSessionId(null);
      sessionStorage.removeItem('opic_active_session_id');
      if (TEST_FLOW_TABS.includes(currentTab) || currentTab === 'report') {
        setCurrentTab('dashboard');
      }
    }
  };

  const handleResumeSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    let nextTab = 'test';
    try {
      const { data } = await sessionApi.getStatus(sessionId);
      if (data?.mode) {
        setActiveSessionMode(data.mode);
        setActiveExamSource(data.mode === 'practice' ? 'pack' : 'ai');
      }
      setSessionSetup({ topics: data?.topics || null, level: data?.self_assessment_level || null });
      if (!data?.total_questions) {
        if (!data?.has_survey) nextTab = 'survey';
        else if (!data?.topics || data.topics.length !== 3) nextTab = 'topic_selection';
        else nextTab = 'self_assessment';
      }
    } catch {}
    setCurrentTab(nextTab);
  };

  const navigate = (tab) => {
    if (tab === 'vocabulary') {
      setLibrarySubTab('vocab');
      setCurrentTab('library');
      return;
    }
    setCurrentTab(tab);
  };

  const handleViewReport = (sessionId) => {
    setActiveSessionId(sessionId);
    setCurrentTab('report');
  };

  const handleReturnHome = () => {
    setActiveSessionId(null);
    sessionStorage.removeItem('opic_active_session_id');
    setCurrentTab('dashboard');
  };

  const desktopSidebarPad = sidebarCollapsed ? 'lg:pl-11' : 'lg:pl-60';

  return (
    <div
      className={
        isExamScreen
          ? 'h-dvh w-full overflow-hidden flex flex-col select-none'
          : isViewportLockedTab
            ? `min-h-dvh lg:h-dvh lg:overflow-hidden flex flex-col transition-[padding,colors] duration-200 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 ${desktopSidebarPad}`
            : `min-h-dvh flex flex-col transition-[padding,colors] duration-200 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 ${desktopSidebarPad}`
      }
    >
      {!isExamScreen && (
        <Navbar
          currentTab={currentTab}
          setTab={navigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      )}

      <main
        className={
          isExamScreen
            ? 'flex-1 w-full min-h-0 flex flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain'
            : isViewportLockedTab
              ? 'flex-1 min-w-0 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden'
              : 'flex-1 min-w-0'
        }
      >
        {currentTab === 'dashboard' && (
          <Dashboard
            onStartTest={handleStartNewTest}
            onOpenLibrary={() => {
              setLibrarySubTab('topics');
              setLibraryGroupIntent('all');
              setCurrentTab('library');
            }}
            onOpenLibraryGroup={(grp) => {
              setLibrarySubTab('topics');
              setLibraryGroupIntent(grp);
              setCurrentTab('library');
            }}
            onOpenFlashcards={() => {
              setLibrarySubTab('topics');
              setOpenFlashcardsIntent(true);
              setCurrentTab('library');
            }}
            onOpenRandomPractice={() => {
              setLibrarySubTab('topics');
              setOpenRandomIntent(true);
              setCurrentTab('library');
            }}
            onOpenMockCenter={() => setCurrentTab('mock_center')}
          />
        )}

        {currentTab === 'mock_center' && (
          <MockTestCenter
            onStartTest={handleStartNewTest}
            onStartPackExam={(examSessionId, mode) => {
              setActiveSessionId(examSessionId);
              setActiveSessionMode(mode || 'exam');
              setCurrentTab('test');
            }}
            onOpenLibrary={() => {
              setLibrarySubTab('topics');
              setCurrentTab('library');
            }}
          />
        )}

        {currentTab === 'daily' && <DailyWorkout onBack={() => setCurrentTab('dashboard')} />}

        {currentTab === 'system_check' && <SystemCheck onAllChecksPassed={() => setCurrentTab('survey')} />}

        {currentTab === 'survey' && (
          <Survey sessionId={activeSessionId} onSurveyCompleted={() => setCurrentTab('topic_selection')} />
        )}

        {currentTab === 'topic_selection' && (
          <TopicSelection
            sessionId={activeSessionId}
            initialTopics={sessionSetup.topics}
            onTopicsConfirmed={() => setCurrentTab('self_assessment')}
          />
        )}

        {currentTab === 'self_assessment' && (
          <SelfAssessment
            sessionId={activeSessionId}
            fromStudyPack={activeExamSource === 'pack'}
            initialLevel={sessionSetup.level}
            onAssessmentCompleted={(mode) => {
              if (mode) setActiveSessionMode(mode);
              setCurrentTab('pre_test');
            }}
          />
        )}

        {currentTab === 'pre_test' && <PreTestSetup onStartExam={() => setCurrentTab('test')} />}

        {currentTab === 'test' && (
          <TestSession
            sessionId={activeSessionId}
            sessionMode={activeSessionMode}
            onTestComplete={() => setCurrentTab('report')}
            onExit={handleReturnHome}
          />
        )}

        {currentTab === 'report' && (
          <SessionReport sessionId={activeSessionId} onReturnHome={handleReturnHome} />
        )}

        {currentTab === 'library' && (
          <QuestionLibrary
            initialSubTab={librarySubTab}
            initialGroupFilter={libraryGroupIntent}
            autoOpenFlashcards={openFlashcardsIntent}
            autoOpenRandom={openRandomIntent}
            onConsumeIntent={() => {
              setOpenFlashcardsIntent(false);
              setOpenRandomIntent(false);
              setLibraryGroupIntent(null);
            }}
            onOpenDaily={() => {
              setLibrarySubTab('topics');
              setOpenRandomIntent(true);
            }}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPage
            onViewReport={handleViewReport}
            onResumeSession={handleResumeSession}
            onDeleteSession={handleDeleteSession}
          />
        )}

        {currentTab === 'guide' && (
          <GuidePage
            onOpenDashboard={() => setCurrentTab('dashboard')}
            onOpenLibrary={() => {
              setLibrarySubTab('topics');
              setLibraryGroupIntent('all');
              setCurrentTab('library');
            }}
            onOpenRandom={() => {
              setLibrarySubTab('topics');
              setOpenRandomIntent(true);
              setCurrentTab('library');
            }}
            onOpenMockCenter={() => setCurrentTab('mock_center')}
            onOpenHistory={() => setCurrentTab('history')}
            onOpenRubric={() => setIsRubricModalOpen(true)}
          />
        )}
      </main>

      {/* Global Persistent Dark-Ink Audio Studio Bar (keeps playing across all tabs!) */}
      <GlobalAudioPlayerBar
        hidden={isExamScreen}
        sidebarCollapsed={sidebarCollapsed}
        onOpenListeningTab={() => {
          setLibrarySubTab('listening');
          setCurrentTab('library');
        }}
      />

      {!isExamScreen && <Footer desktopHidden={isViewportLockedTab} />}
      {!isViewportLockedTab && <ScrollToTopButton hasBottomNav={!isExamScreen} />}
      <RubricGuideModal isOpen={isRubricModalOpen} onClose={() => setIsRubricModalOpen(false)} />
    </div>
  );
};

export const App = () => {
  const { user } = useAuth();
  return (
    <NotificationProvider>
      <AudioPlayerProvider enabled={!!user}>
        <AppShell />
      </AudioPlayerProvider>
    </NotificationProvider>
  );
};

export default App;
