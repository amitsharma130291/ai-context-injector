/**
 * AI Context Injector — Content Script
 * Runs on all supported AI chat platforms.
 * Receives INJECT_CONTEXT messages from the popup and REPLACES the input content.
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
  const active = document.activeElement;
  if (active && isUsableInput(active)) return active;

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

// ─── Replace (not append) content ────────────────────────────────────────────
function replaceContent(el, text) {
  el.focus();

  // ── contenteditable (Claude, Gemini, Grok) ──
  if (el.contentEditable === 'true') {
    // Select all existing content and replace
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    // Insert new text
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      // Move cursor to end
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.textContent = text;
    }

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: text,
      inputType: 'insertText',
    }));
    return;
  }

  // ── textarea / input (ChatGPT, Perplexity) ──
  // Use native setter to bypass React's synthetic event system
  const nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

  if (nativeSetter) {
    nativeSetter.call(el, text);
  } else {
    el.value = text;
  }

  // Fire events React needs to pick up the new value
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  // Move cursor to end
  el.setSelectionRange(text.length, text.length);
}

// ─── Message listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'INJECT_CONTEXT') return;

  const el = findInput();
  if (!el) {
    sendResponse({ success: false, error: 'No input found on this page' });
    return true;
  }

  try {
    replaceContent(el, message.text);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }

  return true;
});
