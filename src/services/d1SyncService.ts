import { AppSettings, Exam, ScanResult, UserProfile } from '../types';

export interface D1Status {
  isAvailable: boolean;
  statusMessage: string;
  isChecking: boolean;
  lastSyncTime?: string;
}

export const d1SyncService = {
  /**
   * Checks if the app is currently running on Cloudflare Pages with active D1 binding.
   */
  async checkConnection(): Promise<{ isAvailable: boolean; message: string }> {
    try {
      const res = await fetch('/api/status', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return {
          isAvailable: false,
          message: `HTTP ${res.status}: Cloudflare API ยังไม่ได้เปิดใช้งาน หรือรันบนเครื่องจำลอง`,
        };
      }

      const data = await res.json();
      if (data.isD1Available) {
        return {
          isAvailable: true,
          message: 'เชื่อมต่อ Cloudflare D1 สำเร็จ พร้อมใช้งานแบบเรียลไทม์',
        };
      }

      return {
        isAvailable: false,
        message: data.error || 'D1 binding ยังไม่ได้เชื่อมต่อใน Cloudflare',
      };
    } catch {
      return {
        isAvailable: false,
        message: 'โหมดออฟไลน์ / พรีวิว (ใช้ Local Storage อัตโนมัติ)',
      };
    }
  },

  // 1. Exams
  async fetchExams(): Promise<Exam[] | null> {
    try {
      const res = await fetch('/api/exams');
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.exams : null;
    } catch {
      return null;
    }
  },

  async saveExam(exam: Exam): Promise<boolean> {
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exam),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteExam(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 2. Scan Results
  async fetchScanResults(examId?: string): Promise<ScanResult[] | null> {
    try {
      const url = examId ? `/api/scans?examId=${encodeURIComponent(examId)}` : '/api/scans';
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.results : null;
    } catch {
      return null;
    }
  },

  async saveScanResult(result: ScanResult): Promise<boolean> {
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 3. Settings
  async fetchSettings(): Promise<AppSettings | null> {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return null;
      const data = await res.json();
      return data.success && data.settings ? data.settings : null;
    } catch {
      return null;
    }
  },

  async saveSettings(settings: AppSettings): Promise<boolean> {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 4. Users
  async fetchUsers(): Promise<UserProfile[] | null> {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.users : null;
    } catch {
      return null;
    }
  },

  async saveUser(user: UserProfile): Promise<boolean> {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
