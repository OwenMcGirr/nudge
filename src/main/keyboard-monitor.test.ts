import { describe, it, expect, vi } from 'vitest'
import { KeyboardMonitor } from './keyboard-monitor'

// iohook keycodes (Windows scan codes)
const BACKSPACE = 14
const TAB = 15
const ESCAPE = 1
const ENTER = 28

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

  it('clears the buffer on Enter', () => {
    const m = new KeyboardMonitor(vi.fn(), vi.fn())
    'hello world'.split('').forEach(c => m.handleKeydown(30, c))
    m.handleKeydown(ENTER, undefined)
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

  it('cancelDebounce prevents onTrigger from firing', () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()
    const m = new KeyboardMonitor(onTrigger, vi.fn())
    'hello world'.split('').forEach(c => m.handleKeydown(30, c))
    m.cancelDebounce()
    vi.advanceTimersByTime(2000)
    expect(onTrigger).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('Enter cancels a pending completion', () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()
    const m = new KeyboardMonitor(onTrigger, vi.fn())
    'hello world'.split('').forEach(c => m.handleKeydown(30, c))
    m.handleKeydown(ENTER, undefined)
    vi.advanceTimersByTime(2000)
    expect(onTrigger).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('exactly 9 chars does NOT trigger onTrigger', () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()
    const m = new KeyboardMonitor(onTrigger, vi.fn())
    'abcdefghi'.split('').forEach(c => m.handleKeydown(30, c)) // 9 chars
    vi.advanceTimersByTime(2000)
    expect(onTrigger).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('exactly 10 chars SHOULD trigger onTrigger', () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()
    const m = new KeyboardMonitor(onTrigger, vi.fn())
    'abcdefghij'.split('').forEach(c => m.handleKeydown(30, c)) // 10 chars
    vi.advanceTimersByTime(2000)
    expect(onTrigger).toHaveBeenCalledWith('abcdefghij')
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

  it('calls onDismiss on any key when overlay active', () => {
    const onDismiss = vi.fn()
    const m = new KeyboardMonitor(vi.fn(), onDismiss)
    m.setOverlayActive(true)
    m.handleKeydown(30, 'a')
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('dismisses on Tab instead of accepting the suggestion', () => {
    const onDismiss = vi.fn()
    const m = new KeyboardMonitor(vi.fn(), onDismiss)
    m.setOverlayActive(true)
    m.handleKeydown(TAB, undefined)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('resumes normal typing after overlay dismissed by non-Tab key', () => {
    const m = new KeyboardMonitor(vi.fn(), vi.fn())
    m.setOverlayActive(true)
    m.handleKeydown(30, 'a') // dismisses overlay + types 'a'
    expect(m.getContext()).toBe('a')
  })

  it('dismisses the overlay and clears the buffer on Enter', () => {
    const onDismiss = vi.fn()
    const m = new KeyboardMonitor(vi.fn(), onDismiss)
    'hello world'.split('').forEach(c => m.handleKeydown(30, c))
    m.setOverlayActive(true)
    m.handleKeydown(ENTER, undefined)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(m.getContext()).toBe('')
  })
})
