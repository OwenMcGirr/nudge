# Nudge — Design Spec

**Date:** 2026-04-13  
**Repo:** owenmcgirr/nudge  
**Status:** Approved

## What It Is

A Windows desktop app that monitors your typing across all applications and automatically shows AI-powered sentence completions after you pause for 2 seconds. Accept with Tab, dismiss with Esc or by continuing to type.

100% local — powered by Ollama running `qwen2.5:7b`.

---

## Architecture

```
Main Process (Node.js / Electron)
├── KeyboardMonitor   — captures keystrokes via @tkomde/iohook, maintains text buffer
├── OllamaClient      — sends buffer to qwen2.5:7b after 2s debounce, gets completion
├── TextInjector      — inserts accepted text via @xitanggg/node-insert-text
└── WindowManager     — manages the frameless transparent suggestion overlay

Suggestion Overlay (React, BrowserWindow)
└── Displays completion + "Tab to accept • Esc to dismiss"
```

---

## User Flow

1. User types in any app
2. After **2 seconds of silence**, Ollama generates a completion from the last 500 chars of the buffer
3. Overlay appears near the cursor with the suggested completion
4. **Tab** → inject completion, hide overlay
5. **Esc** or **any other key** → dismiss overlay, resume typing normally

---

## Key Behaviours

| Behaviour | Detail |
|-----------|--------|
| Debounce | 2s timer resets on every keystroke |
| Cancellation | If user types during generation, request is aborted and timer resets |
| Auto-dismiss | Overlay hides immediately when user types again |
| Minimum buffer | Only trigger if buffer ≥ 10 characters |
| Generation timeout | Cancel request if Ollama takes >5s |
| Ollama offline | Show "Nudge: Ollama offline" tray tooltip, no crash |
| Bad/empty response | Silently discard, no overlay shown |

---

## Tech Stack

| Concern | Package |
|---------|---------|
| Desktop framework | Electron (latest stable) |
| Language | TypeScript |
| UI | React 19 |
| Build | Vite |
| Keyboard monitoring | `@tkomde/iohook` |
| Text injection | `@xitanggg/node-insert-text` |
| Ollama | `ollama` npm package |
| Settings persistence | `electron-store` |

---

## Hardcoded Config (v1)

- **Model:** `qwen2.5:7b`
- **Trigger:** 2s debounce after last keystroke
- **Accept:** Tab (intercepted by iohook when overlay is visible)
- **Dismiss:** Esc or any non-Tab key when overlay is visible
- **Buffer size:** 500 chars (rolling)
- **Min buffer to trigger:** 10 chars
- **Max completion:** 10 words
- **Generation timeout:** 5s

---

## Overlay UI

- Frameless, transparent, always-on-top window
- Positioned 20px below cursor, boundary-clamped to display
- Dark frosted-glass style (matches the spec)
- Shows: suggestion text + "Tab to accept • Esc to dismiss" hint
- `focusable: false` so it never steals focus from the active app

---

## Out of Scope (v1)

- Settings window
- macOS / Linux support
- Multiple model selection
- Custom trigger delay
- Tray icon menu
