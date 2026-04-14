import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

let db = null;

export async function initDb() {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK(mode IN ('cve', 'idea')),
      total_jobs INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id),
      cve_id TEXT,
      idea_text TEXT,
      category TEXT,
      difficulty TEXT,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN (
        'queued','researching','architecting','pending_spec_review','spec_approved',
        'developing','pending_build_review','ready','failed','rejected',
        'reworking_spec','reworking_build','rejected_final'
      )),
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      spec_revision INTEGER NOT NULL DEFAULT 1,
      build_revision INTEGER NOT NULL DEFAULT 1,
      immutable_tech TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS specs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),
      spec_json TEXT NOT NULL,
      token_usage INTEGER DEFAULT 0,
      generation_time_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),
      analysis_json TEXT NOT NULL,
      token_usage INTEGER DEFAULT 0,
      generation_time_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),
      file_manifest TEXT NOT NULL,
      token_usage INTEGER DEFAULT 0,
      generation_time_ms INTEGER DEFAULT 0,
      anti_ai_manifest TEXT,
      test_results TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS spec_versions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      revision INTEGER NOT NULL,
      spec_json TEXT NOT NULL,
      feedback TEXT,
      token_usage INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS build_versions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      revision INTEGER NOT NULL,
      file_manifest TEXT NOT NULL,
      feedback TEXT,
      token_usage INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      stage TEXT NOT NULL CHECK(stage IN ('spec', 'build')),
      action TEXT NOT NULL CHECK(action IN ('approve', 'reject', 'edit_approve', 'reject_final')),
      notes TEXT,
      edited_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// --- Batches ---

export function createBatch(mode, totalJobs) {
  const id = uuidv4();
  getDb().run(
    'INSERT INTO batches (id, mode, total_jobs) VALUES (?, ?, ?)',
    [id, mode, totalJobs]
  );
  return { id, mode, total_jobs: totalJobs };
}

export function getBatch(id) {
  const stmt = getDb().prepare('SELECT * FROM batches WHERE id = ?');
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

// --- Jobs ---

export function createJob({ batchId, cveId, ideaText, category, difficulty }) {
  const id = uuidv4();
  getDb().run(
    `INSERT INTO jobs (id, batch_id, cve_id, idea_text, category, difficulty)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, batchId, cveId || null, ideaText || null, category || null, difficulty || null]
  );
  return { id, batch_id: batchId, status: 'queued' };
}

export function getJob(id) {
  const stmt = getDb().prepare('SELECT * FROM jobs WHERE id = ?');
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

export function getJobs({ status, category, batchId, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (batchId) {
    query += ' AND batch_id = ?';
    params.push(batchId);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = getDb().prepare(query);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function updateJobStatus(id, status, errorMessage = null) {
  getDb().run(
    `UPDATE jobs SET status = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?`,
    [status, errorMessage, id]
  );
}

export function updateJob(id, fields) {
  const sets = [];
  const vals = [];
  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    vals.push(val);
  }
  sets.push(`updated_at = datetime('now')`);
  vals.push(id);
  getDb().run(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export function findJobByCveId(cveId) {
  const stmt = getDb().prepare('SELECT * FROM jobs WHERE cve_id = ? ORDER BY created_at DESC LIMIT 1');
  stmt.bind([cveId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

export function getAllSpecs() {
  const stmt = getDb().prepare('SELECT * FROM specs');
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.spec_json) {
      try { row.spec_json = JSON.parse(row.spec_json); } catch {}
    }
    rows.push(row);
  }
  stmt.free();
  return rows;
}

export function updateSpec(jobId, specJson, tokenUsage = 0, generationTimeMs = 0) {
  const jsonStr = typeof specJson === 'string' ? specJson : JSON.stringify(specJson);
  getDb().run(
    `UPDATE specs SET spec_json = ?, token_usage = ?, generation_time_ms = ? WHERE job_id = ?`,
    [jsonStr, tokenUsage, generationTimeMs, jobId]
  );
}

export function updateChallenge(jobId, fileManifest, tokenUsage = 0, generationTimeMs = 0) {
  const jsonStr = typeof fileManifest === 'string' ? fileManifest : JSON.stringify(fileManifest);
  getDb().run(
    `UPDATE challenges SET file_manifest = ?, token_usage = ?, generation_time_ms = ? WHERE job_id = ?`,
    [jsonStr, tokenUsage, generationTimeMs, jobId]
  );
}

// --- Analyses ---

export function createAnalysis({ jobId, analysisJson, tokenUsage = 0, generationTimeMs = 0 }) {
  const id = uuidv4();
  const jsonStr = typeof analysisJson === 'string' ? analysisJson : JSON.stringify(analysisJson);
  getDb().run(
    'INSERT INTO analyses (id, job_id, analysis_json, token_usage, generation_time_ms) VALUES (?, ?, ?, ?, ?)',
    [id, jobId, jsonStr, tokenUsage, generationTimeMs]
  );
  return { id, job_id: jobId };
}

export function getAnalysis(jobId) {
  const stmt = getDb().prepare('SELECT * FROM analyses WHERE job_id = ?');
  stmt.bind([jobId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (row && row.analysis_json) {
    try { row.analysis_json = JSON.parse(row.analysis_json); } catch {}
  }
  return row;
}

// --- Specs ---

export function createSpec({ jobId, specJson, tokenUsage = 0, generationTimeMs = 0 }) {
  const id = uuidv4();
  const jsonStr = typeof specJson === 'string' ? specJson : JSON.stringify(specJson);
  getDb().run(
    'INSERT INTO specs (id, job_id, spec_json, token_usage, generation_time_ms) VALUES (?, ?, ?, ?, ?)',
    [id, jobId, jsonStr, tokenUsage, generationTimeMs]
  );
  return { id, job_id: jobId };
}

export function getSpec(jobId) {
  const stmt = getDb().prepare('SELECT * FROM specs WHERE job_id = ?');
  stmt.bind([jobId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (row && row.spec_json) {
    try { row.spec_json = JSON.parse(row.spec_json); } catch {}
  }
  return row;
}

// --- Challenges ---

export function createChallenge({ jobId, fileManifest, tokenUsage = 0, generationTimeMs = 0, antiAiManifest = null, testResults = null }) {
  const id = uuidv4();
  const jsonStr = typeof fileManifest === 'string' ? fileManifest : JSON.stringify(fileManifest);
  const antiAiStr = antiAiManifest ? JSON.stringify(antiAiManifest) : null;
  const testStr = testResults ? JSON.stringify(testResults) : null;
  getDb().run(
    'INSERT INTO challenges (id, job_id, file_manifest, token_usage, generation_time_ms, anti_ai_manifest, test_results) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, jobId, jsonStr, tokenUsage, generationTimeMs, antiAiStr, testStr]
  );
  return { id, job_id: jobId };
}

export function getChallenge(jobId) {
  const stmt = getDb().prepare('SELECT * FROM challenges WHERE job_id = ?');
  stmt.bind([jobId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (row && row.file_manifest) {
    try { row.file_manifest = JSON.parse(row.file_manifest); } catch {}
  }
  if (row && row.anti_ai_manifest) {
    try { row.anti_ai_manifest = JSON.parse(row.anti_ai_manifest); } catch {}
  }
  if (row && row.test_results) {
    try { row.test_results = JSON.parse(row.test_results); } catch {}
  }
  return row;
}

// --- Reviews ---

export function createReview({ jobId, stage, action, notes, editedData }) {
  const id = uuidv4();
  const editedStr = editedData ? (typeof editedData === 'string' ? editedData : JSON.stringify(editedData)) : null;
  getDb().run(
    'INSERT INTO reviews (id, job_id, stage, action, notes, edited_data) VALUES (?, ?, ?, ?, ?, ?)',
    [id, jobId, stage, action, notes || null, editedStr]
  );
  return { id, job_id: jobId, stage, action };
}

export function getReviews(jobId) {
  const stmt = getDb().prepare('SELECT * FROM reviews WHERE job_id = ? ORDER BY created_at ASC');
  stmt.bind([jobId]);
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.edited_data) {
      try { row.edited_data = JSON.parse(row.edited_data); } catch {}
    }
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// --- Versioning ---

export function createSpecVersion({ jobId, revision, specJson, feedback = null, tokenUsage = 0 }) {
  const id = uuidv4();
  const jsonStr = typeof specJson === 'string' ? specJson : JSON.stringify(specJson);
  getDb().run(
    'INSERT INTO spec_versions (id, job_id, revision, spec_json, feedback, token_usage) VALUES (?, ?, ?, ?, ?, ?)',
    [id, jobId, revision, jsonStr, feedback, tokenUsage]
  );
  return { id, job_id: jobId, revision };
}

export function createBuildVersion({ jobId, revision, fileManifest, feedback = null, tokenUsage = 0 }) {
  const id = uuidv4();
  const jsonStr = typeof fileManifest === 'string' ? fileManifest : JSON.stringify(fileManifest);
  getDb().run(
    'INSERT INTO build_versions (id, job_id, revision, file_manifest, feedback, token_usage) VALUES (?, ?, ?, ?, ?, ?)',
    [id, jobId, revision, jsonStr, feedback, tokenUsage]
  );
  return { id, job_id: jobId, revision };
}

export function getSpecVersions(jobId) {
  const stmt = getDb().prepare('SELECT * FROM spec_versions WHERE job_id = ? ORDER BY revision ASC');
  stmt.bind([jobId]);
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.spec_json) { try { row.spec_json = JSON.parse(row.spec_json); } catch {} }
    rows.push(row);
  }
  stmt.free();
  return rows;
}

export function getBuildVersions(jobId) {
  const stmt = getDb().prepare('SELECT * FROM build_versions WHERE job_id = ? ORDER BY revision ASC');
  stmt.bind([jobId]);
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.file_manifest) { try { row.file_manifest = JSON.parse(row.file_manifest); } catch {} }
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// --- Stats ---

export function getStats() {
  const d = getDb();

  const totalStmt = d.prepare('SELECT COUNT(*) as count FROM jobs');
  totalStmt.step();
  const totalJobs = totalStmt.getAsObject().count;
  totalStmt.free();

  const todayStmt = d.prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= date('now')");
  todayStmt.step();
  const jobsToday = todayStmt.getAsObject().count;
  todayStmt.free();

  // Jobs by status
  const statusStmt = d.prepare('SELECT status, COUNT(*) as count FROM jobs GROUP BY status');
  const byStatus = {};
  while (statusStmt.step()) {
    const row = statusStmt.getAsObject();
    byStatus[row.status] = row.count;
  }
  statusStmt.free();

  // Token usage
  const specTokenStmt = d.prepare('SELECT COALESCE(SUM(token_usage), 0) as total FROM specs');
  specTokenStmt.step();
  const specTokens = specTokenStmt.getAsObject().total;
  specTokenStmt.free();

  const challengeTokenStmt = d.prepare('SELECT COALESCE(SUM(token_usage), 0) as total FROM challenges');
  challengeTokenStmt.step();
  const challengeTokens = challengeTokenStmt.getAsObject().total;
  challengeTokenStmt.free();

  const totalTokens = specTokens + challengeTokens;
  const estimatedCost = (totalTokens / 1000000) * 3; // rough estimate

  // Approval rate
  const reviewStmt = d.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN action IN ('approve','edit_approve') THEN 1 ELSE 0 END) as approved FROM reviews WHERE action != 'reject_final'");
  reviewStmt.step();
  const reviewRow = reviewStmt.getAsObject();
  reviewStmt.free();
  const approvalRate = reviewRow.total > 0 ? (reviewRow.approved / reviewRow.total * 100).toFixed(1) : 0;

  return {
    totalJobs,
    jobsToday,
    byStatus,
    totalTokens,
    estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    approvalRate: parseFloat(approvalRate),
  };
}
