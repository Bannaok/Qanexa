import { AppSettings, Exam, ScanResult, UserProfile } from '../types';
import { d1SyncService } from './d1SyncService';

const SETTINGS_KEY = 'examscan_app_settings';
const USERS_KEY = 'examscan_users';
const ADMIN_PASS_KEY = 'examscan_admin_password';
const EXAMS_KEY = 'examscan_exams';
const SCAN_RESULTS_KEY = 'examscan_scan_results';
const CURRENT_USER_KEY = 'examscan_current_user';

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

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Asynchronous background sync to Cloudflare D1
    d1SyncService.saveSettings(settings).catch(() => {});
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
  },

  getUserByEmail(email: string): UserProfile | undefined {
    const users = this.getUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  updateUser(updated: UserProfile): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === updated.id);
    if (index >= 0) {
      users[index] = updated;
    } else {
      users.push(updated);
    }
    this.saveUsers(users);
  },

  deleteUser(userId: string): void {
    const users = this.getUsers().filter((u) => u.id !== userId);
    this.saveUsers(users);
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
  },

  // Exams
  getExams(): Exam[] {
    const raw = localStorage.getItem(EXAMS_KEY);
    if (!raw) {
      localStorage.setItem(EXAMS_KEY, JSON.stringify(INITIAL_EXAMS));
      return INITIAL_EXAMS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_EXAMS;
    }
  },

  saveExams(exams: Exam[]): void {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  },

  getExamById(id: string): Exam | undefined {
    return this.getExams().find((e) => e.id === id);
  },

  saveExam(exam: Exam): void {
    const exams = this.getExams();
    const idx = exams.findIndex((e) => e.id === exam.id);
    if (idx >= 0) {
      exams[idx] = exam;
    } else {
      exams.unshift(exam);
    }
    this.saveExams(exams);
    // Background sync to Cloudflare D1
    d1SyncService.saveExam(exam).catch(() => {});
  },

  deleteExam(id: string): void {
    const exams = this.getExams().filter((e) => e.id !== id);
    this.saveExams(exams);
    // Also remove scan results for this exam
    const results = this.getScanResults().filter((r) => r.examId !== id);
    this.saveScanResults(results);
    // Background sync to Cloudflare D1
    d1SyncService.deleteExam(id).catch(() => {});
  },

  // Scan Results
  getScanResults(): ScanResult[] {
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
  },

  addScanResult(result: ScanResult): void {
    const results = this.getScanResults();
    results.unshift(result);
    this.saveScanResults(results);

    // Update storage size for the scanner email
    this.recalculateUserStorage(result.scannedByEmail);

    // Background sync to Cloudflare D1
    d1SyncService.saveScanResult(result).catch(() => {});
  },

  deleteScanResult(resultId: string): void {
    const results = this.getScanResults();
    const target = results.find((r) => r.id === resultId);
    const updated = results.filter((r) => r.id !== resultId);
    this.saveScanResults(updated);

    if (target) {
      this.recalculateUserStorage(target.scannedByEmail);
    }
  },

  /**
   * Syncs local storage with Cloudflare D1 if online & connected
   */
  async syncWithD1(): Promise<{ success: boolean; message: string }> {
    try {
      const conn = await d1SyncService.checkConnection();
      if (!conn.isAvailable) {
        return { success: false, message: conn.message };
      }

      // Fetch exams from D1
      const remoteExams = await d1SyncService.fetchExams();
      if (remoteExams && remoteExams.length > 0) {
        this.saveExams(remoteExams);
      }

      // Fetch settings from D1
      const remoteSettings = await d1SyncService.fetchSettings();
      if (remoteSettings) {
        this.saveSettings(remoteSettings);
      }

      return { success: true, message: 'ซิงค์ข้อมูลกับ Cloudflare D1 สำเร็จ' };
    } catch (err: any) {
      return { success: false, message: err.message || 'ซิงค์ข้อมูลล้มเหลว' };
    }
  },

  recalculateUserStorage(email: string): void {
    const results = this.getScanResults().filter(
      (r) => r.scannedByEmail.toLowerCase() === email.toLowerCase()
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
      // If current user is this user, sync
      const current = this.getCurrentUser();
      if (current && current.email.toLowerCase() === email.toLowerCase()) {
        current.storageBytes = totalBytes;
        this.setCurrentUser(current);
      }
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
