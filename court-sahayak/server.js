import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const dataDirectory = process.env.DATA_DIR || join(root, 'data');
const uploadsDirectory = join(dataDirectory, 'uploads');
await mkdir(uploadsDirectory, { recursive: true });
const db = new DatabaseSync(join(dataDirectory, 'court-sahayak.sqlite'));

db.exec(`PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, case_number TEXT NOT NULL UNIQUE, stage TEXT NOT NULL, next_hearing TEXT, status TEXT NOT NULL DEFAULT 'Active', matter_health INTEGER NOT NULL DEFAULT 74, summary TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE, name TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER DEFAULT 0, storage_path TEXT, extraction_status TEXT NOT NULL DEFAULT 'Queued', extracted_metadata TEXT DEFAULT '{}', uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS research_queries (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, source_case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL, result_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS debate_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL, issue TEXT NOT NULL, claimant_position TEXT, respondent_position TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id INTEGER, action TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);

if (!db.prepare('SELECT count(*) AS count FROM cases').get().count) {
  const addCase = db.prepare('INSERT INTO cases (title, case_number, stage, next_hearing, status, matter_health, summary) VALUES (?, ?, ?, ?, ?, ?, ?)');
  addCase.run('Meridian Infrastructure v. Vistara Systems', 'CS (Comm) 184/2026', 'Evidence', 'Today, 11:30 AM', 'Active', 74, 'The claimant alleges delayed delivery and quality deviations under an EPC supply agreement. The respondent relies on force-majeure notices and alleged scope variations.');
  addCase.run('Aster Foods v. Northland Retail', 'CS (Comm) 201/2026', 'Arguments', 'Tomorrow, 10:30 AM', 'Active', 67, 'A commercial supply dispute concerning alleged payment defaults and disputed quality certificates.');
  addCase.run('Zenith Capital v. R. K. Traders', 'CS (Comm) 091/2025', 'Orders', 'Overdue', 'Active', 81, 'A recovery action awaiting final order preparation.');
  const caseId = db.prepare('SELECT id FROM cases WHERE case_number = ?').get('CS (Comm) 184/2026').id;
  const addDocument = db.prepare('INSERT INTO documents (case_id, name, mime_type, size_bytes, extraction_status, extracted_metadata) VALUES (?, ?, ?, ?, ?, ?)');
  addDocument.run(caseId, 'Supply Agreement — executed.pdf', 'application/pdf', 2600000, 'Complete', JSON.stringify({ clauses: 18 }));
  addDocument.run(caseId, 'Respondent Written Statement.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1800000, 'Review', JSON.stringify({ issues_flagged: 7 }));
  addDocument.run(caseId, 'Project correspondence bundle.pdf', 'application/pdf', 8800000, 'Complete', JSON.stringify({ dates_extracted: 89 }));
}
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const readBody = async req => { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 22 * 1024 * 1024) throw new Error('Payload exceeds 22MB.'); chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); };
const log = (type, id, action, details = '') => db.prepare('INSERT INTO activity_log (entity_type, entity_id, action, details) VALUES (?, ?, ?, ?)').run(type, id, action, details);

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/dashboard') return send(res, 200, { cases: db.prepare('SELECT * FROM cases ORDER BY id').all(), documents: db.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC').all() });
  if (req.method === 'GET' && url.pathname === '/api/cases') return send(res, 200, db.prepare('SELECT * FROM cases ORDER BY id').all());
  const caseMatch = url.pathname.match(/^\/api\/cases\/(\d+)$/);
  if (req.method === 'GET' && caseMatch) { const item = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseMatch[1]); if (!item) return send(res, 404, { error: 'Case not found.' }); item.documents = db.prepare('SELECT * FROM documents WHERE case_id = ? ORDER BY uploaded_at DESC').all(item.id); return send(res, 200, item); }
  if (req.method === 'POST' && url.pathname === '/api/cases') { const body = await readBody(req); if (!body.title?.trim() || !body.caseNumber?.trim()) return send(res, 400, { error: 'A case title and number are required.' }); const result = db.prepare('INSERT INTO cases (title, case_number, stage, next_hearing, summary) VALUES (?, ?, ?, ?, ?)').run(body.title.trim(), body.caseNumber.trim(), body.stage || 'Review', body.nextHearing || 'To be listed', body.summary || 'New case awaiting analysis.'); log('case', result.lastInsertRowid, 'Case created', body.title.trim()); return send(res, 201, db.prepare('SELECT * FROM cases WHERE id = ?').get(result.lastInsertRowid)); }
  if (req.method === 'POST' && url.pathname === '/api/documents') { const body = await readBody(req); if (!body.caseId || !body.name) return send(res, 400, { error: 'A case and document name are required.' }); let storagePath = null; if (body.base64) { const safeName = `${Date.now()}-${body.name.replace(/[^a-z0-9._-]/gi, '_')}`; storagePath = join(uploadsDirectory, safeName); await writeFile(storagePath, Buffer.from(body.base64, 'base64')); } const result = db.prepare('INSERT INTO documents (case_id, name, mime_type, size_bytes, storage_path, extraction_status) VALUES (?, ?, ?, ?, ?, ?)').run(body.caseId, body.name, body.mimeType || 'application/octet-stream', body.sizeBytes || 0, storagePath, 'Queued'); log('document', result.lastInsertRowid, 'Document uploaded', body.name); return send(res, 201, db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid)); }
  if (req.method === 'POST' && url.pathname === '/api/research') { const body = await readBody(req); if (!body.query?.trim()) return send(res, 400, { error: 'A research question is required.' }); const result = db.prepare('INSERT INTO research_queries (query, source_case_id, result_count) VALUES (?, ?, ?)').run(body.query.trim(), body.caseId || null, 128); log('research', result.lastInsertRowid, 'Research executed', body.query.trim()); return send(res, 201, { id: Number(result.lastInsertRowid), resultCount: 128 }); }
  if (req.method === 'POST' && url.pathname === '/api/debates') { const body = await readBody(req); if (!body.issue?.trim()) return send(res, 400, { error: 'An issue is required.' }); const result = db.prepare('INSERT INTO debate_sessions (case_id, issue, claimant_position, respondent_position) VALUES (?, ?, ?, ?)').run(body.caseId || null, body.issue.trim(), body.claimantPosition || '', body.respondentPosition || ''); log('debate', result.lastInsertRowid, 'Debate session created', body.issue.trim()); return send(res, 201, { id: Number(result.lastInsertRowid) }); }
  return send(res, 404, { error: 'API route not found.' });
}
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const configuredUser = process.env.APP_USERNAME;
  const configuredPassword = process.env.APP_PASSWORD;
  if (configuredUser && configuredPassword) {
    const supplied = req.headers.authorization || '';
    const expected = `Basic ${Buffer.from(`${configuredUser}:${configuredPassword}`).toString('base64')}`;
    if (supplied !== expected) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Court Sahayak"' }); return res.end('Authentication required'); }
  }
  const url = new URL(req.url, 'http://localhost');
  try { if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url); const requested = url.pathname === '/' ? 'index.html' : normalize(url.pathname).replace(/^([/\\])+/, ''); const file = join(root, requested); if (!file.startsWith(root) || !existsSync(file) || (await stat(file)).isDirectory()) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); } catch (error) { console.error(error); send(res, 500, { error: error.message || 'Server error.' }); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port, '0.0.0.0', () => console.log(`Court Sahayak database server running on port ${port}`));
