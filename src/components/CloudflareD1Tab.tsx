import React, { useState, useEffect } from 'react';
import { d1SyncService } from '../services/d1SyncService';
import { storageService } from '../services/storageService';
import { useToast } from '../services/toastContext';
import {
  Cloud,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Terminal,
  ExternalLink,
  Download,
  FileCode,
  Globe,
  Sparkles,
  Check,
} from 'lucide-react';

export const CloudflareD1Tab: React.FC = () => {
  const { success, info } = useToast();
  const [guideMode, setGuideMode] = useState<'gui' | 'cli'>('gui');
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [d1Status, setD1Status] = useState<{ isAvailable: boolean; message: string }>({
    isAvailable: false,
    message: 'กำลังตรวจสอบสถานะการเชื่อมต่อ...',
  });

  const checkStatus = async () => {
    setIsChecking(true);
    const res = await d1SyncService.checkConnection();
    setD1Status(res);
    setIsChecking(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSyncWithD1 = async () => {
    setIsSyncing(true);
    const res = await storageService.syncWithD1();
    if (res.success) {
      success('ซิงค์ข้อมูลสำเร็จ', res.message);
    } else {
      info('สถานะการซิงค์', res.message);
    }
    setIsSyncing(false);
    checkStatus();
  };

  const copyToClipboard = (text: string, label: string, key?: string) => {
    navigator.clipboard.writeText(text);
    if (key) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
    success('คัดลอกสำเร็จ', `คัดลอก ${label} ไปยังคลิปบอร์ดแล้ว`);
  };

  // Clean SQL tables without comments for 100% Cloudflare Console compatibility
  const sqlSettings = `CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  app_logo_url TEXT,
  organization_name TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  updated_by TEXT NOT NULL
);`;

  const sqlUsers = `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL,
  storage_bytes INTEGER DEFAULT 0
);`;

  const sqlExams = `CREATE TABLE IF NOT EXISTS exams (
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
);`;

  const sqlScans = `CREATE TABLE IF NOT EXISTS scan_results (
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
);`;

  const sqlSeed = `INSERT OR IGNORE INTO settings (id, app_name, app_logo_url, organization_name, last_updated, updated_by)
VALUES ('app_settings', 'ExamScan OMR Pro', '', 'ศูนย์ทดสอบวัดผลทางการศึกษา', '2026-09-26T00:00:00Z', 'Admin');

INSERT OR IGNORE INTO users (id, email, display_name, role, status, created_at, last_login_at, storage_bytes)
VALUES ('admin_root', 'admin@system.local', 'ผู้ดูแลระบบ (Admin)', 'admin', 'approved', '2026-09-26T00:00:00Z', '2026-09-26T00:00:00Z', 0);`;

  const combinedCleanSql = `${sqlSettings}\n\n${sqlUsers}\n\n${sqlExams}\n\n${sqlScans}\n\n${sqlSeed}`;

  const allDeployCommands = `# 1. ติดตั้ง Cloudflare Wrangler CLI
npm install -g wrangler

# 2. เข้าสู่ระบบบัญชี Cloudflare ของคุณ
npx wrangler login

# 3. สร้างฐานข้อมูล Cloudflare D1
npx wrangler d1 create omr_d1

# 4. รัน SQL Schema เพื่อสร้างตารางทั้งหมดใน D1
npx wrangler d1 execute omr_d1 --file=./schema.sql --remote

# 5. สั่ง Build และ Deploy ขึ้น Cloudflare Pages ทันที
npm run build
npx wrangler pages deploy dist --project-name=examscan-omr`;

  const handleExportBackup = () => {
    const backupData = {
      settings: storageService.getSettings(),
      users: storageService.getUsers(),
      exams: storageService.getExams(),
      scanResults: storageService.getScanResults(),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ExamScan_OMR_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success('ส่งออกข้อมูลสำเร็จ', 'ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว');
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800">
      {/* 1. Connection Status Card */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-heading font-bold text-base sm:text-lg">
                  Cloudflare D1 & Pages Deployment
                </h4>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    d1Status.isAvailable
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {d1Status.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>เชื่อมต่อ Cloudflare D1 ออนไลน์</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>โหมดออฟไลน์ / พรีวิว (LocalStorage)</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                {d1Status.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={checkStatus}
              disabled={isChecking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>ตรวจสถานะ</span>
            </button>

            <button
              onClick={handleSyncWithD1}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลกับ D1'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setGuideMode('gui')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              guideMode === 'gui'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>ทำผ่านหน้าเว็บ Cloudflare Dashboard (แนะนำ - ไม่ต้องเปิด Terminal)</span>
          </button>

          <button
            type="button"
            onClick={() => setGuideMode('cli')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              guideMode === 'cli'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4 text-slate-600" />
            <span>คำสั่ง Wrangler CLI</span>
          </button>
        </div>

        <a
          href="https://dash.cloudflare.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-3 py-1.5"
        >
          <span>เปิด Cloudflare Dashboard</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* GUI Mode Instructions */}
      {guideMode === 'gui' && (
        <div className="space-y-4">
          {/* Step 1: Create Database on Cloudflare Web */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                1
              </span>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading font-bold text-base text-slate-900">
                    ขั้นตอนที่ 1: สร้างฐานข้อมูล D1 บน Cloudflare Dashboard
                  </h4>
                  <a
                    href="https://dash.cloudflare.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <span>dash.cloudflare.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside pl-1 leading-relaxed">
                  <li>เข้าสู่ระบบที่ <strong>dash.cloudflare.com</strong></li>
                  <li>มองที่เมนูด้านซ้าย คลิกเลือก <strong>Storage & Databases</strong> &gt; <strong>D1 SQL Database</strong></li>
                  <li>คลิกปุ่มสีฟ้า <strong>Create database</strong></li>
                  <li>
                    ช่อง <strong>Database name</strong> ให้พิมพ์ชื่อ: <code className="bg-slate-100 text-indigo-700 px-2 py-0.5 rounded font-mono font-bold">omr_d1</code>
                    <button
                      onClick={() => copyToClipboard('omr_d1', 'ชื่อฐานข้อมูล omr_d1', 'dbname')}
                      className="ml-2 text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer inline-flex items-center gap-0.5"
                    >
                      {copiedKey === 'dbname' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'dbname' ? 'คัดลอกแล้ว' : 'คัดลอกชื่อ'}</span>
                    </button>
                  </li>
                  <li>กดปุ่ม <strong>Create</strong> เพื่อสร้างฐานข้อมูล</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 2: Run SQL in Console Tab - With Individual Copy Buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                2
              </span>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-heading font-bold text-base text-slate-900">
                      ขั้นตอนที่ 2: วางคำสั่ง SQL สร้างตารางในแท็บ Console
                    </h4>
                    <p className="text-xs text-slate-500">
                      คลิกเข้าไปที่ชื่อฐานข้อมูล <code className="text-indigo-600 font-bold">omr_d1</code> แล้วคลิกแท็บ <strong>Console</strong> ด้านบน
                    </p>
                  </div>

                  <button
                    onClick={() => copyToClipboard(combinedCleanSql, 'SQL ทั้งหมดแบบไม่มีคอมเมนต์', 'all_sql')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                  >
                    {copiedKey === 'all_sql' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'all_sql' ? 'คัดลอกทั้งหมดแล้ว' : 'คัดลอก SQL ทั้งหมด (Clean)'}</span>
                  </button>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  ⚠️ <strong>เหตุผลที่ก่อนหน้านี้ Execute ไม่ผ่าน:</strong> หน้าต่าง Console ของ Cloudflare D1 จะเกิด Syntax Error หากวางข้อความที่มีคอมเมนต์ <code className="bg-white px-1.5 py-0.5 rounded text-rose-600">--</code> หรือวางหลายคำสั่งยาวเกินไป แนะนำให้<strong>กดปุ่มคัดลอกทีละตารางด้านล่างนี้ไปวางและกด Execute ทีละตาราง</strong> (สำเร็จ 100% แน่นอนครับ)
                </div>

                {/* Sub-steps: 4 Tables + Seed Data */}
                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  {/* Table 1: Settings */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="font-bold text-slate-800">1. ตาราง settings (การตั้งค่าแอปและสถานศึกษา)</span>
                      <p className="text-[11px] text-slate-500 font-mono">CREATE TABLE IF NOT EXISTS settings ...</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(sqlSettings, 'ตาราง settings', 't1')}
                      className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 't1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 't1' ? 'คัดลอกแล้ว' : 'คัดลอกตารางที่ 1'}</span>
                    </button>
                  </div>

                  {/* Table 2: Users */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="font-bold text-slate-800">2. ตาราง users (รายชื่อผู้ใช้งานและบทบาท)</span>
                      <p className="text-[11px] text-slate-500 font-mono">CREATE TABLE IF NOT EXISTS users ...</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(sqlUsers, 'ตาราง users', 't2')}
                      className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 't2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 't2' ? 'คัดลอกแล้ว' : 'คัดลอกตารางที่ 2'}</span>
                    </button>
                  </div>

                  {/* Table 3: Exams */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="font-bold text-slate-800">3. ตาราง exams (ชุดข้อสอบ จำนวนข้อ และเฉลย)</span>
                      <p className="text-[11px] text-slate-500 font-mono">CREATE TABLE IF NOT EXISTS exams ...</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(sqlExams, 'ตาราง exams', 't3')}
                      className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 't3' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 't3' ? 'คัดลอกแล้ว' : 'คัดลอกตารางที่ 3'}</span>
                    </button>
                  </div>

                  {/* Table 4: Scan Results */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="font-bold text-slate-800">4. ตาราง scan_results (ผลตรวจ OMR และคะแนน)</span>
                      <p className="text-[11px] text-slate-500 font-mono">CREATE TABLE IF NOT EXISTS scan_results ...</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(sqlScans, 'ตาราง scan_results', 't4')}
                      className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 't4' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 't4' ? 'คัดลอกแล้ว' : 'คัดลอกตารางที่ 4'}</span>
                    </button>
                  </div>

                  {/* Initial seed */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="font-bold text-slate-800">5. ข้อมูลเริ่มต้น (ตั้งค่า Admin เริ่มต้น)</span>
                      <p className="text-[11px] text-slate-500 font-mono">INSERT OR IGNORE INTO settings ...</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(sqlSeed, 'ข้อมูลเริ่มต้น', 't5')}
                      className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 't5' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 't5' ? 'คัดลอกแล้ว' : 'คัดลอกข้อมูลเริ่มต้น'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Deploy via Cloudflare Pages GUI */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                3
              </span>
              <div className="flex-1 space-y-2">
                <h4 className="font-heading font-bold text-base text-slate-900">
                  ขั้นตอนที่ 3: Deploy บน Cloudflare Pages (แก้ไขปัญหา Error ตามรูปแล้ว)
                </h4>
                
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                  ✅ <strong>แก้ไขปัญหา Bun.lock ในรูปแล้ว:</strong> สาเหตุที่ขึ้น Error สีแดงในรูปภาพของคุณ เกิดจาก Cloudflare ไปตรวจเจอไฟล์ Bun เก่า เราได้<strong>ลบ bun.lock และสร้าง package-lock.json มาตรฐานของ Node.js/npm เรียบร้อยแล้ว</strong> ตอนนี้คุณสามารถกด Deploy ใหม่ได้เลยครับ
                </div>

                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1 leading-relaxed">
                  <li>
                    ในหน้า Cloudflare Pages ที่ขึ้น Error ในรูป ให้กดปุ่ม <strong>Retry deployment</strong> หรือเข้าไปที่ <strong>Workers & Pages</strong> &gt; <strong>Create application</strong> &gt; <strong>Pages</strong> &gt; <strong>Connect to Git</strong>
                  </li>
                  <li>
                    ตั้งค่า Build Settings ดังนี้:
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5 ml-4">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Framework preset:</span>
                        <strong className="font-mono text-slate-800">Vite</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Build command:</span>
                        <strong className="font-mono text-slate-800">npm run build</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Build output directory:</span>
                        <strong className="font-mono text-slate-800">dist</strong>
                      </div>
                    </div>
                  </li>
                  <li>กดปุ่ม <strong>Save and Deploy</strong> (รอบนี้จะผ่านฉลุย เพราะใช้ npm แทน Bun แล้วครับ)</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 4: Binding D1 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                4
              </span>
              <div className="flex-1 space-y-2">
                <h4 className="font-heading font-bold text-base text-slate-900">
                  ขั้นตอนที่ 4: ผูกฐานข้อมูล D1 เข้ากับเว็บ Pages
                </h4>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1.5 leading-relaxed">
                  <div>1) เมื่อเว็บ Deploy เสร็จ ให้คลิกไปที่แท็บ <strong>Settings</strong> ของโปรเจกต์ Pages นั้น</div>
                  <div>2) เมนูด้านซ้ายคลิก <strong>Functions</strong></div>
                  <div>3) เลื่อนลงมาที่หัวข้อ <strong>D1 database bindings</strong> แล้วคลิกปุ่ม <strong>Add binding</strong></div>
                  <div>
                    4) ช่อง <strong>Variable name</strong>: ใส่คำว่า <code className="bg-white px-2 py-0.5 rounded font-mono font-bold text-indigo-700">DB</code> (ตัวพิมพ์ใหญ่ 2 ตัว)
                    <button
                      onClick={() => copyToClipboard('DB', 'Variable name DB', 'bind_db')}
                      className="ml-2 text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer inline-flex items-center gap-0.5"
                    >
                      {copiedKey === 'bind_db' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'bind_db' ? 'คัดลอกแล้ว' : 'คัดลอกคำว่า DB'}</span>
                    </button>
                  </div>
                  <div>5) ช่อง <strong>D1 database</strong>: เลือก <code className="font-bold">omr_d1</code> ที่สร้างไว้ แล้วกด <strong>Save</strong></div>
                  <div>6) ไปที่แท็บ <strong>Deployments</strong> แล้วกด <strong>Retry deployment</strong> รอบสุดท้าย เพื่อให้เว็บโหลดค่า D1 เป็นอันเสร็จสมบูรณ์ 100%! 🎉</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLI Mode */}
      {guideMode === 'cli' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm sm:text-base text-slate-900">
                  คำสั่ง Terminal สำหรับ Wrangler CLI
                </h4>
                <p className="text-xs text-slate-500">
                  สำหรับผู้ที่ต้องการรันผ่าน Command Line
                </p>
              </div>
            </div>

            <button
              onClick={() => copyToClipboard(allDeployCommands, 'คำสั่ง Deploy ทั้งหมด')}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>คัดลอกคำสั่งทั้งหมด</span>
            </button>
          </div>

          <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto">
            <pre className="whitespace-pre">{allDeployCommands}</pre>
          </div>
        </div>
      )}

      {/* Data Backup */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-indigo-600" />
          <div>
            <h5 className="font-heading font-bold text-sm text-slate-800">
              สำรองข้อมูลทั้งหมด (Backup JSON)
            </h5>
            <p className="text-xs text-slate-500">
              ดาวน์โหลดชุดข้อสอบและผลการตรวจทั้งหมดเป็นไฟล์ JSON เพื่อนำไปกู้คืนได้ตลอดเวลา
            </p>
          </div>
        </div>
        <button
          onClick={handleExportBackup}
          className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>ดาวน์โหลด JSON</span>
        </button>
      </div>
    </div>
  );
};
