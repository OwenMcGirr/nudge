import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  onShowSuggestion: (callback: (text: string) => void) => {
    ipcRenderer.on('show-suggestion', (_event, text: string) => callback(text))
  },
  onHide: (callback: () => void) => {
    ipcRenderer.on('hide-suggestion', () => callback())
  },
  onSetOverlayMode: (callback: (mode: 'suggestion' | 'debug') => void) => {
    ipcRenderer.on('set-overlay-mode', (_event, mode: 'suggestion' | 'debug') => callback(mode))
  },
  onDebugState: (callback: (state: unknown) => void) => {
    ipcRenderer.on('debug-state', (_event, state: unknown) => callback(state))
  },
  acceptSuggestion: () => ipcRenderer.send('accept-suggestion'),
  dismissSuggestion: () => ipcRenderer.send('dismiss-suggestion')
})
