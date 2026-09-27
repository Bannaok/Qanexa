export type UserRole = 'admin' | 'member';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  username: string; // Login ID (e.g. 'admin', 'teacher01')
  password?: string; // Login Password
  email?: string; // Legacy/optional reference
  displayName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt: string;
  storageBytes: number; // Storage usage index in bytes
}

export interface AppSettings {
  appName: string;
  appLogoUrl: string;
  organizationName: string;
  lastUpdated: string;
  updatedBy: string;
}

export type ChoiceCount = 3 | 4 | 5; // 3 choices, 4 choices, or 5 choices
export type ChoiceLabelType = 'thai' | 'latin'; // ก-ข-ค / ก-ง vs A-B-C / A-D

export interface Exam {
  id: string;
  title: string;
  gradeLevel?: string;
  code?: string;
  description?: string;
  questionCount: number;
  choiceCount: ChoiceCount;
  choiceLabelType?: ChoiceLabelType;
  answerKey: Record<number, number>; // questionIndex (1-based) -> choiceIndex (0-based: 0=A, 1=B, 2=C, etc.)
  passPercentage: number;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionAnswer {
  questionNumber: number;
  selectedChoice: number | null; // 0=A, 1=B, 2=C, 3=D, 4=E, null=blank
  correctChoice: number;
  isCorrect: boolean;
  confidence: number;
  isMultipleMarked?: boolean;
}

export interface ScanResult {
  id: string;
  examId: string;
  examTitle: string;
  studentName: string;
  studentId: string;
  studentClass?: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  scorePercentage: number;
  passed: boolean;
  answers: QuestionAnswer[];
  scannedImageUrl: string;
  annotatedImageUrl?: string;
  imageSizeBytes: number;
  scannedAt: string;
  scannedByEmail: string;
  notes?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}
