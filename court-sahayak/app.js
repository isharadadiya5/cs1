const navButtons = document.querySelectorAll('[data-view]');
const views = document.querySelectorAll('.view');
const nav = document.querySelectorAll('.nav-link');
const toast = document.getElementById('toast');
const syncStatus = document.getElementById('sync-status');
let toastTimer;
let currentCaseId = 1;

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not save data.');
  return body;
};
function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); }
function setConnection(online) { syncStatus.textContent = online ? '● Database connected' : '● Offline preview'; syncStatus.className = `sync-status ${online ? 'online' : 'offline'}`; }
function switchView(id) { views.forEach(view => view.classList.toggle('active', view.id === id)); nav.forEach(button => button.classList.toggle('active', button.dataset.view === id)); const label = document.querySelector(`[data-view="${id}"]`)?.textContent.trim() || id; document.getElementById('page-eyebrow').innerHTML = `Judicial workspace <span>›</span> ${label}`; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function formatDocument(document) { const kind = document.name.split('.').pop().toUpperCase().slice(0, 3); return `<div class="document-row"><span class="file-icon ${kind === 'DOC' ? 'doc' : kind === 'MSG' ? 'msg' : ''}">${kind}</span><div><b>${document.name}</b><small>${Math.max(1, Math.round(document.size_bytes / 1000000))} MB · saved in case record</small></div><span class="status ${document.extraction_status === 'Complete' ? 'ok' : 'reviewing'}">${document.extraction_status}</span><button>›</button></div>`; }
async function loadData() {
  try {
    const data = await api('/dashboard'); setConnection(true);
    const activeCase = data.cases[0]; if (!activeCase) return;
    currentCaseId = activeCase.id;
    document.querySelector('.case-list').innerHTML = data.cases.map((item, index) => `<button class="case-row ${index === 0 ? 'selected' : ''}" data-case-id="${item.id}"><span class="case-initials ${index === 1 ? 'purple' : index === 2 ? 'orange' : 'blue'}">${item.title.split(' ').map(word => word[0]).join('').slice(0, 2)}</span><span class="case-title"><b>${item.title}</b><small>${item.case_number} · ${item.stage}</small></span><span class="tag ${item.next_hearing === 'Overdue' ? 'risk' : index === 0 ? 'today' : 'tomorrow'}">${item.next_hearing}</span><span class="chev">›</span></button>`).join('');
    document.querySelector('.documents-card').querySelectorAll('.document-row').forEach(node => node.remove());
    document.querySelector('.documents-card').insertAdjacentHTML('beforeend', data.documents.filter(item => item.case_id === activeCase.id).map(formatDocument).join(''));
    bindCaseRows();
  } catch (error) { setConnection(false); showToast('Open via the database server to save information.'); }
}
async function selectCase(id) {
  try {
    const item = await api(`/cases/${id}`); currentCaseId = item.id; document.getElementById('analysis-case').textContent = item.title;
    document.querySelector('.case-header .eyebrow').textContent = `${item.case_number} · ${item.stage.toUpperCase()} STAGE`;
    document.querySelector('.case-header p:last-child').textContent = `Before the Commercial Court, Delhi · Next hearing: ${item.next_hearing}`;
    document.querySelector('.summary-card > p').textContent = item.summary;
    document.querySelector('.score strong').textContent = item.matter_health;
    document.querySelector('.meter i').style.width = `${item.matter_health}%`;
    document.querySelector('.documents-card').querySelectorAll('.document-row').forEach(node => node.remove());
    document.querySelector('.documents-card').insertAdjacentHTML('beforeend', item.documents.map(formatDocument).join(''));
    document.querySelectorAll('.case-row').forEach(row => row.classList.toggle('selected', Number(row.dataset.caseId) === id)); switchView('analysis');
  } catch (error) { showToast(error.message); }
}
function bindCaseRows() { document.querySelectorAll('.case-row').forEach(row => row.addEventListener('click', () => selectCase(Number(row.dataset.caseId)))); }

navButtons.forEach(button => button.addEventListener('click', () => button.dataset.view && switchView(button.dataset.view)));
document.getElementById('run-research').addEventListener('click', async () => { const query = document.getElementById('research-input').value.trim(); try { const result = await api('/research', { method: 'POST', body: JSON.stringify({ query, caseId: currentCaseId }) }); document.getElementById('result-count').textContent = `${result.resultCount} authorities found`; showToast('Research saved to the database.'); } catch (error) { showToast(error.message); } });
document.getElementById('research-input').addEventListener('keydown', event => { if (event.key === 'Enter') document.getElementById('run-research').click(); });
document.getElementById('upload-doc').addEventListener('click', () => document.getElementById('file-upload').click());
document.getElementById('file-upload').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { const base64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer()))); await api('/documents', { method: 'POST', body: JSON.stringify({ caseId: currentCaseId, name: file.name, mimeType: file.type, sizeBytes: file.size, base64 }) }); showToast(`${file.name} saved to the case record.`); await selectCase(currentCaseId); } catch (error) { showToast(error.message); } finally { event.target.value = ''; } });
document.getElementById('generate-brief').addEventListener('click', () => showToast('Judicial brief is based on the persisted case record.'));
document.getElementById('analyze-docs').addEventListener('click', () => showToast('All saved documents queued for evidence extraction.'));
document.getElementById('new-case').addEventListener('click', async () => { const title = window.prompt('Case title'); const caseNumber = title && window.prompt('Case number'); if (!title || !caseNumber) return; try { const item = await api('/cases', { method: 'POST', body: JSON.stringify({ title, caseNumber }) }); await loadData(); await selectCase(item.id); showToast('New case saved to the database.'); } catch (error) { showToast(error.message); } });
document.getElementById('search-button').addEventListener('click', () => { switchView('research'); document.getElementById('research-input').focus(); });
document.getElementById('new-debate').addEventListener('click', async () => { try { await api('/debates', { method: 'POST', body: JSON.stringify({ caseId: currentCaseId, issue: 'Contractual notice compliance' }) }); showToast('Debate session saved to the database.'); } catch (error) { showToast(error.message); } });
document.querySelectorAll('.question').forEach(button => button.addEventListener('click', () => switchView('research')));
loadData();
