// AI Context Injector v2 — Service Worker

// On install: open welcome page + build context menus
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
  buildContextMenus();
});

chrome.runtime.onStartup.addListener(buildContextMenus);

// ─── Context menus ────────────────────────────────────────────────────────────
async function buildContextMenus() {
  chrome.contextMenus.removeAll(async () => {
    const { snippets = [] } = await chrome.storage.local.get('snippets');
    if (snippets.length === 0) return;

    chrome.contextMenus.create({
      id: 'aci-root',
      title: '⚡ Inject AI Context',
      contexts: ['editable'],
    });

    // Show top 10 by useCount
    const top = [...snippets]
      .sort((a,b) => (b.useCount||0)-(a.useCount||0))
      .slice(0, 10);

    for (const s of top) {
      chrome.contextMenus.create({
        id: `aci-${s.id}`,
        parentId: 'aci-root',
        title: s.title.slice(0, 50),
        contexts: ['editable'],
      });
    }
  });
}

// Rebuild menus when storage changes (new snippet saved)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.snippets) buildContextMenus();
});

// Handle right-click inject
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.menuItemId.startsWith('aci-')) return;
  const snippetId = info.menuItemId.replace('aci-','');
  const { snippets = [] } = await chrome.storage.local.get('snippets');
  const snippet = snippets.find(s => s.id === snippetId);
  if (!snippet) return;

  // Fill {{date}} automatically, leave others
  const text = snippet.content.replace(/\{\{date\}\}/g,
    new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}));

  // Increment use count
  snippet.useCount = (snippet.useCount||0) + 1;
  snippet.lastUsed = Date.now();
  await chrome.storage.local.set({ snippets });

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'INJECT_CONTEXT', text });
  } catch(_) {}
});

// Message relay
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active:true, currentWindow:true }, tabs => sendResponse({ tab: tabs[0]||null }));
    return true;
  }
});
