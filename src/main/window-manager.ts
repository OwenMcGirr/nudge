import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

const OVERLAY_WIDTH = 420
const OVERLAY_HEIGHT = 90

export class WindowManager {
  private overlay: BrowserWindow | null = null

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

    if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
      this.overlay.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      this.overlay.loadFile(join(__dirname, '../renderer/index.html'))
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
}
