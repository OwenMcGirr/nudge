import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  onShowSuggestion: (callback: (text: string) => void) => {
    ipcRenderer.on('show-suggestion', (_event, text: string) => callback(text))
  },
  onHide: (callback: () => void) => {
    ipcRenderer.on('hide-suggestion', () => callback())
  },
  acceptSuggestion: () => ipcRenderer.send('accept-suggestion'),
  dismissSuggestion: () => ipcRenderer.send('dismiss-suggestion')
})
