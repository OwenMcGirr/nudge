import { app, ipcMain, Menu, nativeImage, Tray } from 'electron'
// @ts-ignore — @tkomde/iohook has no TypeScript definitions; exports instance directly
const iohook = require('@tkomde/iohook')
import { resolveAutocompleteContext, WindowsActiveTextReader } from './active-text-reader'
import { KeyboardMonitor } from './keyboard-monitor'
import { OllamaClient } from './ollama-client'
import { TextInjector } from './text-injector'
import { DebugState, WindowManager } from './window-manager'

// iohook emits scan codes (AT Set 1) but keychar is undefined in this build.
// Map scan code → [unshifted, shifted] for US-QWERTY layout.
const SCAN_CHAR: Record<number, [string, string]> = {
  2: ['1','!'],  3: ['2','@'],  4: ['3','#'],  5: ['4','$'],
  6: ['5','%'],  7: ['6','^'],  8: ['7','&'],  9: ['8','*'],
  10:['9','('], 11:['0',')'], 12:['-','_'], 13:['=','+'],
  16:['q','Q'], 17:['w','W'], 18:['e','E'], 19:['r','R'],
  20:['t','T'], 21:['y','Y'], 22:['u','U'], 23:['i','I'],
  24:['o','O'], 25:['p','P'], 26:['[','{'], 27:[']','}'],
  30:['a','A'], 31:['s','S'], 32:['d','D'], 33:['f','F'],
  34:['g','G'], 35:['h','H'], 36:['j','J'], 37:['k','K'],
  38:['l','L'], 39:[';',':'], 40:["'",'"'], 41:['`','~'],
  43:['\\','|'],
  44:['z','Z'], 45:['x','X'], 46:['c','C'], 47:['v','V'],
  48:['b','B'], 49:['n','N'], 50:['m','M'], 51:[',','<'],
  52:['.','>'], 53:['/','?'],
  57:[' ',' '],
}

function resolveKeychar(keycode: number, keychar: string | number | undefined, shiftKey: boolean): string | undefined {
  if (typeof keychar === 'string' && keychar.length > 0) return keychar
  if (typeof keychar === 'number' && keychar > 0 && keychar < 0xFFFF) return String.fromCharCode(keychar)
  const entry = SCAN_CHAR[keycode]
  return entry ? entry[shiftKey ? 1 : 0] : undefined
}

let currentSuggestion = ''
let overlayVisible = false
let lastFocusId: string | null = null
let tray: Tray | null = null
let lastDebugState: DebugState = {
  status: 'starting',
  bufferLength: 0,
  contextLength: 0,
  contextSource: 'none',
  focusSource: 'none',
  suggestionLength: 0,
  overlayVisible: false,
  updatedAt: ''
}

const ollamaClient = new OllamaClient()
const textInjector = new TextInjector()
const windowManager = new WindowManager()
const activeTextReader = new WindowsActiveTextReader()

function updateDebugState(partial: Partial<DebugState>): void {
  lastDebugState = {
    ...lastDebugState,
    ...partial,
    overlayVisible,
    updatedAt: new Date().toLocaleTimeString()
  }
  windowManager.updateDebugState(lastDebugState)
}

function hideCurrentSuggestion(): void {
  overlayVisible = false
  currentSuggestion = ''
  keyboardMonitor.setOverlayActive(false)
  keyboardMonitor.cancelDebounce()
  windowManager.hideSuggestion()
  updateDebugState({ status: 'hidden', suggestionLength: 0 })
}

function acceptCurrentSuggestion(): void {
  if (!overlayVisible || !currentSuggestion) return
  textInjector.inject(currentSuggestion)
  hideCurrentSuggestion()
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#1A1A1A"/>
          <path d="M9 22V10h3.1l7.8 7.8V10H23v12h-3.1l-7.8-7.8V22H9z" fill="#FFFFFF"/>
        </svg>
      `)
  )

  tray = new Tray(icon)
  tray.setToolTip('Nudge')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Nudge', enabled: false },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        }
      }
    ])
  )
}

const keyboardMonitor = new KeyboardMonitor(
  async (bufferContext) => {
    updateDebugState({
      status: 'reading focus',
      bufferLength: bufferContext.length,
      contextLength: 0,
      contextSource: 'pending',
      suggestionLength: 0
    })

    const focusedTextResult = await activeTextReader.getFocusedTextResult(bufferContext)
    let effectiveBufferContext = bufferContext

    if (focusedTextResult.focusId && focusedTextResult.focusId !== lastFocusId) {
      keyboardMonitor.clearBuffer()
      effectiveBufferContext = ''
      lastFocusId = focusedTextResult.focusId
      console.log('[active-text-reader] focused element changed; cleared keyboard buffer')
    }

    const context = resolveAutocompleteContext(effectiveBufferContext, focusedTextResult.text)
    const contextSource = focusedTextResult.text ? 'focused text' : 'keyboard buffer'

    if (!focusedTextResult.text) {
      console.log(
        `[active-text-reader] no focused text via ${focusedTextResult.source}; using keyboard buffer (${effectiveBufferContext.length} chars)`
      )
    }

    updateDebugState({
      status: 'requesting suggestion',
      bufferLength: effectiveBufferContext.length,
      contextLength: context.length,
      contextSource,
      focusSource: focusedTextResult.source
    })

    if (context.trim().length === 0) {
      updateDebugState({ status: 'idle', contextLength: 0, contextSource: 'none' })
      return
    }

    const suggestion = await ollamaClient.generate(context)
    if (!suggestion) {
      updateDebugState({ status: 'no suggestion', suggestionLength: 0 })
      return
    }

    currentSuggestion = suggestion
    overlayVisible = true
    keyboardMonitor.setOverlayActive(true)
    windowManager.showSuggestion(suggestion)
    updateDebugState({ status: 'suggestion visible', suggestionLength: suggestion.length })
  },
  () => {
    // overlay dismissed by keyboard, click, or typing while visible
    overlayVisible = false
    currentSuggestion = ''
    ollamaClient.cancel()
    windowManager.hideSuggestion()
    updateDebugState({ status: 'dismissed', suggestionLength: 0 })
  }
)

app.whenReady().then(() => {
  createTray()
  windowManager.createOverlay()
  windowManager.createDebugOverlay()
  updateDebugState({ status: 'ready' })

  ipcMain.on('accept-suggestion', () => {
    acceptCurrentSuggestion()
  })

  ipcMain.on('dismiss-suggestion', () => {
    hideCurrentSuggestion()
    ollamaClient.cancel()
  })

  iohook.on('keydown', (event: { keycode: number; keychar?: string | number; shiftKey?: boolean }) => {
    const resolved = resolveKeychar(event.keycode, event.keychar, event.shiftKey ?? false)
    keyboardMonitor.handleKeydown(event.keycode, resolved)
    updateDebugState({
      status: 'typing',
      bufferLength: keyboardMonitor.getContext().length
    })
  })

  iohook.start()
})

// Keep the app alive even when overlay is hidden.
// Subscribing without calling app.quit() prevents the default quit behaviour.
app.on('window-all-closed', () => { /* intentionally empty */ })

app.on('will-quit', () => {
  iohook.stop()
})
