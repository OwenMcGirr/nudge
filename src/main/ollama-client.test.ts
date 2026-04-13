import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OllamaClient } from './ollama-client'

describe('OllamaClient', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns trimmed completion text on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ response: '  is sunny today  ' }), { status: 200 })
    )
    const client = new OllamaClient()
    expect(await client.generate('The weather')).toBe('is sunny today')
  })

  it('returns null on non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }))
    const client = new OllamaClient()
    expect(await client.generate('hello')).toBeNull()
  })

  it('returns null when response text is blank', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ response: '   ' }), { status: 200 })
    )
    const client = new OllamaClient()
    expect(await client.generate('hello')).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const client = new OllamaClient()
    expect(await client.generate('hello')).toBeNull()
  })

  it('cancels the in-flight request when generate is called again', async () => {
    let firstAborted = false
    vi.mocked(fetch)
      .mockImplementationOnce(async (_, init) => {
        return new Promise((_, reject) => {
          ;(init?.signal as AbortSignal).addEventListener('abort', () => {
            firstAborted = true
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: 'world' }), { status: 200 })
      )

    const client = new OllamaClient()
    const first = client.generate('hello')
    const second = client.generate('hello world')
    await Promise.allSettled([first, second])
    expect(firstAborted).toBe(true)
  })

  it('isHealthy returns true when server is up', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    expect(await new OllamaClient().isHealthy()).toBe(true)
  })

  it('isHealthy returns false when server is down', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await new OllamaClient().isHealthy()).toBe(false)
  })
})
