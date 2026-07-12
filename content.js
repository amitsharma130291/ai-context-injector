/**
 * AI Context Injector v2 — Content Script
 * REPLACES input content (never appends). Handles React + contenteditable.
 */
const SELECTORS = [
  '#prompt-textarea',
  'div[id="prompt-textarea"]',
  'div[contenteditable="true"].ProseMirror',
  '[data-testid="chat-input"]',
  'rich-textarea div[contenteditable="true"]',
  'div.ql-editor[contenteditable="true"]',
  'div[data-testid="tweetTextarea_0"]',
  'div.DraftEditor-editorContainer div[contenteditable="true"]',
  'textarea[placeholder]',
  'textarea',
  'div[contenteditable="true"]',
];

function findInput() {
  const active = document.activeElement;
  if (active && isUsable(active)) return active;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el && isUsable(el)) return el;
  }
  return null;
}

function isUsable(el) {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag==='textarea' || (tag==='input'&&el.type!=='hidden') || el.contentEditable==='true';
}

function replaceContent(el, text) {
  el.focus();
  if (el.contentEditable === 'true') {
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.textContent = text;
    }
    el.dispatchEvent(new InputEvent('input', { bubbles:true, data:text, inputType:'insertText' }));
    return;
  }
  const setter =
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')?.set;
  if (setter) setter.call(el, text); else el.value = text;
  el.dispatchEvent(new Event('input',  { bubbles:true }));
  el.dispatchEvent(new Event('change', { bubbles:true }));
  el.setSelectionRange(text.length, text.length);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'INJECT_CONTEXT') return;
  const el = findInput();
  if (!el) { sendResponse({ success:false, error:'No input found' }); return true; }
  try { replaceContent(el, msg.text); sendResponse({ success:true }); }
  catch(e) { sendResponse({ success:false, error:e.message }); }
  return true;
});
