import { useState, useEffect } from 'react'

declare global {
  interface Window {
    electron: {
      onShowSuggestion: (cb: (text: string) => void) => void
      onHide: (cb: () => void) => void
      acceptSuggestion: () => void
      dismissSuggestion: () => void
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
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}
    >
      <button
        type="button"
        onClick={() => window.electron.acceptSuggestion()}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          margin: '0 0 8px',
          border: 0,
          background: 'transparent',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '14px',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        {suggestion}
      </button>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', flex: 1 }}>
          Click suggestion to accept
        </div>
        <button
          type="button"
          onClick={() => window.electron.dismissSuggestion()}
          style={{
            padding: '3px 8px',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.75)',
            fontSize: '11px',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
