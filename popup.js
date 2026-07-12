// ─── State ───────────────────────────────────────────────────────────────────
let snippets = [];
let editingId = null;
let currentPlatform = null;
let searchQuery = '';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const snippetList   = document.getElementById('snippetList');
const emptyState    = document.getElementById('emptyState');
const editorPanel   = document.getElementById('editorPanel');
const searchInput   = document.getElementById('searchInput');
const platformBar   = document.getElementById('platformBar');
const platformLabel = document.getElementById('platformLabel');
const totalCount    = document.getElementById('totalCount');
const charCount     = document.getElementById('charCount');
const snippetContent = document.getElementById('snippetContent');

// ─── Platform detection ───────────────────────────────────────────────────────
const PLATFORMS = {
  'chatgpt.com':          { name: 'ChatGPT',   emoji: '🤖' },
  'chat.openai.com':      { name: 'ChatGPT',   emoji: '🤖' },
  'claude.ai':            { name: 'Claude',    emoji: '🟣' },
  'gemini.google.com':    { name: 'Gemini',    emoji: '💎' },
  'grok.com':             { name: 'Grok',      emoji: '𝕏' },
  'x.com':               { name: 'Grok',      emoji: '𝕏' },
  'chat.mistral.ai':      { name: 'Mistral',   emoji: '🌊' },
  'perplexity.ai':        { name: 'Perplexity',emoji: '🔍' },
  'copilot.microsoft.com':{ name: 'Copilot',   emoji: '🪟' },
};

async function detectPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    const hostname = url.hostname.replace(/^www\./, '');
    for (const [domain, info] of Object.entries(PLATFORMS)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return { ...info, tabId: tab.id };
      }
    }
  } catch (_) {}
  return null;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
async function loadSnippets() {
  const { snippets: saved } = await chrome.storage.local.get('snippets');
  snippets = saved || [];

  // Seed with a starter snippet if empty
  if (snippets.length === 0) {
    snippets = [{
      id: crypto.randomUUID(),
      title: '🚀 My Project Context',
      content: 'Project: [Your project name here]\nStack: [e.g. Next.js 14, TypeScript, Tailwind CSS, Prisma]\nDB: [e.g. PostgreSQL on Railway]\nCurrent task: [What you are working on right now]\n\nCoding conventions:\n- [e.g. Use functional components only]\n- [e.g. All API routes in /app/api]\n- [e.g. Use server actions for mutations]',
      tags: ['project', 'stack'],
      createdAt: Date.now(),
      useCount: 0,
    }];
    await saveSnippets();
  }
}

async function saveSnippets() {
  await chrome.storage.local.set({ snippets });
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderList() {
  const filtered = snippets.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) ||
           s.content.toLowerCase().includes(q) ||
           (s.tags || []).some(t => t.toLowerCase().includes(q));
  });

  totalCount.textContent = snippets.length;

  const showEditor  = editorPanel.style.display !== 'none';
  const showEmpty   = !showEditor && snippets.length === 0;
  const showList    = !showEditor && snippets.length > 0;

  emptyState.style.display   = showEmpty  ? 'flex' : 'none';
  snippetList.style.display  = showList   ? 'block' : 'none';

  if (!showList) return;

  if (filtered.length === 0) {
    snippetList.innerHTML = '<div class="no-results">No snippets match your search.</div>';
    return;
  }

  snippetList.innerHTML = filtered.map(s => `
    <div class="snippet-card" data-id="${s.id}">
      <div class="snippet-card-header">
        <span class="snippet-name">${escHtml(s.title)}</span>
        <div class="snippet-card-actions">
          <button class="btn-edit-card" data-action="edit" data-id="${s.id}">Edit</button>
          <button class="btn-inject" data-action="inject" data-id="${s.id}">
            ${currentPlatform ? `Inject → ${currentPlatform.emoji}` : 'Copy'}
          </button>
        </div>
      </div>
      <div class="snippet-preview">${escHtml(s.content.slice(0, 100).replace(/\n/g, ' '))}</div>
      ${s.tags?.length ? `<div class="tag-chips">${s.tags.map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('')}</div>` : ''}
    </div>
  `).join('');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Editor ───────────────────────────────────────────────────────────────────
function openEditor(snippet = null) {
  editingId = snippet?.id || null;

  document.getElementById('snippetTitle').value   = snippet?.title   || '';
  document.getElementById('snippetTags').value    = (snippet?.tags || []).join(', ');
  snippetContent.value                            = snippet?.content || '';
  charCount.textContent                           = snippetContent.value.length;

  document.getElementById('btnDeleteSnippet').style.display = snippet ? 'flex' : 'none';

  editorPanel.style.display  = 'flex';
  emptyState.style.display   = 'none';
  snippetList.style.display  = 'none';

  document.getElementById('snippetTitle').focus();
}

function closeEditor() {
  editingId = null;
  editorPanel.style.display = 'none';
  renderList();
}

async function saveSnippet() {
  const title   = document.getElementById('snippetTitle').value.trim();
  const content = snippetContent.value.trim();
  const tags    = document.getElementById('snippetTags').value
                    .split(',').map(t => t.trim()).filter(Boolean);

  if (!title) { document.getElementById('snippetTitle').focus(); return; }
  if (!content) { snippetContent.focus(); return; }

  if (editingId) {
    const idx = snippets.findIndex(s => s.id === editingId);
    if (idx !== -1) snippets[idx] = { ...snippets[idx], title, content, tags, updatedAt: Date.now() };
  } else {
    snippets.unshift({ id: crypto.randomUUID(), title, content, tags, createdAt: Date.now(), useCount: 0 });
  }

  await saveSnippets();
  closeEditor();
  showToast('Snippet saved ✓');
}

async function deleteSnippet() {
  if (!editingId) return;
  snippets = snippets.filter(s => s.id !== editingId);
  await saveSnippets();
  closeEditor();
  showToast('Snippet deleted');
}

// ─── Inject ───────────────────────────────────────────────────────────────────
async function injectOrCopy(id) {
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;

  // Increment use count
  snippet.useCount = (snippet.useCount || 0) + 1;
  await saveSnippets();

  if (currentPlatform) {
    try {
      await chrome.tabs.sendMessage(currentPlatform.tabId, {
        type: 'INJECT_CONTEXT',
        text: snippet.content,
      });
      showToast(`Injected into ${currentPlatform.name} ✓`);

      // Flash inject button green
      const btn = document.querySelector(`[data-action="inject"][data-id="${id}"]`);
      if (btn) {
        btn.textContent = '✓ Done';
        btn.classList.add('success');
        setTimeout(() => {
          btn.textContent = `Inject → ${currentPlatform.emoji}`;
          btn.classList.remove('success');
        }, 2000);
      }
    } catch (err) {
      // Fallback to clipboard
      await copyToClipboard(snippet.content);
      showToast('Copied to clipboard (inject failed)');
    }
  } else {
    await copyToClipboard(snippet.content);
    showToast('Copied to clipboard ✓');

    const btn = document.querySelector(`[data-action="inject"][data-id="${id}"]`);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      btn.classList.add('success');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('success');
      }, 2000);
    }
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ─── Event delegation ─────────────────────────────────────────────────────────
snippetList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'inject') await injectOrCopy(id);
  if (action === 'edit') openEditor(snippets.find(s => s.id === id));
});

document.getElementById('btnAddSnippet').addEventListener('click', () => openEditor());
document.getElementById('btnCreateFirst').addEventListener('click', () => openEditor());
document.getElementById('btnSaveSnippet').addEventListener('click', saveSnippet);
document.getElementById('btnCancelEdit').addEventListener('click', closeEditor);
document.getElementById('btnDeleteSnippet').addEventListener('click', deleteSnippet);

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderList();
});

snippetContent.addEventListener('input', () => {
  charCount.textContent = snippetContent.value.length;
});

// Save on Ctrl+S / Cmd+S inside editor
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && editorPanel.style.display !== 'none') {
    e.preventDefault();
    saveSnippet();
  }
  if (e.key === 'Escape' && editorPanel.style.display !== 'none') {
    closeEditor();
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await loadSnippets();

  currentPlatform = await detectPlatform();
  if (currentPlatform) {
    platformBar.classList.add('detected');
    platformLabel.innerHTML = `<span class="platform-dot"></span> ${currentPlatform.emoji} ${currentPlatform.name} detected — click Inject to insert`;
  } else {
    platformLabel.textContent = '💡 Open an AI chat tab to enable 1-click inject';
  }

  renderList();
})();
