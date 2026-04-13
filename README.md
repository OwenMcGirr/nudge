# Nudge

AI-powered autocomplete for your desktop.

Nudge runs as an Electron app, watches your recent typing, asks a local Ollama model for a short continuation, and shows the suggestion in a small overlay near the cursor. Press `Tab` to insert the suggestion or `Esc` to dismiss it.

## Requirements

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

After you pause while typing, Nudge sends the buffered text to Ollama. Suggestions are generated locally and inserted into the active app when accepted.

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

## How Autocomplete Works

The main process records typed characters in a rolling buffer, waits for a short pause, and sends the context to Ollama. The Ollama client normalizes the returned suggestion before showing it so insertion works for both complete words and partial words.

Examples:

```text
Please confi + rm your details carefully
=> Please confirm your details carefully

This should autocom + complete your thought
=> This should autocomplete your thought

Remember to update the config + file before deploying
=> Remember to update the config file before deploying
```

## Project Structure

```text
src/main/       Electron main process, keyboard monitor, Ollama client, text insertion
src/preload/    Safe IPC bridge for the renderer
src/renderer/   React overlay UI
```

## Notes

- The app currently targets the local model `qwen2.5:7b`.
- Ollama CLI availability is separate from the Ollama server. The app only requires the HTTP API to be running.
- Keyboard monitoring and text insertion use native dependencies, so platform behavior may vary.
