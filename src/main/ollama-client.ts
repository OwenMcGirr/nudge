const BASE_URL = 'http://localhost:11434'

export class OllamaClient {
  private abortController: AbortController | null = null

  async generate(context: string): Promise<string | null> {
    this.cancel()
    this.abortController = new AbortController()

    try {
      const response = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5:7b',
          prompt: `Continue this text naturally (max 10 words, do not repeat the input):\n\n${context}`,
          stream: false,
          options: { temperature: 0.7, num_predict: 50, stop: ['\n', '.', '?', '!'] }
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) return null

      const data = await response.json()
      const text = (data.response as string | undefined)?.trim()
      return text && text.length > 0 ? text : null
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      return null
    }
  }

  cancel(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(2000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}
