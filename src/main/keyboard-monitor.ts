const TAB_KEYCODE = 15
const ESCAPE_KEYCODE = 1
const BACKSPACE_KEYCODE = 14
const MAX_BUFFER = 500
const MIN_BUFFER = 10
const DEBOUNCE_MS = 2000

export class KeyboardMonitor {
  private buffer = ''
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private overlayActive = false

  constructor(
    private readonly onTrigger: (context: string) => void,
    private readonly onDismiss: () => void
  ) {}

  handleKeydown(keycode: number, keychar: string | undefined): void {
    if (this.overlayActive) {
      if (keycode === TAB_KEYCODE) return // handled by index.ts
      this.overlayActive = false
      this.onDismiss()
      if (keycode === ESCAPE_KEYCODE) return // only dismiss, don't type
    }

    if (keycode === BACKSPACE_KEYCODE) {
      this.buffer = this.buffer.slice(0, -1)
    } else if (keychar) {
      this.buffer += keychar
      if (this.buffer.length > MAX_BUFFER) {
        this.buffer = this.buffer.slice(-MAX_BUFFER)
      }
    }

    this.scheduleCompletion()
  }

  private scheduleCompletion(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.buffer.length < MIN_BUFFER) return
    this.debounceTimer = setTimeout(() => {
      this.onTrigger(this.buffer)
    }, DEBOUNCE_MS)
  }

  setOverlayActive(active: boolean): void {
    this.overlayActive = active
  }

  cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  clearBuffer(): void {
    this.buffer = ''
  }

  getContext(): string {
    return this.buffer
  }
}
