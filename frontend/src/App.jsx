import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { RubricGuideModal } from './components/RubricGuideModal';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SystemCheck } from './pages/SystemCheck';
import { Survey } from './pages/Survey';
import { SelfAssessment } from './pages/SelfAssessment';
import { TopicSelection } from './pages/TopicSelection';
import { PreTestSetup } from './pages/PreTestSetup';
import { TestSession } from './pages/TestSession';
import { SessionReport } from './pages/SessionReport';
import { HistoryPage } from './pages/HistoryPage';
import { QuestionLibrary } from './pages/QuestionLibrary';

import { sessionApi } from './api/client';

export const App = () => {
  const { user, loading } = useAuth();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionMode, setActiveSessionMode] = useState('practice'); // 'exam' or 'practice'
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading OPIc Practice Studio...</p>
      </div>
    );
  }

  // Not logged in -> show Login
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Navbar currentTab="login" setTab={setCurrentTab} onOpenRubric={() => setIsRubricModalOpen(true)} />
        <main className="flex-1">
          <Login onLoginSuccess={() => setCurrentTab('dashboard')} />
        </main>
        <Footer />
        <RubricGuideModal isOpen={isRubricModalOpen} onClose={() => setIsRubricModalOpen(false)} />
      </div>
    );
  }

  // Start new test flow
  const handleStartNewTest = async (mode) => {
    setActiveSessionMode(mode);
    try {
      const res = await sessionApi.create({ mode });
      setActiveSessionId(res.data.id);
      setCurrentTab('system_check');
    } catch (err) {
      console.error("Failed to initialize test session", err);
    }
  };

  const handleResumeSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    try {
      const res = await sessionApi.getStatus(sessionId);
      if (res.data?.mode) setActiveSessionMode(res.data.mode);
    } catch (err) {
      console.warn("Could not load session mode", err);
    }
    setCurrentTab('test');
  };

  const handleViewReport = (sessionId) => {
    setActiveSessionId(sessionId);
    setCurrentTab('report');
  };

  const isExamScreen = currentTab === 'test';

  return (
    <div className={
      isExamScreen
        ? "h-dvh w-full overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none"
        : "min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
    }>
      
      {/* Top Navbar (Hidden in Test Mode) */}
      {!isExamScreen && (
        <Navbar
          currentTab={currentTab}
          setTab={setCurrentTab}
          onOpenRubric={() => setIsRubricModalOpen(true)}
        />
      )}

      {/* Main Screen Router */}
      <main className={isExamScreen ? "flex-1 w-full min-h-0 flex flex-col items-center overflow-y-auto" : "flex-1"}>
        {currentTab === 'dashboard' && (
          <Dashboard
            onStartTest={handleStartNewTest}
            onResumeSession={handleResumeSession}
            onViewReport={handleViewReport}
          />
        )}

        {currentTab === 'system_check' && (
          <SystemCheck
            onAllChecksPassed={() => setCurrentTab('survey')}
          />
        )}

        {currentTab === 'survey' && (
          <Survey
            sessionId={activeSessionId}
            onSurveyCompleted={() => setCurrentTab('topic_selection')}
          />
        )}

        {currentTab === 'topic_selection' && (
          <TopicSelection
            sessionId={activeSessionId}
            onTopicsConfirmed={() => setCurrentTab('self_assessment')}
          />
        )}

        {currentTab === 'self_assessment' && (
          <SelfAssessment
            sessionId={activeSessionId}
            defaultStrict={activeSessionMode === 'exam'}
            onAssessmentCompleted={(mode) => {
              if (mode) setActiveSessionMode(mode);
              setCurrentTab('pre_test');
            }}
          />
        )}

        {currentTab === 'pre_test' && (
          <PreTestSetup
            onStartExam={() => setCurrentTab('test')}
          />
        )}

        {currentTab === 'test' && (
          <TestSession
            sessionId={activeSessionId}
            sessionMode={activeSessionMode}
            onTestComplete={() => setCurrentTab('report')}
            onExit={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'report' && (
          <SessionReport
            sessionId={activeSessionId}
            onReturnHome={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'library' && <QuestionLibrary />}

        {currentTab === 'history' && (
          <HistoryPage
            onViewReport={handleViewReport}
            onResumeSession={handleResumeSession}
          />
        )}
      </main>

      {/* Footer with ACTFL/LTI non-affiliation disclaimer (Hidden in Test Mode) */}
      {!isExamScreen && <Footer />}

      {/* Rubric Guide Modal */}
      <RubricGuideModal
        isOpen={isRubricModalOpen}
        onClose={() => setIsRubricModalOpen(false)}
      />

    </div>
  );
};
export default App;
