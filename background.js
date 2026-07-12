/**
 * AI Context Injector — Service Worker (background.js)
 * Handles extension lifecycle events.
 */

// On install: set defaults and open welcome tab
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Open a welcome/onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  }
});

// Handle messages from popup that need background privileges
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] || null });
    });
    return true;
  }
});
