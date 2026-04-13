import { useState, useEffect } from 'react'

declare global {
  interface Window {
    electron: {
      onShowSuggestion: (cb: (text: string) => void) => void
      onHide: (cb: () => void) => void
    }
  }
}

export function Overlay() {
  const [suggestion, setSuggestion] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    window.electron.onShowSuggestion((text) => {
      setSuggestion(text)
      setVisible(true)
    })
    window.electron.onHide(() => setVisible(false))
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        background: 'rgba(26, 26, 26, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}
    >
      <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', marginBottom: '4px' }}>
        {suggestion}
      </div>
      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px' }}>
        Tab to accept • Esc to dismiss
      </div>
    </div>
  )
}
