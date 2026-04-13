import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OllamaClient, normalizeSuggestion } from './ollama-client'

describe('OllamaClient', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns trimmed completion text on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: { content: '  is sunny today  ' } }), { status: 200 })
    )
    const client = new OllamaClient()
    expect(await client.generate('The weather ')).toBe('is sunny today')
  })

  it('returns null on non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }))
    const client = new OllamaClient()
    expect(await client.generate('hello')).toBeNull()
  })

  it('returns null when response text is blank', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: { content: '   ' } }), { status: 200 })
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
        new Response(JSON.stringify({ message: { content: 'world' } }), { status: 200 })
      )

    const client = new OllamaClient()
    const first = client.generate('hello')
    const second = client.generate('hello world')
    await Promise.allSettled([first, second])
    expect(firstAborted).toBe(true)
  })

  it('adds a space when the model returns a new word after a complete word', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: { content: 'file before deploying' } }), { status: 200 })
    )
    const client = new OllamaClient()
    expect(await client.generate('Remember to update the config')).toBe(' file before deploying')
  })

  it('keeps partial-word suffixes attached to the current word', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: { content: 'rm your details carefully' } }), { status: 200 })
    )
    const client = new OllamaClient()
    expect(await client.generate('Please confi')).toBe('rm your details carefully')
  })

  it('removes overlapping text when the model repeats the partial word', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: { content: 'complete your thought' } }), { status: 200 })
    )
    const client = new OllamaClient()
    expect(await client.generate('This should autocom')).toBe('plete your thought')
  })

  it('strips trailing punctuation before insertion', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: { content: 'let you know by evening.' } }), { status: 200 })
    )
    const client = new OllamaClient()
    expect(await client.generate('I can review it and')).toBe(' let you know by evening')
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

describe('normalizeSuggestion', () => {
  it('does not add a leading space after existing whitespace', () => {
    expect(normalizeSuggestion('Remember to update the config ', 'file before deploying')).toBe(
      'file before deploying'
    )
  })

  it('rejects meta responses', () => {
    expect(normalizeSuggestion('hello ', 'Sure, here is a completion')).toBeNull()
  })

  it('does not overlap-repair short complete words', () => {
    expect(normalizeSuggestion('I need to', 'today finish this')).toBe(' today finish this')
  })
})
