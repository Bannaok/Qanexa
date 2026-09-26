import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from './services/toastContext';
import { AuthProvider, useAuth } from './services/authContext';
import { ToastContainer } from './components/ToastContainer';
import { Navbar } from './components/Navbar';
import { MinimalHomeView } from './components/MinimalHomeView';
import { ExamList } from './components/ExamList';
import { AppSettingsModal } from './components/AppSettingsModal';
import { UserProfileModal } from './components/UserProfileModal';
import { LoginModal } from './components/LoginModal';
import { CreateExamModal } from './components/CreateExamModal';
import { ScannerModal } from './components/ScannerModal';
import { AnswerSheetView } from './components/AnswerSheetView';
import { PendingApprovalView } from './components/PendingApprovalView';
import { CenteredLoginForm } from './components/CenteredLoginForm';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { storageService } from './services/storageService';
import { AppSettings, Exam } from './types';

const MainAppContent: React.FC = () => {
  const { currentUser, isAuthenticated, isPending } = useAuth();
  const { info, warning } = useToast();

  // Tab: 'home' (2 minimal items: 1.ชุดข้อสอบ 2.สแกนคิวอาร์โค้ด) or 'exams'
  const [currentTab, setCurrentTab] = useState<'home' | 'exams'>('home');
  const [appSettings, setAppSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [exams, setExams] = useState<Exam[]>(() => storageService.getExams(storageService.getCurrentUser()));

  // Modals state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'members'>('general');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Active exam for scanning / printing
  const [activeScanExam, setActiveScanExam] = useState<Exam | null>(null);
  const [activePrintExam, setActivePrintExam] = useState<Exam | null>(null);

  const refreshExams = useCallback(() => {
    setExams(storageService.getExams(currentUser));
  }, [currentUser]);

  // When currentUser changes (e.g. login, switch account, admin login), immediately reload isolated exams
  useEffect(() => {
    refreshExams();
  }, [currentUser, refreshExams]);

  // Listen to cloud sync events and broadcast channel for immediate UI re-rendering
  useEffect(() => {
    const handleCloudSynced = () => {
      refreshExams();
      setAppSettings(storageService.getSettings());
    };

    window.addEventListener('examscan_cloud_synced', handleCloudSynced);
    window.addEventListener('storage', handleCloudSynced);

    return () => {
      window.removeEventListener('examscan_cloud_synced', handleCloudSynced);
      window.removeEventListener('storage', handleCloudSynced);
    };
  }, [refreshExams]);

  const handleOpenScan = (exam: Exam) => {
    if (!isAuthenticated) {
      info('กรุณาเข้าสู่ระบบก่อนเริ่มสแกนข้อสอบ');
      setIsLoginOpen(true);
      return;
    }
    setActiveScanExam(exam);
  };

  const handleQuickScanFromHome = () => {
    if (exams.length === 0) {
      warning('ยังไม่มีชุดข้อสอบในระบบ', 'กรุณาสร้างชุดข้อสอบและเฉลยก่อนเริ่มสแกน');
      setCurrentTab('exams');
      return;
    }
    // Launch scan on the most recently modified or created exam
    setActiveScanExam(exams[0]);
  };

  const handleOpenPrint = (exam: Exam) => {
    setActivePrintExam(exam);
  };

  const handleOpenEdit = (exam: Exam) => {
    if (isPending) {
      info('บัญชีของคุณยังอยู่ระหว่างรออนุมัติสิทธิ์');
      return;
    }
    setEditingExam(exam);
    setIsCreateExamOpen(true);
  };

  const handleOpenCreateNew = () => {
    if (!isAuthenticated) {
      info('กรุณาเข้าสู่ระบบเพื่อสร้างชุดข้อสอบ');
      setIsLoginOpen(true);
      return;
    }
    if (isPending) {
      info('บัญชีของคุณยังอยู่ระหว่างรออนุมัติสิทธิ์');
      return;
    }
    setEditingExam(null);
    setIsCreateExamOpen(true);
  };

  const handleOpenSettingsWithTab = (tab: 'general' | 'members' = 'general') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-800">
      <ToastContainer />

      {/* PWA Mobile Install Banner */}
      <PWAInstallPrompt />

      {/* Top Navbar with Home Button on the top left */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        appSettings={appSettings}
        onOpenSettings={() => handleOpenSettingsWithTab('general')}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenMembers={() => handleOpenSettingsWithTab('members')}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
        {/* State 1: User Logged In but Pending Approval */}
        {isAuthenticated && isPending && (
          <PendingApprovalView onOpenLogin={() => setIsLoginOpen(true)} />
        )}

        {/* State 2: Directly Centered Login Form when not logged in */}
        {!isAuthenticated && (
          <CenteredLoginForm appSettings={appSettings} />
        )}

        {/* State 3: User Logged In and Approved */}
        {isAuthenticated && !isPending && (
          <div className="flex-1 flex flex-col">
            {/* View 1: Clean Minimal Home with 2 Primary Items (1. ชุดข้อสอบ 2. สแกนคิวอาร์โค้ด) */}
            {currentTab === 'home' && (
              <MinimalHomeView
                exams={exams}
                onNavigateToExams={() => setCurrentTab('exams')}
                onOpenQuickScan={handleQuickScanFromHome}
              />
            )}

            {/* View 2: Exam List */}
            {currentTab === 'exams' && (
              <ExamList
                exams={exams}
                onOpenCreate={handleOpenCreateNew}
                onEditExam={handleOpenEdit}
                onScanExam={handleOpenScan}
                onPrintExam={handleOpenPrint}
                onExamsUpdated={refreshExams}
                onGoHome={() => setCurrentTab('home')}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">{appSettings.appName}</span>
            <span>•</span>
            <span>{appSettings.organizationName}</span>
          </div>

          <div className="text-slate-400">
            ระบบตรวจกระดาษคำตอบ ปรนัย 3, 4, 5 ตัวเลือก (OMR Engine) • ซิงค์อัตโนมัติความเร็วสูงผ่าน Cloudflare D1
          </div>
        </div>
      </footer>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        appSettings={appSettings}
      />

      <AppSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={(updated) => setAppSettings(updated)}
        initialTab={settingsTab}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <CreateExamModal
        isOpen={isCreateExamOpen}
        onClose={() => {
          setIsCreateExamOpen(false);
          setEditingExam(null);
        }}
        onExamCreated={refreshExams}
        examToEdit={editingExam}
      />

      {/* Full Screen Scanner Modal */}
      {activeScanExam && (
        <ScannerModal
          isOpen={!!activeScanExam}
          exam={activeScanExam}
          onClose={() => setActiveScanExam(null)}
          onScanSaved={refreshExams}
        />
      )}

      {/* Printable Answer Sheet Modal / View */}
      {activePrintExam && (
        <AnswerSheetView
          exam={activePrintExam}
          appSettings={appSettings}
          onClose={() => setActivePrintExam(null)}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
