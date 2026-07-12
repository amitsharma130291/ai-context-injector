# ⚡ AI Context Injector

> Stop re-explaining your codebase to AI every single session.

A Chrome extension that lets you save project context, coding rules, and task notes as reusable snippets — then inject them into **any AI chat** with one click.

**No account. No server. All local. Works in 60 seconds.**

---

## 🎯 The Problem

Every developer using Claude, ChatGPT, Gemini, or Grok hits the same wall daily:

> New chat = blank slate. You spend 5–10 minutes re-explaining your stack, conventions, and current task. Then you hit the context limit and do it all over again.

## ✨ The Solution

Save your context once. Inject it anywhere with one click.

---

## 🛠 Features

- **Save snippets** — project summaries, stack descriptions, coding rules, current task context
- **1-click inject** — directly into the AI chat input (no copy-paste needed)
- **Auto-detects platform** — knows when you're on ChatGPT, Claude, Gemini, Grok, etc.
- **Copy fallback** — copies to clipboard if inject isn't available
- **Tag & search** — organise and find snippets fast
- **Char counter** — track snippet length
- **Keyboard shortcuts** — `Ctrl+S` to save, `Esc` to cancel
- **Zero trust** — nothing leaves your browser, ever

---

## 🌐 Supported Platforms

| Platform | Status |
|----------|--------|
| ChatGPT (chatgpt.com) | ✅ Full inject |
| Claude (claude.ai) | ✅ Full inject |
| Gemini (gemini.google.com) | ✅ Full inject |
| Grok (grok.com / x.com) | ✅ Full inject |
| Perplexity (perplexity.ai) | ✅ Full inject |
| Mistral (chat.mistral.ai) | ✅ Full inject |
| Microsoft Copilot | ✅ Full inject |

---

## 🚀 Install (Local / Dev)

1. Clone this repo:
   ```bash
   git clone https://github.com/amitsharma130291/ai-context-injector.git
   cd ai-context-injector
   ```

2. Open Chrome → `chrome://extensions`

3. Enable **Developer mode** (top right toggle)

4. Click **Load unpacked** → select the repo folder

5. Pin the ⚡ extension to your toolbar

6. Open any AI chat tab → click the extension → hit **Inject**

---

## 📁 Project Structure

```
ai-context-injector/
├── manifest.json        # Extension manifest (MV3)
├── popup.html           # Extension popup UI
├── popup.css            # Popup styles (dark theme)
├── popup.js             # Popup logic: snippets CRUD, inject, search
├── content.js           # Content script: finds input, inserts text
├── background.js        # Service worker: install events
├── welcome.html         # Onboarding page (shown on first install)
└── icons/               # Extension icons (16, 32, 48, 128px)
```

---

## 💡 Usage Tips

**Starter snippet ideas:**
```
Project: My SaaS app
Stack: Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL
Conventions: server components by default, client components only when needed
Current task: Refactor the auth flow to use Next-Auth v5
```

```
You are helping me debug a React performance issue.
The app uses React 18 + Vite. The component tree is:
App → Dashboard → DataGrid (virtualized) → Row
The lag happens when sorting 10k+ rows.
```

**Pro tip:** Use tags to organise by project. Search is instant.

---

## 🗺 Roadmap

- [ ] Variables in snippets (`{{project_name}}`, `{{date}}`)
- [ ] Import/export snippets (JSON)
- [ ] Team shared library (optional sync)
- [ ] Snippet templates for popular stacks
- [ ] Usage analytics (local only)
- [ ] Firefox support

---

## 🔒 Privacy

- **Zero data collection.** No analytics, no tracking, no server.
- All snippets stored in `chrome.storage.local` on your device.
- The extension only activates on supported AI chat domains.
- Source is fully open — read every line.

---

## 📄 License

MIT — free to use, modify, and distribute.

---

## 🤝 Contributing

PRs welcome. Please open an issue first to discuss major changes.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Open a PR

---

*Built because re-explaining your codebase to AI every day is a waste of your time.*
