# Nudge

AI-powered autocomplete for your desktop.

Nudge is an Electron app that watches recent typing, reads focused text when Windows UI Automation exposes it, asks a local Ollama model for a short continuation, and shows the suggestion in a small overlay near the cursor.

Click the suggestion to insert it. Click `Dismiss` to hide it.

## Requirements

- Windows
- Node.js
- npm
- Ollama running locally on `http://localhost:11434`
- The `qwen2.5:7b` Ollama model

Install the model with:

```sh
ollama pull qwen2.5:7b
```

## Install

```sh
npm install
```

The `postinstall` script rebuilds the native keyboard hook dependency for the Electron runtime.

## Run

Start Ollama first, then run:

```sh
npm run dev
```

After you pause while typing, Nudge builds context from the focused input when available, otherwise from its recent keyboard buffer. Suggestions are generated locally and inserted into the active app when accepted.

## Controls

- Click the suggestion to accept it.
- Click `Dismiss` to hide it.
- Pressing another key while the overlay is visible dismisses the suggestion.
- `Tab` is not used for accept because the focused app can also handle it and move focus.
- Use the Nudge tray icon menu to quit the app.

## Scripts

```sh
npm run dev
```

Run the Electron app in development mode.

```sh
npm test
```

Run the Vitest test suite.

```sh
npm run build
```

Build the Electron main process, preload script, and renderer.

```sh
npm run inspect-focused-text
```

Inspect the currently focused Windows UI Automation element and print the text/value patterns it exposes. By default this prints metadata and character counts only.

To include short text previews in PowerShell:

```powershell
$env:SHOW_FOCUSED_TEXT = '1'; npm run inspect-focused-text
```

## How Autocomplete Works

The main process records typed characters in a rolling buffer and waits for a short pause. On trigger, it tries to read the focused control through Windows UI Automation:

- focused element
- nearby descendants
- nearby ancestors
- `TextPattern` text before the selection/caret
- `TextPattern` document text
- `ValuePattern` value

The reader scores candidates and only uses broad document text when it lines up with the recent keyboard buffer. If focused text is unavailable, Nudge falls back to the rolling buffer.

When the focused UI element changes, Nudge clears the rolling keyboard buffer so context does not leak between apps or fields.

The Ollama client then normalizes the returned suggestion so insertion works for both complete words and partial words.

Examples:

```text
Please confi + rm your details carefully
=> Please confirm your details carefully

This should autocom + complete your thought
=> This should autocomplete your thought

Remember to update the config + file before deploying
=> Remember to update the config file before deploying
```

## Debugging Focused Text

Run:

```sh
npm run inspect-focused-text
```

Useful output looks like:

```text
ControlType.Edit ... | TextPattern chars=42; ValuePattern chars=42
```

If you see only `Pane`, `Group`, or `Document` entries with no useful text/value pattern, the target app may not expose focused text through UI Automation. Nudge will still use the keyboard buffer fallback.

When the app is running, the main process logs which path it used:

```text
[active-text-reader] using focused text via focused:ControlType.Edit:valuePattern:score=160 (42 chars)
```

or:

```text
[active-text-reader] no focused text via noUsableCandidate; using keyboard buffer (42 chars)
```

## Project Structure

```text
scripts/        UI Automation inspection helpers
src/main/       Electron main process, keyboard monitor, Ollama client, focused text reader, text insertion
src/preload/    Safe IPC bridge for the renderer
src/renderer/   React overlay UI
```

## Notes

- The app currently targets the local model `qwen2.5:7b`.
- Ollama CLI availability is separate from the Ollama server. The app only requires the HTTP API to be running.
- Keyboard monitoring, focused-text reading, and text insertion use Windows/native APIs, so behavior can vary by target app.
- Password fields are ignored by the focused-text reader.
- The app stays alive without a normal window; use the tray menu to quit.
