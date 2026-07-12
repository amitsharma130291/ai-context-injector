/**
 * AI Context Injector — Content Script
 * Runs on all supported AI chat platforms.
 * Receives INJECT_CONTEXT messages from the popup and types the text into the active input.
 */

// ─── Platform selectors ───────────────────────────────────────────────────────
const PLATFORM_SELECTORS = [
  // ChatGPT
  '#prompt-textarea',
  'div[id="prompt-textarea"]',
  // Claude
  'div[contenteditable="true"].ProseMirror',
  '[data-testid="chat-input"]',
  // Gemini
  'rich-textarea div[contenteditable="true"]',
  'div.ql-editor[contenteditable="true"]',
  // Grok (x.com)
  'div[data-testid="tweetTextarea_0"]',
  'div.DraftEditor-editorContainer div[contenteditable="true"]',
  // Perplexity
  'textarea[placeholder]',
  // Mistral / Copilot / fallback
  'textarea',
  'div[contenteditable="true"]',
];

// ─── Find the active input ────────────────────────────────────────────────────
function findInput() {
  // Try focused element first
  const active = document.activeElement;
  if (active && isUsableInput(active)) return active;

  // Walk selectors in priority order
  for (const sel of PLATFORM_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && isUsableInput(el)) return el;
  }
  return null;
}

function isUsableInput(el) {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input' && el.type !== 'hidden') return true;
  if (el.contentEditable === 'true') return true;
  return false;
}

// ─── Insert text ──────────────────────────────────────────────────────────────
function insertText(el, text) {
  el.focus();

  // For contenteditable divs (Claude, Gemini, Grok)
  if (el.contentEditable === 'true') {
    // Try execCommand first (most compatible with React-controlled inputs)
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.textContent += text;
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return;
  }

  // For textarea / input (ChatGPT prompt-textarea, Perplexity)
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd   ?? el.value.length;
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  const separator = before.length > 0 && !before.endsWith('\n') ? '\n\n' : '';
  const newVal = before + separator + text + after;

  // Use native input setter to bypass React's synthetic event handling
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, newVal);
  } else {
    el.value = newVal;
  }

  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  // Place cursor at end of inserted text
  const cursorPos = start + separator.length + text.length;
  el.setSelectionRange(cursorPos, cursorPos);
}

// ─── Message listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'INJECT_CONTEXT') return;

  const el = findInput();
  if (!el) {
    sendResponse({ success: false, error: 'No input found' });
    return true;
  }

  try {
    insertText(el, message.text);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }

  return true; // keep channel open for async response
});

// ─── Optional: keyboard shortcut listener ────────────────────────────────────
// Alt+Shift+I opens the extension popup (registered via commands in manifest v3)
// This is just a visual hint — actual shortcut is set in manifest commands.
