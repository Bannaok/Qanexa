CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  app_logo_url TEXT,
  organization_name TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL,
  storage_bytes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  code TEXT,
  grade_level TEXT,
  description TEXT,
  question_count INTEGER NOT NULL,
  choice_count INTEGER NOT NULL DEFAULT 4,
  choice_label_type TEXT DEFAULT 'thai',
  pass_percentage INTEGER NOT NULL DEFAULT 50,
  created_by TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  answer_key_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_results (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  exam_title TEXT NOT NULL,
  student_name TEXT,
  student_id TEXT,
  student_class TEXT,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  score_percentage INTEGER NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  answers_json TEXT NOT NULL,
  annotated_image_url TEXT,
  scanned_at TEXT NOT NULL,
  notes TEXT
);

INSERT OR IGNORE INTO settings (id, app_name, app_logo_url, organization_name, last_updated, updated_by)
VALUES ('app_settings', 'ExamScan OMR Pro', '', 'ศูนย์ทดสอบวัดผลทางการศึกษา', '2026-09-26T00:00:00Z', 'Admin');

INSERT OR IGNORE INTO users (id, email, display_name, role, status, created_at, last_login_at, storage_bytes)
VALUES ('admin_root', 'admin@system.local', 'ผู้ดูแลระบบ (Admin)', 'admin', 'approved', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z', 0);
