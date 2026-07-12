# ⚡ AI Context Injector v2

> Stop re-explaining your codebase to AI every single session.

A Chrome extension with **12 power features** — save context snippets with variables, inject into any AI chat with one click, multi-select, folders, stats, and more.

**No account. No server. All local.**

---

## ✨ Features (v2)

| Feature | Description |
|---------|-------------|
| 🔀 **Variables** | `{{project}}`, `{{task}}`, `{{date}}` — fill at inject time |
| 📊 **Token counter** | Live ~token estimate per snippet (GPT/Claude scale) |
| ☑️ **Multi-select inject** | Tick multiple snippets → inject as one combined block |
| 📌 **Pin/Star** | Star favourites — they always sort to the top |
| 📋 **Duplicate** | Clone any snippet as a starting point |
| ⌨️ **Keyboard shortcut** | `Alt+Shift+I` opens the popup without clicking |
| ⚡ **Quick task field** | One-tap update for today's task when on an AI tab |
| 🔝 **Auto-sort** | Most-used snippets automatically rise to the top |
| 💾 **Import/Export** | Backup to JSON, restore on new machine, share with team |
| 📁 **Folders** | Organise by project or client (Work, Freelance, Personal…) |
| 🖱️ **Right-click inject** | Right-click any AI input → inject from context menu |
| 📈 **Usage stats** | Injects, time saved, top snippets, folder breakdown |

---

## 🌐 Supported Platforms

ChatGPT · Claude · Gemini · Grok · Perplexity · Mistral · Copilot

---

## 🚀 Install

1. Clone: `git clone https://github.com/amitsharma130291/ai-context-injector.git`
2. Open `chrome://extensions` → Enable **Developer mode**
3. Click **Load unpacked** → select the folder
4. Pin ⚡ to your toolbar

---

## 💡 Variable Example

```
Project: {{project}}
Stack: {{stack}}
Task: {{task}}
Date: {{date}}
```

On inject → a modal asks for `project`, `stack`, `task` → `{{date}}` fills automatically.

---

## 🔒 Privacy

Zero data collection. All snippets in `chrome.storage.local`. Nothing leaves your browser.

---

## 📄 License

MIT
