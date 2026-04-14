import { useState, useEffect } from 'react'

type OverlayMode = 'suggestion' | 'debug'

interface DebugState {
  status: string
  bufferLength: number
  contextLength: number
  contextSource: string
  focusSource: string
  suggestionLength: number
  overlayVisible: boolean
  updatedAt: string
}

declare global {
  interface Window {
    electron: {
      onShowSuggestion: (cb: (text: string) => void) => void
      onHide: (cb: () => void) => void
      onSetOverlayMode: (cb: (mode: OverlayMode) => void) => void
      onDebugState: (cb: (state: DebugState) => void) => void
      acceptSuggestion: () => void
      dismissSuggestion: () => void
    }
  }
}

const EMPTY_DEBUG_STATE: DebugState = {
  status: 'starting',
  bufferLength: 0,
  contextLength: 0,
  contextSource: 'none',
  focusSource: 'none',
  suggestionLength: 0,
  overlayVisible: false,
  updatedAt: ''
}

function getInitialMode(): OverlayMode {
  const mode = new URLSearchParams(window.location.search).get('overlayMode')
  return mode === 'debug' ? 'debug' : 'suggestion'
}

export function Overlay() {
  const [mode, setMode] = useState<OverlayMode>(getInitialMode)
  const [suggestion, setSuggestion] = useState('')
  const [visible, setVisible] = useState(false)
  const [debugState, setDebugState] = useState<DebugState>(EMPTY_DEBUG_STATE)

  useEffect(() => {
    window.electron.onSetOverlayMode(setMode)
    window.electron.onDebugState(setDebugState)
    window.electron.onShowSuggestion((text) => {
      setSuggestion(text)
      setVisible(true)
    })
    window.electron.onHide(() => setVisible(false))
  }, [])

  if (mode === 'debug') {
    return <DebugOverlay state={debugState} />
  }

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

function DebugOverlay({ state }: { state: DebugState }) {
  const rows = [
    ['status', state.status],
    ['buffer', `${state.bufferLength} chars`],
    ['context', `${state.contextLength} chars via ${state.contextSource}`],
    ['focus', state.focusSource],
    ['suggestion', `${state.suggestionLength} chars`],
    ['visible', state.overlayVisible ? 'yes' : 'no'],
    ['updated', state.updatedAt || '-']
  ]

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        boxSizing: 'border-box',
        background: 'rgba(0, 0, 0, 0.72)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: '8px',
        padding: '10px 12px',
        color: 'rgba(255, 255, 255, 0.88)',
        userSelect: 'none',
        fontFamily: 'Consolas, "SFMono-Regular", monospace',
        fontSize: '11px',
        lineHeight: 1.35
      }}
    >
      <div style={{ fontSize: '12px', marginBottom: '6px', color: '#8FE388' }}>Nudge debug</div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', gap: '8px', minHeight: '15px' }}>
          <span style={{ width: '68px', color: 'rgba(255, 255, 255, 0.48)' }}>{label}</span>
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
