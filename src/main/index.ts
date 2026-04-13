import { app } from 'electron'
// @ts-ignore — @tkomde/iohook has no TypeScript definitions
const { iohook } = require('@tkomde/iohook')
import { KeyboardMonitor } from './keyboard-monitor'
import { OllamaClient } from './ollama-client'
import { TextInjector } from './text-injector'
import { WindowManager } from './window-manager'

const TAB_KEYCODE = 15

let currentSuggestion = ''
let overlayVisible = false

const ollamaClient = new OllamaClient()
const textInjector = new TextInjector()
const windowManager = new WindowManager()

const keyboardMonitor = new KeyboardMonitor(
  async (context) => {
    // 2s debounce fired — ask Ollama
    const suggestion = await ollamaClient.generate(context)
    if (!suggestion) return

    currentSuggestion = suggestion
    overlayVisible = true
    keyboardMonitor.setOverlayActive(true)
    windowManager.showSuggestion(suggestion)
  },
  () => {
    // overlay dismissed (Esc or any non-Tab key)
    overlayVisible = false
    currentSuggestion = ''
    ollamaClient.cancel()
    windowManager.hideSuggestion()
  }
)

app.whenReady().then(() => {
  windowManager.createOverlay()

  iohook.on('keydown', (event: { keycode: number; keychar?: string }) => {
    if (overlayVisible && event.keycode === TAB_KEYCODE) {
      // Accept suggestion
      textInjector.inject(currentSuggestion)
      overlayVisible = false
      currentSuggestion = ''
      keyboardMonitor.setOverlayActive(false)
      keyboardMonitor.cancelDebounce()
      windowManager.hideSuggestion()
      return
    }
    keyboardMonitor.handleKeydown(event.keycode, event.keychar)
  })

  iohook.start()
})

// Keep the app alive even when overlay is hidden.
// Subscribing without calling app.quit() prevents the default quit behaviour.
app.on('window-all-closed', () => { /* intentionally empty */ })

app.on('will-quit', () => {
  iohook.stop()
})
