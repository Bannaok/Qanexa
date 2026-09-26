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

    // Background sync to Cloudflare D1
    d1SyncService.saveUser(updated).catch(() => {});
  },

  deleteUser(userId: string): void {
    const users = this.getUsers().filter((u) => u.id !== userId);
    this.saveUsers(users);
    // Background sync to Cloudflare D1
    d1SyncService.deleteUser(userId).catch(() => {});
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

  // Exams with User-Isolation:
  // - Admin can see all exams
  // - Teachers see their own created exams (and default starter exams)
  getExams(currentUser?: UserProfile | null): Exam[] {
    const raw = localStorage.getItem(EXAMS_KEY);
    let allExams: Exam[] = [];
    if (!raw) {
      allExams = INITIAL_EXAMS;
      localStorage.setItem(EXAMS_KEY, JSON.stringify(INITIAL_EXAMS));
    } else {
      try {
        allExams = JSON.parse(raw);
      } catch {
        allExams = INITIAL_EXAMS;
      }
    }

    if (!currentUser) return allExams;
    if (currentUser.role === 'admin') return allExams;

    const email = currentUser.email.toLowerCase();
    return allExams.filter((e) => {
      // User created this exam OR it's a sample system exam
      return (
        (e.createdBy && e.createdBy.toLowerCase() === email) ||
        e.createdBy === 'admin@system.local' ||
        e.id.startsWith('exam-')
      );
    });
  },

  getAllExamsRaw(): Exam[] {
    const raw = localStorage.getItem(EXAMS_KEY);
    if (!raw) return INITIAL_EXAMS;
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
    return this.getAllExamsRaw().find((e) => e.id === id);
  },

  saveExam(exam: Exam): void {
    const exams = this.getAllExamsRaw();
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
    const exams = this.getAllExamsRaw().filter((e) => e.id !== id);
    this.saveExams(exams);
    // Also remove scan results for this exam
    const results = this.getAllScanResultsRaw().filter((r) => r.examId !== id);
    this.saveScanResults(results);
    // Background sync to Cloudflare D1
    d1SyncService.deleteExam(id).catch(() => {});
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
  },

  addScanResult(result: ScanResult): void {
    const results = this.getAllScanResultsRaw();
    results.unshift(result);
    this.saveScanResults(results);

    // Update storage size for the scanner email
    this.recalculateUserStorage(result.scannedByEmail);

    // Background sync to Cloudflare D1
    d1SyncService.saveScanResult(result).catch(() => {});
  },

  deleteScanResult(resultId: string): void {
    const results = this.getAllScanResultsRaw();
    const target = results.find((r) => r.id === resultId);
    const updated = results.filter((r) => r.id !== resultId);
    this.saveScanResults(updated);

    if (target) {
      this.recalculateUserStorage(target.scannedByEmail);
    }
    // Background sync to Cloudflare D1
    d1SyncService.deleteScanResult(resultId).catch(() => {});
  },

  /**
   * Syncs local storage with Cloudflare D1 across any device or browser:
   * 1. Syncs current user status (e.g. if Admin approved/banned/deleted the user)
   * 2. Syncs Exams: teacher's own exams, or all exams if Admin
   * 3. Syncs Scans: teacher's own scans, or all scans if Admin
   * 4. Syncs Settings
   * 5. If Admin, syncs all registered members list
   */
  async syncWithD1(currentUser?: UserProfile | null): Promise<{ success: boolean; message: string }> {
    try {
      const conn = await d1SyncService.checkConnection();
      if (!conn.isAvailable) {
        return { success: false, message: conn.message };
      }

      const activeUser = currentUser || this.getCurrentUser();

      // 1. Sync User profile & Admin approval status from server
      if (activeUser && activeUser.email) {
        const remoteUser = await d1SyncService.fetchUserByEmail(activeUser.email);
        if (remoteUser) {
          this.updateUser(remoteUser);
        } else {
          // Push local user to server
          await d1SyncService.saveUser(activeUser);
        }
      }

      // 2. If Admin, fetch all users from Cloudflare D1
      if (activeUser?.role === 'admin') {
        const remoteUsers = await d1SyncService.fetchUsers();
        if (remoteUsers && remoteUsers.length > 0) {
          this.saveUsers(remoteUsers);
        }
      }

      // 3. Fetch exams from D1 (user isolated if teacher, full list if admin)
      const remoteExams = await d1SyncService.fetchExams(
        activeUser?.email,
        activeUser?.role
      );
      if (remoteExams && remoteExams.length > 0) {
        // Merge without losing other offline items
        const existing = this.getAllExamsRaw();
        const map = new Map<string, Exam>();
        existing.forEach((e) => map.set(e.id, e));
        remoteExams.forEach((e) => map.set(e.id, e));
        this.saveExams(Array.from(map.values()));
      }

      // 4. Fetch scan results from D1 (user isolated)
      const remoteScans = await d1SyncService.fetchScanResults(
        undefined,
        activeUser?.email,
        activeUser?.role
      );
      if (remoteScans && remoteScans.length > 0) {
        const existing = this.getAllScanResultsRaw();
        const map = new Map<string, ScanResult>();
        existing.forEach((s) => map.set(s.id, s));
        remoteScans.forEach((s) => map.set(s.id, s));
        this.saveScanResults(Array.from(map.values()));
      }

      // 5. Fetch settings from D1
      const remoteSettings = await d1SyncService.fetchSettings();
      if (remoteSettings) {
        this.saveSettings(remoteSettings);
      }

      return { success: true, message: 'ซิงค์ข้อมูลกับ Cloudflare D1 สำเร็จ ทุกอุปกรณ์ตรงกัน' };
    } catch (err: any) {
      return { success: false, message: err.message || 'ซิงค์ข้อมูลล้มเหลว' };
    }
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
      // If current user is this user, sync
      const current = this.getCurrentUser();
      if (current && current.email.toLowerCase() === email.toLowerCase()) {
        current.storageBytes = totalBytes;
        this.setCurrentUser(current);
      }
      // Sync user storage bytes to Cloudflare D1
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
