// Cloudflare Pages Functions - REST API with Cloudflare D1 Database
// Automatically routed by Cloudflare Pages to handle /api/* requests

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

interface Env {
  DB?: D1Database;
  ENVIRONMENT?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
  params: {
    route?: string[];
  };
}

const jsonResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Check if D1 Database binding is available
  if (!env.DB) {
    return jsonResponse(
      {
        success: false,
        error: 'Cloudflare D1 Database binding (DB) is not configured in Cloudflare Pages dashboard.',
        isD1Available: false,
      },
      503
    );
  }

  const db = env.DB;

  try {
    // 1. Health check & status
    if (path === 'status' || path === '') {
      const res = await db.prepare('SELECT count(*) as count FROM settings').first<{ count: number }>();
      return jsonResponse({
        success: true,
        message: 'Cloudflare D1 is connected and operational',
        isD1Available: true,
        settingsRows: res?.count ?? 0,
      });
    }

    // 2. App Settings API
    if (path === 'settings') {
      if (method === 'GET') {
        const row = await db.prepare('SELECT * FROM settings WHERE id = "app_settings"').first<{
          app_name: string;
          app_logo_url: string;
          organization_name: string;
          last_updated: string;
          updated_by: string;
        }>();

        if (!row) {
          return jsonResponse({ success: true, settings: null });
        }

        return jsonResponse({
          success: true,
          settings: {
            appName: row.app_name,
            appLogoUrl: row.app_logo_url || '',
            organizationName: row.organization_name,
            lastUpdated: row.last_updated,
            updatedBy: row.updated_by,
          },
        });
      }

      if (method === 'POST') {
        const body = await request.json() as any;
        await db
          .prepare(
            `INSERT OR REPLACE INTO settings (id, app_name, app_logo_url, organization_name, last_updated, updated_by)
             VALUES ('app_settings', ?, ?, ?, ?, ?)`
          )
          .bind(
            body.appName || 'ExamScan OMR Pro',
            body.appLogoUrl || '',
            body.organizationName || 'ศูนย์ทดสอบวัดผลทางการศึกษา',
            new Date().toISOString(),
            body.updatedBy || 'User'
          )
          .run();

        return jsonResponse({ success: true, message: 'Settings saved to Cloudflare D1' });
      }
    }

    // 3. Exams API - Support user isolation & admin view
    if (path === 'exams' || path.startsWith('exams/')) {
      const examId = path.split('/')[1];

      if (method === 'GET') {
        if (examId) {
          const row = await db.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).first<any>();
          if (!row) return jsonResponse({ success: false, error: 'Exam not found' }, 404);
          return jsonResponse({
            success: true,
            exam: {
              ...row,
              questionCount: row.question_count,
              choiceCount: row.choice_count,
              choiceLabelType: row.choice_label_type,
              passPercentage: row.pass_percentage,
              createdBy: row.created_by,
              creatorName: row.creator_name,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              gradeLevel: row.grade_level,
              answerKey: JSON.parse(row.answer_key_json || '{}'),
            },
          });
        }

        const userEmail = url.searchParams.get('userEmail');
        const role = url.searchParams.get('role');

        let rowsResult;
        // If not admin and userEmail is provided, isolate by user
        if (role !== 'admin' && userEmail) {
          rowsResult = await db
            .prepare('SELECT * FROM exams WHERE LOWER(created_by) = LOWER(?) ORDER BY created_at DESC')
            .bind(userEmail)
            .all<any>();
        } else {
          // Admin or all
          rowsResult = await db.prepare('SELECT * FROM exams ORDER BY created_at DESC').all<any>();
        }

        const exams = (rowsResult.results || []).map((r) => ({
          id: r.id,
          title: r.title,
          code: r.code,
          gradeLevel: r.grade_level,
          description: r.description,
          questionCount: r.question_count,
          choiceCount: r.choice_count,
          choiceLabelType: r.choice_label_type,
          passPercentage: r.pass_percentage,
          createdBy: r.created_by,
          creatorName: r.creator_name,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          answerKey: JSON.parse(r.answer_key_json || '{}'),
        }));
        return jsonResponse({ success: true, exams });
      }

      if (method === 'POST') {
        const body = await request.json() as any;
        const answerKeyJson = JSON.stringify(body.answerKey || {});

        await db
          .prepare(
            `INSERT OR REPLACE INTO exams 
             (id, title, code, grade_level, description, question_count, choice_count, choice_label_type, pass_percentage, created_by, creator_name, created_at, updated_at, answer_key_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            body.id,
            body.title,
            body.code || null,
            body.gradeLevel || null,
            body.description || null,
            body.questionCount,
            body.choiceCount || 4,
            body.choiceLabelType || 'thai',
            body.passPercentage || 50,
            body.createdBy || 'user',
            body.creatorName || 'User',
            body.createdAt || new Date().toISOString(),
            new Date().toISOString(),
            answerKeyJson
          )
          .run();

        return jsonResponse({ success: true, message: 'Exam saved to Cloudflare D1' });
      }

      if (method === 'DELETE' && examId) {
        await db.prepare('DELETE FROM exams WHERE id = ?').bind(examId).run();
        await db.prepare('DELETE FROM scan_results WHERE exam_id = ?').bind(examId).run();
        return jsonResponse({ success: true, message: 'Exam deleted from Cloudflare D1' });
      }
    }

    // 4. Scan Results API - Support user isolation & admin view
    if (path === 'scans' || path.startsWith('scans/')) {
      const scanId = path.split('/')[1];

      if (method === 'GET') {
        const queryExamId = url.searchParams.get('examId');
        const userEmail = url.searchParams.get('userEmail');
        const role = url.searchParams.get('role');

        let query = 'SELECT * FROM scan_results WHERE 1=1';
        const params: unknown[] = [];

        if (queryExamId) {
          query += ' AND exam_id = ?';
          params.push(queryExamId);
        }

        if (role !== 'admin' && userEmail) {
          query += ' AND LOWER(scanned_by_email) = LOWER(?)';
          params.push(userEmail);
        }

        query += ' ORDER BY scanned_at DESC';

        let stmt = db.prepare(query);
        if (params.length > 0) {
          stmt = stmt.bind(...params);
        }

        const rows = await stmt.all<any>();
        const results = (rows.results || []).map((r) => ({
          id: r.id,
          examId: r.exam_id,
          examTitle: r.exam_title,
          studentName: r.student_name,
          studentId: r.student_id,
          studentClass: r.student_class,
          score: r.score,
          totalQuestions: r.total_questions,
          correctCount: r.correct_count ?? r.score,
          scorePercentage: r.score_percentage,
          passed: Boolean(r.passed),
          answers: JSON.parse(r.answers_json || '[]'),
          annotatedImageUrl: r.annotated_image_url || '',
          scannedImageUrl: r.scanned_image_url || '',
          imageSizeBytes: r.image_size_bytes || 0,
          scannedByEmail: r.scanned_by_email,
          scannedAt: r.scanned_at,
          notes: r.notes,
        }));
        return jsonResponse({ success: true, results });
      }

      if (method === 'POST') {
        const body = await request.json() as any;
        await db
          .prepare(
            `INSERT OR REPLACE INTO scan_results
             (id, exam_id, exam_title, student_name, student_id, student_class, score, total_questions, correct_count, score_percentage, passed, answers_json, annotated_image_url, scanned_image_url, image_size_bytes, scanned_by_email, scanned_at, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            body.id,
            body.examId,
            body.examTitle,
            body.studentName || null,
            body.studentId || null,
            body.studentClass || null,
            body.score,
            body.totalQuestions,
            body.correctCount ?? body.score,
            body.scorePercentage,
            body.passed ? 1 : 0,
            JSON.stringify(body.answers || []),
            body.annotatedImageUrl || '',
            body.scannedImageUrl || '',
            body.imageSizeBytes || 0,
            body.scannedByEmail || 'user',
            body.scannedAt || new Date().toISOString(),
            body.notes || null
          )
          .run();

        return jsonResponse({ success: true, message: 'Scan result saved to Cloudflare D1' });
      }

      if (method === 'DELETE' && scanId) {
        await db.prepare('DELETE FROM scan_results WHERE id = ?').bind(scanId).run();
        return jsonResponse({ success: true, message: 'Scan result deleted from Cloudflare D1' });
      }
    }

    // 5. Users API - Full member management & sync
    if (path === 'users' || path.startsWith('users/')) {
      const userId = path.split('/')[1];

      if (method === 'GET') {
        const emailQuery = url.searchParams.get('email');
        if (emailQuery) {
          const row = await db
            .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
            .bind(emailQuery)
            .first<any>();
          if (!row) {
            return jsonResponse({ success: true, user: null });
          }
          return jsonResponse({
            success: true,
            user: {
              id: row.id,
              email: row.email,
              displayName: row.display_name,
              role: row.role,
              status: row.status,
              avatarUrl: row.avatar_url || '',
              createdAt: row.created_at,
              lastLoginAt: row.last_login_at,
              storageBytes: row.storage_bytes,
            },
          });
        }

        const rows = await db.prepare('SELECT * FROM users ORDER BY created_at ASC').all<any>();
        const users = (rows.results || []).map((r) => ({
          id: r.id,
          email: r.email,
          displayName: r.display_name,
          role: r.role,
          status: r.status,
          avatarUrl: r.avatar_url || '',
          createdAt: r.created_at,
          lastLoginAt: r.last_login_at,
          storageBytes: r.storage_bytes,
        }));
        return jsonResponse({ success: true, users });
      }

      if (method === 'POST') {
        const body = await request.json() as any;
        await db
          .prepare(
            `INSERT OR REPLACE INTO users
             (id, email, display_name, role, status, avatar_url, created_at, last_login_at, storage_bytes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            body.id,
            body.email,
            body.displayName,
            body.role || 'member',
            body.status || 'approved',
            body.avatarUrl || null,
            body.createdAt || new Date().toISOString(),
            body.lastLoginAt || new Date().toISOString(),
            body.storageBytes || 0
          )
          .run();

        return jsonResponse({ success: true, message: 'User saved to Cloudflare D1' });
      }

      if (method === 'DELETE' && userId) {
        await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
        return jsonResponse({ success: true, message: 'User deleted from Cloudflare D1' });
      }
    }

    return jsonResponse({ success: false, error: `Route not found: ${path}` }, 404);
  } catch (err: any) {
    return jsonResponse({ success: false, error: err.message || 'Internal Server Error' }, 500);
  }
};
