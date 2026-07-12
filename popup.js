// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS = {
  'chatgpt.com':           { name:'ChatGPT',    emoji:'🤖' },
  'chat.openai.com':       { name:'ChatGPT',    emoji:'🤖' },
  'claude.ai':             { name:'Claude',     emoji:'🟣' },
  'gemini.google.com':     { name:'Gemini',     emoji:'💎' },
  'grok.com':              { name:'Grok',       emoji:'𝕏'  },
  'x.com':                 { name:'Grok',       emoji:'𝕏'  },
  'chat.mistral.ai':       { name:'Mistral',    emoji:'🌊' },
  'perplexity.ai':         { name:'Perplexity', emoji:'🔍' },
  'copilot.microsoft.com': { name:'Copilot',    emoji:'🪟' },
};

// Token estimator: ~4 chars per token (rough GPT/Claude approximation)
const estimateTokens = str => Math.ceil(str.length / 4);
const tokenClass = t => t > 3000 ? 'danger' : t > 1500 ? 'warn' : '';

// Extract {{variable}} names from text
const extractVars = text => {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2,-2).trim()))];
};

// Replace variables in text
const fillVars = (text, vals) => {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    if (k === 'date') return new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
    return vals[k] !== undefined ? vals[k] : `{{${k}}}`;
  });
};

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── State ────────────────────────────────────────────────────────────────────
let snippets     = [];
let folders      = ['General', 'Work', 'Personal', 'Freelance'];
let quickTask    = '';
let editingId    = null;
let selectedIds  = new Set();
let searchQuery  = '';
let folderFilter = '__all__';
let currentPlatform = null;
let pendingInjectText = null; // used by variable modal

// ─── Storage helpers ──────────────────────────────────────────────────────────
async function load() {
  const data = await chrome.storage.local.get(['snippets','folders','quickTask']);
  snippets  = data.snippets  || [];
  folders   = data.folders   || ['General', 'Work', 'Personal', 'Freelance'];
  quickTask = data.quickTask || '';
  if (snippets.length === 0) {
    snippets = [{
      id: crypto.randomUUID(), title: '🚀 My Project Context',
      content: 'Project: {{project}}\nStack: {{stack}}\nTask: {{task}}\nDate: {{date}}\n\nCoding conventions:\n- Functional components only\n- TypeScript strict mode\n- No class components',
      tags:['project','stack'], folder:'General', pinned:false, useCount:0, createdAt:Date.now(),
    }];
    await save();
  }
}

async function save() {
  await chrome.storage.local.set({ snippets, folders, quickTask });
}

// ─── Platform detection ───────────────────────────────────────────────────────
async function detectPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    if (!tab?.url) return null;
    const hostname = new URL(tab.url).hostname.replace(/^www\./,'');
    for (const [domain, info] of Object.entries(PLATFORMS)) {
      if (hostname === domain || hostname.endsWith('.'+domain)) return { ...info, tabId:tab.id };
    }
  } catch(_) {}
  return null;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function getFiltered() {
  let list = [...snippets];
  // folder filter
  if (folderFilter !== '__all__') list = list.filter(s => (s.folder||'') === folderFilter);
  // search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q) ||
      (s.tags||[]).some(t => t.toLowerCase().includes(q)) ||
      (s.folder||'').toLowerCase().includes(q)
    );
  }
  // sort: pinned first, then by useCount desc, then by createdAt desc
  list.sort((a,b) => {
    if (b.pinned !== a.pinned) return (b.pinned?1:0)-(a.pinned?1:0);
    if ((b.useCount||0) !== (a.useCount||0)) return (b.useCount||0)-(a.useCount||0);
    return (b.createdAt||0)-(a.createdAt||0);
  });
  return list;
}

function renderFolderOptions() {
  const ff = document.getElementById('folderFilter');
  const sf = document.getElementById('snippetFolder');
  ff.innerHTML = '<option value="__all__">All folders</option>' +
    folders.map(f => `<option value="${esc(f)}"${folderFilter===f?' selected':''}>${esc(f)}</option>`).join('');
  sf.innerHTML = '<option value="">📁 No folder</option>' +
    folders.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
}

function renderList() {
  const sl  = document.getElementById('snippetList');
  const es  = document.getElementById('emptyState');
  const ep  = document.getElementById('editorPanel');
  const sp  = document.getElementById('statsPanel');
  const tc  = document.getElementById('totalCount');
  const mb  = document.getElementById('multiBar');
  const mc  = document.getElementById('multiCount');

  tc.textContent = snippets.length;

  // Multi-bar
  if (selectedIds.size > 0) {
    mb.style.display = 'flex';
    mc.textContent = `${selectedIds.size} selected`;
  } else {
    mb.style.display = 'none';
  }

  const showEditor = ep.style.display !== 'none';
  const showStats  = sp.style.display !== 'none';
  if (showEditor || showStats) { sl.style.display='none'; es.style.display='none'; return; }

  const filtered = getFiltered();
  if (snippets.length === 0) { sl.style.display='none'; es.style.display='flex'; return; }
  sl.style.display='block'; es.style.display='none';

  if (filtered.length === 0) { sl.innerHTML='<div class="no-results">No snippets match.</div>'; return; }

  // Group by folder
  const groups = {};
  for (const s of filtered) {
    const g = s.folder || '';
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }

  const groupKeys = Object.keys(groups).sort((a,b) => {
    if (!a) return 1; if (!b) return -1; return a.localeCompare(b);
  });

  const showGroups = folderFilter === '__all__' && groupKeys.length > 1;

  sl.innerHTML = groupKeys.map(gk => {
    const cards = groups[gk].map(s => renderCard(s)).join('');
    if (showGroups && gk) {
      return `<div class="folder-group">
        <div class="folder-group-label">📁 ${esc(gk)}</div>
        ${cards}
      </div>`;
    }
    return cards;
  }).join('');
}

function renderCard(s) {
  const tokens = estimateTokens(s.content);
  const tc = tokenClass(tokens);
  const vars = extractVars(s.content);
  const hasVars = vars.length > 0;
  const isSelected = selectedIds.has(s.id);

  // Preview: highlight variables
  const previewRaw = s.content.slice(0,90).replace(/\n/g,' ');
  const preview = previewRaw.replace(/\{\{[^}]+\}\}/g,
    m => `<span class="var-highlight">${esc(m)}</span>`);

  const injectLabel = currentPlatform
    ? `Inject ${currentPlatform.emoji}`
    : 'Copy';

  return `<div class="snippet-card${isSelected?' selected':''}${s.pinned?' pinned':''}" data-id="${s.id}">
    <div class="card-top">
      <div class="card-check${isSelected?' checked':''}" data-action="select" data-id="${s.id}">${isSelected?'✓':''}</div>
      <span class="snippet-name">${esc(s.title)}</span>
      <span class="pin-star${s.pinned?' pinned':''}" data-action="pin" data-id="${s.id}" title="${s.pinned?'Unpin':'Pin'}">${s.pinned?'📌':'☆'}</span>
      <span class="token-badge${tc?' '+tc:''}">~${tokens}t</span>
    </div>
    <div class="card-preview">${preview}${hasVars?` <span class="var-highlight">[${vars.length} var${vars.length>1?'s':''}]</span>`:''}</div>
    <div class="card-actions">
      <div class="tag-chips">${(s.tags||[]).slice(0,3).map(t=>`<span class="tag-chip">${esc(t)}</span>`).join('')}</div>
      <span class="use-count">${s.useCount||0}×</span>
      <button class="btn-dupe-card" data-action="dupe" data-id="${s.id}" title="Duplicate">📋</button>
      <button class="btn-edit-card" data-action="edit" data-id="${s.id}">Edit</button>
      <button class="btn-inject-card" data-action="inject" data-id="${s.id}">${injectLabel}</button>
    </div>
  </div>`;
}

// ─── Editor ───────────────────────────────────────────────────────────────────
function openEditor(snippet=null) {
  editingId = snippet?.id || null;
  document.getElementById('snippetTitle').value   = snippet?.title   || '';
  document.getElementById('snippetTags').value    = (snippet?.tags||[]).join(', ');
  document.getElementById('snippetContent').value = snippet?.content || '';
  document.getElementById('snippetFolder').value  = snippet?.folder  || '';
  document.getElementById('btnDeleteSnippet').style.display    = snippet ? 'flex' : 'none';
  document.getElementById('btnDuplicateSnippet').style.display = snippet ? 'flex' : 'none';
  updateEditorCounts();
  document.getElementById('editorPanel').style.display  = 'flex';
  document.getElementById('statsPanel').style.display   = 'none';
  document.getElementById('snippetList').style.display  = 'none';
  document.getElementById('emptyState').style.display   = 'none';
  document.getElementById('snippetTitle').focus();
  renderFolderOptions();
  if (snippet?.folder) document.getElementById('snippetFolder').value = snippet.folder;
}

function closeEditor() {
  editingId = null;
  document.getElementById('editorPanel').style.display = 'none';
  renderList();
}

function updateEditorCounts() {
  const text = document.getElementById('snippetContent').value;
  document.getElementById('charCount').textContent  = text.length;
  document.getElementById('tokenCount').textContent = estimateTokens(text);
  const vars = extractVars(text);
  const vc = document.getElementById('varCount');
  if (vars.length > 0) {
    vc.style.display = 'inline';
    vc.textContent = `${vars.length} variable${vars.length>1?'s':''}: ${vars.map(v=>`{{${v}}}`).join(' ')}`;
  } else {
    vc.style.display = 'none';
  }
}

async function saveSnippet() {
  const title   = document.getElementById('snippetTitle').value.trim();
  const content = document.getElementById('snippetContent').value.trim();
  const tags    = document.getElementById('snippetTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const folder  = document.getElementById('snippetFolder').value;
  if (!title) { document.getElementById('snippetTitle').focus(); return; }
  if (!content) { document.getElementById('snippetContent').focus(); return; }

  if (editingId) {
    const idx = snippets.findIndex(s=>s.id===editingId);
    if (idx!==-1) snippets[idx] = {...snippets[idx], title, content, tags, folder, updatedAt:Date.now()};
  } else {
    snippets.unshift({id:crypto.randomUUID(), title, content, tags, folder,
      pinned:false, useCount:0, createdAt:Date.now()});
  }
  await save();
  closeEditor();
  showToast('Snippet saved ✓');
}

async function deleteSnippet() {
  if (!editingId) return;
  snippets = snippets.filter(s=>s.id!==editingId);
  await save();
  closeEditor();
  showToast('Deleted');
}

async function duplicateSnippet(id) {
  const src = snippets.find(s=>s.id===id);
  if (!src) return;
  const copy = {...src, id:crypto.randomUUID(), title:`${src.title} (copy)`,
    pinned:false, useCount:0, createdAt:Date.now()};
  const idx = snippets.findIndex(s=>s.id===id);
  snippets.splice(idx+1, 0, copy);
  await save();
  renderList();
  showToast('Duplicated ✓');
}

async function togglePin(id) {
  const s = snippets.find(s=>s.id===id);
  if (!s) return;
  s.pinned = !s.pinned;
  await save();
  renderList();
  showToast(s.pinned ? 'Pinned 📌' : 'Unpinned');
}

// ─── Inject / Copy ───────────────────────────────────────────────────────────
async function injectSnippet(id) {
  const s = snippets.find(s=>s.id===id);
  if (!s) return;

  const vars = extractVars(s.content);
  // Remove {{date}} from required vars — auto-filled
  const manualVars = vars.filter(v=>v!=='date');

  if (manualVars.length > 0) {
    openVarModal(s.content, manualVars, async (filledText) => {
      await doInject(s, filledText);
    });
  } else {
    const text = fillVars(s.content, {});
    await doInject(s, text);
  }
}

async function doInject(s, text) {
  s.useCount = (s.useCount||0) + 1;
  s.lastUsed = Date.now();
  await save();

  if (currentPlatform) {
    try {
      const resp = await chrome.tabs.sendMessage(currentPlatform.tabId, { type:'INJECT_CONTEXT', text });
      if (resp?.success) {
        showToast(`Injected into ${currentPlatform.name} ✓`);
        return;
      }
    } catch(_) {}
  }
  await copyToClipboard(text);
  showToast('Copied to clipboard ✓');
  renderList();
}

async function injectMultiple() {
  if (selectedIds.size === 0) return;
  const parts = [...selectedIds].map(id => snippets.find(s=>s.id===id)).filter(Boolean);
  const combined = parts.map(s => {
    const vars = extractVars(s.content);
    const manualVars = vars.filter(v=>v!=='date');
    // For multi-inject, fill date auto but leave other vars as-is
    return fillVars(s.content, {});
  }).join('\n\n---\n\n');

  for (const s of parts) { s.useCount=(s.useCount||0)+1; s.lastUsed=Date.now(); }
  await save();

  if (currentPlatform) {
    try {
      const resp = await chrome.tabs.sendMessage(currentPlatform.tabId, { type:'INJECT_CONTEXT', text:combined });
      if (resp?.success) {
        showToast(`${parts.length} snippets injected ✓`);
        selectedIds.clear(); renderList(); return;
      }
    } catch(_) {}
  }
  await copyToClipboard(combined);
  showToast(`${parts.length} snippets copied ✓`);
  selectedIds.clear(); renderList();
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch(_) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}

// ─── Variable Modal ───────────────────────────────────────────────────────────
function openVarModal(template, vars, onInject) {
  const modal  = document.getElementById('varModal');
  const fields = document.getElementById('varFields');

  fields.innerHTML = vars.map(v => {
    const isTask = v === 'task';
    return `<div class="var-field">
      <label>{{${esc(v)}}}</label>
      <input type="text" data-var="${esc(v)}" placeholder="${isTask ? 'What are you working on?' : `Enter ${esc(v)}…`}" value="${isTask && quickTask ? esc(quickTask) : ''}"/>
    </div>`;
  }).join('');

  modal.style.display = 'flex';
  modal.querySelector('input')?.focus();

  document.getElementById('btnVarInject').onclick = async () => {
    const vals = {};
    fields.querySelectorAll('input[data-var]').forEach(el => { vals[el.dataset.var] = el.value; });
    if (vals.task) { quickTask = vals.task; await save(); updateQuickTask(); }
    const filled = fillVars(template, vals);
    modal.style.display = 'none';
    onInject(filled);
  };

  document.getElementById('btnVarSkip').onclick = () => {
    modal.style.display = 'none';
    onInject(fillVars(template, {}));
  };

  document.getElementById('btnVarClose').onclick = () => {
    modal.style.display = 'none';
  };

  // Enter to inject
  fields.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnVarInject').click();
  });
}

// ─── Quick Task ───────────────────────────────────────────────────────────────
function updateQuickTask() {
  const bar = document.getElementById('quickTaskBar');
  const inp = document.getElementById('quickTaskInput');
  if (currentPlatform) {
    bar.style.display = 'flex';
    inp.value = quickTask || '';
  } else {
    bar.style.display = 'none';
  }
}

// ─── Stats Panel ─────────────────────────────────────────────────────────────
function openStats() {
  document.getElementById('editorPanel').style.display  = 'none';
  document.getElementById('snippetList').style.display  = 'none';
  document.getElementById('emptyState').style.display   = 'none';
  document.getElementById('statsPanel').style.display   = 'flex';

  const totalInjects = snippets.reduce((a,s)=>a+(s.useCount||0),0);
  const timeSavedMin = Math.round(totalInjects * 2.5); // assume 2.5 min saved per inject
  const topSnippets  = [...snippets].sort((a,b)=>(b.useCount||0)-(a.useCount||0)).slice(0,5);
  const totalTokens  = snippets.reduce((a,s)=>a+estimateTokens(s.content),0);

  document.getElementById('statsBody').innerHTML = `
    <div class="big-stat">
      <div class="big-stat-card"><div class="big-stat-num">${snippets.length}</div><div class="big-stat-label">Snippets</div></div>
      <div class="big-stat-card"><div class="big-stat-num">${totalInjects}</div><div class="big-stat-label">Injects</div></div>
      <div class="big-stat-card"><div class="big-stat-num">${timeSavedMin}m</div><div class="big-stat-label">Time saved</div></div>
      <div class="big-stat-card"><div class="big-stat-num">${totalTokens.toLocaleString()}</div><div class="big-stat-label">Total tokens</div></div>
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Most used snippets</div>
      ${topSnippets.length === 0 ? '<div class="no-results">No injects yet — start injecting!</div>' :
        (() => {
          const max = topSnippets[0].useCount || 1;
          return topSnippets.map(s => `
            <div class="stat-row">
              <span class="stat-name">${esc(s.title)}</span>
              <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(((s.useCount||0)/max)*100)}%"></div></div>
              <span class="stat-val">${s.useCount||0}×</span>
            </div>`).join('');
        })()
      }
    </div>
    <div class="stats-section">
      <div class="stats-section-title">By folder</div>
      ${(() => {
        const byFolder = {};
        snippets.forEach(s => {
          const f = s.folder || 'Unfoldered';
          byFolder[f] = (byFolder[f]||0) + (s.useCount||0);
        });
        const maxF = Math.max(1, ...Object.values(byFolder));
        return Object.entries(byFolder).sort((a,b)=>b[1]-a[1]).map(([f,c]) => `
          <div class="stat-row">
            <span class="stat-name">📁 ${esc(f)}</span>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round((c/maxF)*100)}%"></div></div>
            <span class="stat-val">${c}×</span>
          </div>`).join('') || '<div class="no-results">No folders yet.</div>';
      })()}
    </div>`;
}

// ─── Import / Export ─────────────────────────────────────────────────────────
async function exportSnippets() {
  const data = {
    version: 2, exportedAt: new Date().toISOString(),
    snippets, folders, quickTask,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ai-context-snippets-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Exported ✓');
}

async function importSnippets(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = data.snippets || data; // support array or object
    if (!Array.isArray(incoming)) { showToast('Invalid file format'); return; }
    // Merge: skip duplicates by id
    const existingIds = new Set(snippets.map(s=>s.id));
    let added = 0;
    for (const s of incoming) {
      if (!existingIds.has(s.id)) { snippets.push(s); added++; }
    }
    if (data.folders) folders = [...new Set([...folders, ...data.folders])];
    await save();
    renderFolderOptions();
    renderList();
    showToast(`Imported ${added} snippet${added!==1?'s':''} ✓`);
  } catch(e) {
    showToast('Import failed: invalid JSON');
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration=2200) {
  let t = document.getElementById('toast');
  if (!t) { t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), duration);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────
document.getElementById('snippetList').addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  if (action==='inject') { await injectSnippet(id); renderList(); }
  if (action==='edit')   openEditor(snippets.find(s=>s.id===id));
  if (action==='pin')    await togglePin(id);
  if (action==='dupe')   await duplicateSnippet(id);
  if (action==='select') {
    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
    renderList();
  }
});

document.getElementById('btnAddSnippet').addEventListener('click', ()=>openEditor());
document.getElementById('btnCreateFirst').addEventListener('click', ()=>openEditor());
document.getElementById('btnSaveSnippet').addEventListener('click', saveSnippet);
document.getElementById('btnCancelEdit').addEventListener('click', closeEditor);
document.getElementById('btnDeleteSnippet').addEventListener('click', deleteSnippet);
document.getElementById('btnDuplicateSnippet').addEventListener('click', ()=>{
  if (editingId) { const id=editingId; closeEditor(); duplicateSnippet(id); }
});

document.getElementById('btnMultiInject').addEventListener('click', injectMultiple);
document.getElementById('btnMultiClear').addEventListener('click', ()=>{ selectedIds.clear(); renderList(); });

document.getElementById('btnStats').addEventListener('click', ()=>{
  if (document.getElementById('statsPanel').style.display!=='none') {
    document.getElementById('statsPanel').style.display='none'; renderList();
  } else { openStats(); }
});
document.getElementById('btnStatsClose').addEventListener('click', ()=>{
  document.getElementById('statsPanel').style.display='none'; renderList();
});

document.getElementById('btnExport').addEventListener('click', exportSnippets);
document.getElementById('btnImport').addEventListener('click', ()=>document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e=>{
  if (e.target.files[0]) importSnippets(e.target.files[0]);
  e.target.value='';
});

document.getElementById('searchInput').addEventListener('input', e=>{
  searchQuery=e.target.value; renderList();
});
document.getElementById('folderFilter').addEventListener('change', e=>{
  folderFilter=e.target.value; renderList();
});

document.getElementById('snippetContent').addEventListener('input', updateEditorCounts);

document.getElementById('btnQtSave').addEventListener('click', async ()=>{
  quickTask = document.getElementById('quickTaskInput').value.trim();
  await save();
  showToast('Task updated ✓');
});
document.getElementById('quickTaskInput').addEventListener('keydown', e=>{
  if (e.key==='Enter') document.getElementById('btnQtSave').click();
});

// Keyboard shortcuts
document.addEventListener('keydown', e=>{
  const inEditor = document.getElementById('editorPanel').style.display!=='none';
  if ((e.ctrlKey||e.metaKey) && e.key==='s' && inEditor) { e.preventDefault(); saveSnippet(); }
  if (e.key==='Escape') {
    if (document.getElementById('varModal').style.display!=='none') {
      document.getElementById('varModal').style.display='none'; return;
    }
    if (inEditor) { closeEditor(); return; }
    if (document.getElementById('statsPanel').style.display!=='none') {
      document.getElementById('statsPanel').style.display='none'; renderList(); return;
    }
  }
  if ((e.ctrlKey||e.metaKey) && e.key==='n' && !inEditor) { e.preventDefault(); openEditor(); }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async ()=>{
  await load();
  currentPlatform = await detectPlatform();

  const pb = document.getElementById('platformBar');
  const pl = document.getElementById('platformLabel');
  if (currentPlatform) {
    pb.classList.add('detected');
    pl.innerHTML = `<span class="platform-dot"></span>${currentPlatform.emoji} ${currentPlatform.name} — click Inject to insert`;
  } else {
    pl.textContent = '💡 Open ChatGPT, Claude, Gemini or Grok to enable inject';
  }

  updateQuickTask();
  renderFolderOptions();
  renderList();
})();
