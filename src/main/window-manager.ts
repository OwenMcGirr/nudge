import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

const OVERLAY_WIDTH = 420
const OVERLAY_HEIGHT = 90
const DEBUG_OVERLAY_WIDTH = 380
const DEBUG_OVERLAY_HEIGHT = 170

export interface DebugState {
  status: string
  bufferLength: number
  contextLength: number
  contextSource: string
  focusSource: string
  suggestionLength: number
  overlayVisible: boolean
  updatedAt: string
}

export class WindowManager {
  private overlay: BrowserWindow | null = null
  private debugOverlay: BrowserWindow | null = null
  private lastDebugState: DebugState | null = null

  createOverlay(): void {
    this.overlay = new BrowserWindow({
      width: OVERLAY_WIDTH,
      height: OVERLAY_HEIGHT,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js')
      }
    })

    this.overlay.setAlwaysOnTop(true, 'screen-saver', 1)
    this.loadRenderer(this.overlay, 'suggestion')
  }

  createDebugOverlay(): void {
    this.debugOverlay = new BrowserWindow({
      width: DEBUG_OVERLAY_WIDTH,
      height: DEBUG_OVERLAY_HEIGHT,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js')
      }
    })

    this.debugOverlay.setAlwaysOnTop(true, 'screen-saver', 1)
    this.debugOverlay.setIgnoreMouseEvents(true)
    this.positionDebugOverlay()
    this.loadRenderer(this.debugOverlay, 'debug')
    this.debugOverlay.webContents.once('did-finish-load', () => {
      if (this.lastDebugState) {
        this.debugOverlay?.webContents.send('debug-state', this.lastDebugState)
      }
    })
  }

  private loadRenderer(window: BrowserWindow, mode: 'suggestion' | 'debug'): void {
    if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL)
      url.searchParams.set('overlayMode', mode)
      window.loadURL(url.toString())
    } else {
      window.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { overlayMode: mode }
      })
    }
  }

  showSuggestion(text: string): void {
    if (!this.overlay) return
    this.positionNearCursor()
    this.overlay.webContents.send('show-suggestion', text)
    this.overlay.show()
  }

  hideSuggestion(): void {
    if (!this.overlay) return
    this.overlay.webContents.send('hide-suggestion')
    this.overlay.hide()
  }

  updateDebugState(state: DebugState): void {
    this.lastDebugState = state
    this.debugOverlay?.webContents.send('debug-state', state)
  }

  private positionNearCursor(): void {
    if (!this.overlay) return
    const cursor = screen.getCursorScreenPoint()
    const { bounds } = screen.getDisplayNearestPoint(cursor)

    let x = cursor.x
    let y = cursor.y + 24

    if (x + OVERLAY_WIDTH > bounds.x + bounds.width) {
      x = bounds.x + bounds.width - OVERLAY_WIDTH
    }
    if (y + OVERLAY_HEIGHT > bounds.y + bounds.height) {
      y = cursor.y - OVERLAY_HEIGHT - 4
    }

    this.overlay.setPosition(Math.round(x), Math.round(y))
  }

  private positionDebugOverlay(): void {
    if (!this.debugOverlay) return
    const { bounds } = screen.getPrimaryDisplay()
    this.debugOverlay.setPosition(bounds.x + 8, bounds.y + 8)
  }
}
