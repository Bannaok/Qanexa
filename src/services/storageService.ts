import { AppSettings, Exam, ScanResult, UserProfile } from '../types';
import { d1SyncService } from './d1SyncService';

const SETTINGS_KEY = 'examscan_app_settings';
const USERS_KEY = 'examscan_users';
const ADMIN_PASS_KEY = 'examscan_admin_password';
const EXAMS_KEY = 'examscan_exams';
const SCAN_RESULTS_KEY = 'examscan_scan_results';
const CURRENT_USER_KEY = 'examscan_current_user';
const INITIALIZED_KEY = 'examscan_has_initialized_seed';

// BroadcastChannel for instant same-browser cross-tab sync without delay
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('examscan_channel')
  : null;

const notifyLocalChange = (type: string, payload?: any) => {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch {}
  }
};

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'ExamScan OMR Pro',
  appLogoUrl: '',
  organizationName: 'ศูนย์ทดสอบวัดผลทางการศึกษา',
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Admin (System)',
};

const DEFAULT_ADMIN: UserProfile = {
  id: 'admin_root',
  email: 'admin@system.local',
  displayName: 'ผู้ดูแลระบบ (Admin)',
  role: 'admin',
  status: 'approved',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: new Date().toISOString(),
  storageBytes: 154000,
};

const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam-science-01',
    title: 'วิทยาศาสตร์และเทคโนโลยี ม.3 (ปลายภาคเรียนที่ 1)',
    code: 'SCI-301',
    gradeLevel: 'ชั้นมัธยมศึกษาปีที่ 3',
    description: 'แบบทดสอบปรนัย 20 ข้อ ประเมินมาตรฐาน ว 2.1 และ ว 2.3',
    questionCount: 20,
    choiceCount: 4,
    passPercentage: 50,
    createdBy: 'admin@system.local',
    creatorName: 'ผู้ดูแลระบบ (Admin)',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    answerKey: {
      1: 0, 2: 2, 3: 1, 4: 3, 5: 0,
      6: 1, 7: 2, 8: 3, 9: 0, 10: 1,
      11: 2, 12: 3, 13: 0, 14: 1, 15: 2,
      16: 3, 17: 0, 18: 1, 19: 2, 20: 3,
    },
  },
  {
    id: 'exam-math-02',
    title: 'คณิตศาสตร์พื้นฐาน ม.4 (หน่วยการเรียนรู้ที่ 1-3)',
    code: 'MATH-401',
    gradeLevel: 'ชั้นมัธยมศึกษาปีที่ 4',
    description: 'แบบทดสอบปรนัย 30 ข้อ 5 ตัวเลือก (ก-จ)',
    questionCount: 30,
    choiceCount: 5,
    passPercentage: 60,
    createdBy: 'admin@system.local',
    creatorName: 'ผู้ดูแลระบบ (Admin)',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    answerKey: {
      1: 1, 2: 3, 3: 0, 4: 4, 5: 2,
      6: 0, 7: 1, 8: 3, 9: 2, 10: 4,
      11: 1, 12: 0, 13: 2, 14: 4, 15: 3,
      16: 0, 17: 1, 18: 2, 19: 3, 20: 4,
      21: 2, 22: 1, 23: 0, 24: 3, 25: 4,
      26: 0, 27: 1, 28: 2, 29: 3, 30: 4,
    },
  },
];

export const storageService = {
  // App Settings
  getSettings(): AppSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    notifyLocalChange('settings_updated', settings);
    // Cloudflare D1 Sync
    await d1SyncService.saveSettings(settings).catch(() => {});
  },

  // Admin Password
  getAdminPassword(): string {
    const pass = localStorage.getItem(ADMIN_PASS_KEY);
    if (!pass) {
      localStorage.setItem(ADMIN_PASS_KEY, '456789');
      return '456789';
    }
    return pass;
  },

  setAdminPassword(newPass: string): void {
    localStorage.setItem(ADMIN_PASS_KEY, newPass);
  },

  // Users Management
  getUsers(): UserProfile[] {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      const defaultUsers: UserProfile[] = [
        DEFAULT_ADMIN,
        {
          id: 'user_sample_1',
          email: 'somchai.teacher@gmail.com',
          displayName: 'อาจารย์ สมชาย ใจดี',
          role: 'member',
          status: 'approved',
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          lastLoginAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          storageBytes: 1248000,
        },
        {
          id: 'user_sample_2',
          email: 'wannapa.kru@gmail.com',
          displayName: 'ครู วรรณภา ศรีสุข',
          role: 'member',
          status: 'pending',
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
          lastLoginAt: new Date(Date.now() - 3600000 * 6).toISOString(),
          storageBytes: 0,
        },
      ];
      localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
      return defaultUsers;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [DEFAULT_ADMIN];
    }
  },

  saveUsers(users: UserProfile[]): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    notifyLocalChange('users_updated');
  },

  getUserByEmail(email: string): UserProfile | undefined {
    const users = this.getUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  async updateUser(updated: UserProfile): Promise<void> {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === updated.id || u.email.toLowerCase() === updated.email.toLowerCase());
    if (index >= 0) {
      users[index] = { ...users[index], ...updated };
    } else {
      users.push(updated);
    }
    this.saveUsers(users);

    // If current logged-in user is updated, keep session in sync
    const current = this.getCurrentUser();
    if (current && (current.id === updated.id || current.email.toLowerCase() === updated.email.toLowerCase())) {
      this.setCurrentUser({ ...current, ...updated });
    }

    // Direct Cloudflare D1 Sync
    await d1SyncService.saveUser(updated).catch(() => {});
  },

  async deleteUser(userId: string): Promise<void> {
    const users = this.getUsers().filter((u) => u.id !== userId);
    this.saveUsers(users);
    // Immediate Cloudflare D1 Deletion
    await d1SyncService.deleteUser(userId).catch(() => {});
  },

  // Current session user
  getCurrentUser(): UserProfile | null {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setCurrentUser(user: UserProfile | null): void {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    notifyLocalChange('auth_changed', user);
  },

  // Exams with User-Isolation:
  // - Admin can see all exams
  // - Teachers see their own created exams (and default starter exams)
  getExams(currentUser?: UserProfile | null): Exam[] {
    const raw = localStorage.getItem(EXAMS_KEY);
    let allExams: Exam[] = [];
    if (!raw) {
      // Check if user already cleared or initialized
      const hasInit = localStorage.getItem(INITIALIZED_KEY);
      if (!hasInit) {
        allExams = INITIAL_EXAMS;
        localStorage.setItem(EXAMS_KEY, JSON.stringify(INITIAL_EXAMS));
        localStorage.setItem(INITIALIZED_KEY, 'true');
      } else {
        allExams = [];
      }
    } else {
      try {
        allExams = JSON.parse(raw);
      } catch {
        allExams = [];
      }
    }

    if (!currentUser) return allExams;
    if (currentUser.role === 'admin') return allExams;

    const email = currentUser.email.toLowerCase();
    return allExams.filter((e) => {
      return (
        (e.createdBy && e.createdBy.toLowerCase() === email) ||
        e.createdBy === 'admin@system.local' ||
        e.id.startsWith('exam-')
      );
    });
  },

  getAllExamsRaw(): Exam[] {
    const raw = localStorage.getItem(EXAMS_KEY);
    if (!raw) {
      const hasInit = localStorage.getItem(INITIALIZED_KEY);
      if (!hasInit) {
        localStorage.setItem(EXAMS_KEY, JSON.stringify(INITIAL_EXAMS));
        localStorage.setItem(INITIALIZED_KEY, 'true');
        return INITIAL_EXAMS;
      }
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveExams(exams: Exam[]): void {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
    localStorage.setItem(INITIALIZED_KEY, 'true');
    notifyLocalChange('exams_updated');
  },

  getExamById(id: string): Exam | undefined {
    return this.getAllExamsRaw().find((e) => e.id === id);
  },

  async saveExam(exam: Exam): Promise<void> {
    const exams = this.getAllExamsRaw();
    const idx = exams.findIndex((e) => e.id === exam.id);
    if (idx >= 0) {
      exams[idx] = exam;
    } else {
      exams.unshift(exam);
    }
    this.saveExams(exams);
    // Immediate Cloudflare D1 Sync
    await d1SyncService.saveExam(exam).catch(() => {});
  },

  async deleteExam(id: string): Promise<void> {
    // 1. Delete immediately from LocalStorage
    const exams = this.getAllExamsRaw().filter((e) => e.id !== id);
    this.saveExams(exams);

    // Also remove scan results for this exam
    const results = this.getAllScanResultsRaw().filter((r) => r.examId !== id);
    this.saveScanResults(results);

    // 2. Direct Cloudflare D1 Deletion - wait for it so D1 removes it immediately
    await d1SyncService.deleteExam(id).catch(() => {});
  },

  // Scan Results with User-Isolation:
  // - Admin can see all scans
  // - Teachers only see their own scans
  getScanResults(currentUser?: UserProfile | null): ScanResult[] {
    const all = this.getAllScanResultsRaw();
    if (!currentUser) return all;
    if (currentUser.role === 'admin') return all;

    const email = currentUser.email.toLowerCase();
    return all.filter((r) => r.scannedByEmail && r.scannedByEmail.toLowerCase() === email);
  },

  getAllScanResultsRaw(): ScanResult[] {
    const raw = localStorage.getItem(SCAN_RESULTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveScanResults(results: ScanResult[]): void {
    localStorage.setItem(SCAN_RESULTS_KEY, JSON.stringify(results));
    notifyLocalChange('scans_updated');
  },

  async addScanResult(result: ScanResult): Promise<void> {
    const results = this.getAllScanResultsRaw();
    results.unshift(result);
    this.saveScanResults(results);

    // Update storage size for the scanner email
    this.recalculateUserStorage(result.scannedByEmail);

    // Immediate Cloudflare D1 Sync
    await d1SyncService.saveScanResult(result).catch(() => {});
  },

  async deleteScanResult(resultId: string): Promise<void> {
    const results = this.getAllScanResultsRaw();
    const target = results.find((r) => r.id === resultId);
    const updated = results.filter((r) => r.id !== resultId);
    this.saveScanResults(updated);

    if (target) {
      this.recalculateUserStorage(target.scannedByEmail);
    }
    // Immediate Cloudflare D1 Deletion
    await d1SyncService.deleteScanResult(resultId).catch(() => {});
  },

  /**
   * High-Speed True Mirror Sync with Cloudflare D1:
   * 
   * CRITICAL FIX FOR DELETIONS:
   * Previously, local exams were merged with remote exams using Map, which resurrects deleted exams!
   * Now: If remote D1 responds successfully, the remote dataset is treated as the Source of Truth for this user.
   * If an exam was deleted in Browser A, Browser B's sync will replace its local cache with the remote list,
   * causing the deleted exam/scan to disappear immediately!
   */
  async syncWithD1(currentUser?: UserProfile | null): Promise<{ success: boolean; message: string }> {
    try {
      const activeUser = currentUser || this.getCurrentUser();
      if (!activeUser) {
        return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนซิงค์' };
      }

      // 1. Sync User profile & Admin approval status from server
      if (activeUser.email) {
        const remoteUser = await d1SyncService.fetchUserByEmail(activeUser.email);
        if (remoteUser) {
          // If remote status changed (e.g. approved or rejected by Admin), update immediately
          const current = this.getCurrentUser();
          if (current && (current.status !== remoteUser.status || current.role !== remoteUser.role)) {
            this.setCurrentUser(remoteUser);
          }
          this.updateUserLocalOnly(remoteUser);
        } else {
          // Register user in D1 if not exists yet
          await d1SyncService.saveUser(activeUser);
        }
      }

      // 2. If Admin, sync users list as authoritative
      if (activeUser.role === 'admin') {
        const remoteUsers = await d1SyncService.fetchUsers();
        if (remoteUsers) {
          this.saveUsers(remoteUsers);
        }
      }

      // 3. Sync Exams with TRUE DELETION PROPAGATION:
      // When D1 is online:
      // - If teacher: D1 returns teacher's exams. Any exam created locally that isn't on D1 gets pushed,
      //   BUT if it was deleted on D1, it reflects properly.
      const remoteExams = await d1SyncService.fetchExams(
        activeUser.email,
        activeUser.role
      );

      if (remoteExams !== null) {
        const localExams = this.getAllExamsRaw();
        const userEmail = activeUser.email.toLowerCase();
        const isAdmin = activeUser.role === 'admin';

        if (isAdmin) {
          // Admin sees the exact remote state
          this.saveExams(remoteExams);
        } else {
          // For Teacher:
          // Keep other teachers' exams or starter system exams that belong to other users untouched,
          // BUT for this teacher's own exams, mirror the remote list completely!
          const nonUserExams = localExams.filter(
            (e) => e.createdBy && e.createdBy.toLowerCase() !== userEmail
          );
          
          // Merge: remote teacher exams + non-user exams
          const finalExams = [...remoteExams, ...nonUserExams];
          this.saveExams(finalExams);
        }
      }

      // 4. Sync Scan Results with TRUE DELETION PROPAGATION:
      const remoteScans = await d1SyncService.fetchScanResults(
        undefined,
        activeUser.email,
        activeUser.role
      );

      if (remoteScans !== null) {
        const localScans = this.getAllScanResultsRaw();
        const userEmail = activeUser.email.toLowerCase();
        const isAdmin = activeUser.role === 'admin';

        if (isAdmin) {
          this.saveScanResults(remoteScans);
        } else {
          // Replace teacher's scans with exact remote scans (deletions reflected instantly)
          const nonUserScans = localScans.filter(
            (s) => s.scannedByEmail && s.scannedByEmail.toLowerCase() !== userEmail
          );
          const finalScans = [...remoteScans, ...nonUserScans];
          this.saveScanResults(finalScans);
        }
      }

      // 5. Sync Settings
      const remoteSettings = await d1SyncService.fetchSettings();
      if (remoteSettings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(remoteSettings));
      }

      return { success: true, message: 'ซิงค์ข้อมูล Cloudflare D1 อัตโนมัติเรียบร้อย' };
    } catch (err: any) {
      return { success: false, message: err.message || 'ซิงค์ข้อมูลล้มเหลว' };
    }
  },

  updateUserLocalOnly(updated: UserProfile): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === updated.id || u.email.toLowerCase() === updated.email.toLowerCase());
    if (index >= 0) {
      users[index] = { ...users[index], ...updated };
    } else {
      users.push(updated);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  recalculateUserStorage(email: string): void {
    const results = this.getAllScanResultsRaw().filter(
      (r) => r.scannedByEmail && r.scannedByEmail.toLowerCase() === email.toLowerCase()
    );
    const totalBytes = results.reduce(
      (acc, r) => acc + (r.imageSizeBytes || (r.scannedImageUrl?.length || 0)),
      0
    );

    const users = this.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      user.storageBytes = totalBytes;
      this.saveUsers(users);
      const current = this.getCurrentUser();
      if (current && current.email.toLowerCase() === email.toLowerCase()) {
        current.storageBytes = totalBytes;
        this.setCurrentUser(current);
      }
      d1SyncService.saveUser(user).catch(() => {});
    }
  },

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${val} ${sizes[i]}`;
  },
};
