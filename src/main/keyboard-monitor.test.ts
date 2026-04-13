import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeyboardMonitor } from './keyboard-monitor'

// iohook keycodes (Windows scan codes)
const BACKSPACE = 14
const TAB = 15
const ESCAPE = 1

describe('KeyboardMonitor — buffer', () => {
  it('accumulates typed characters', () => {
    const m = new KeyboardMonitor(vi.fn(), vi.fn())
    m.handleKeydown(30, 'a')
    m.handleKeydown(48, 'b')
    m.handleKeydown(46, 'c')
    expect(m.getContext()).toBe('abc')
  })

  it('handles backspace', () => {
    const m = new KeyboardMonitor(vi.fn(), vi.fn())
    m.handleKeydown(30, 'h')
    m.handleKeydown(18, 'e')
    m.handleKeydown(BACKSPACE, undefined)
    expect(m.getContext()).toBe('h')
  })

  it('caps buffer at 500 characters', () => {
    const m = new KeyboardMonitor(vi.fn(), vi.fn())
    for (let i = 0; i < 600; i++) m.handleKeydown(30, 'x')
    expect(m.getContext().length).toBe(500)
  })

  it('clearBuffer empties the buffer', () => {
    const m = new KeyboardMonitor(vi.fn(), vi.fn())
    m.handleKeydown(30, 'a')
    m.clearBuffer()
    expect(m.getContext()).toBe('')
  })
})

describe('KeyboardMonitor — debounce', () => {
  it('fires onTrigger after 2s with ≥10 chars in buffer', () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()
    const m = new KeyboardMonitor(onTrigger, vi.fn())
    'hello world'.split('').forEach(c => m.handleKeydown(30, c))
    vi.advanceTimersByTime(2000)
    expect(onTrigger).toHaveBeenCalledWith('hello world')
    vi.useRealTimers()
  })

  it('does not fire if buffer has fewer than 10 chars', () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()
    const m = new KeyboardMonitor(onTrigger, vi.fn())
    'hello'.split('').forEach(c => m.handleKeydown(30, c))
    vi.advanceTimersByTime(2000)
    expect(onTrigger).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('resets timer on each keystroke', () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()
    const m = new KeyboardMonitor(onTrigger, vi.fn())
    'hello world!'.split('').forEach(c => m.handleKeydown(30, c))
    vi.advanceTimersByTime(1500)
    m.handleKeydown(30, 'x')
    vi.advanceTimersByTime(1500)
    expect(onTrigger).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(onTrigger).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})

describe('KeyboardMonitor — overlay interaction', () => {
  it('calls onDismiss on Escape when overlay active', () => {
    const onDismiss = vi.fn()
    const m = new KeyboardMonitor(vi.fn(), onDismiss)
    m.setOverlayActive(true)
    m.handleKeydown(ESCAPE, undefined)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss on any non-Tab key when overlay active', () => {
    const onDismiss = vi.fn()
    const m = new KeyboardMonitor(vi.fn(), onDismiss)
    m.setOverlayActive(true)
    m.handleKeydown(30, 'a')
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does NOT call onDismiss for Tab (handled externally in index.ts)', () => {
    const onDismiss = vi.fn()
    const m = new KeyboardMonitor(vi.fn(), onDismiss)
    m.setOverlayActive(true)
    m.handleKeydown(TAB, undefined)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('resumes normal typing after overlay dismissed by non-Tab key', () => {
    const m = new KeyboardMonitor(vi.fn(), vi.fn())
    m.setOverlayActive(true)
    m.handleKeydown(30, 'a') // dismisses overlay + types 'a'
    expect(m.getContext()).toBe('a')
  })
})
