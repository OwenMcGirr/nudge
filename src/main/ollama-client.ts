const BASE_URL = 'http://localhost:11434'
const SYSTEM_PROMPT =
  'You are an inline text autocomplete. Return only text to insert at the cursor. If the user stopped inside a word, begin with only the remaining characters for that word. Otherwise continue with the next 3-8 words. Do not repeat any words from the input. Do not add punctuation at the end.'

const TRAILING_PUNCTUATION = /[.!?,;:]+$/
const WORD_AT_END = /[A-Za-z0-9_]+$/
const WORD_AT_START = /^[A-Za-z0-9_]+/
const SENTENCE_PUNCTUATION_AT_END = /[.!?,;:]$/
const META_RESPONSE = /^(sure|here|output|completion|input:|the continuation)/i
const LIKELY_SUFFIXES = [
  'able',
  'age',
  'al',
  'ally',
  'ance',
  'ation',
  'ed',
  'ence',
  'er',
  'est',
  'ful',
  'ible',
  'ing',
  'ive',
  'less',
  'ly',
  'ment',
  'ness',
  'ous',
  'rm',
  'sion',
  'tion'
]

function countWords(text: string): number {
  return text.match(/[A-Za-z0-9_']+/g)?.length ?? 0
}

function findWordOverlap(previousWord: string, suggestionWord: string): number {
  if (previousWord.length < 4) return 0

  const previous = previousWord.toLowerCase()
  const suggestion = suggestionWord.toLowerCase()
  const maxOverlap = Math.min(previous.length, suggestion.length)

  for (let length = maxOverlap; length >= 2; length--) {
    if (previous.slice(-length) === suggestion.slice(0, length)) {
      return length
    }
  }

  return 0
}

function isLikelySuffix(word: string): boolean {
  const normalized = word.toLowerCase()
  return LIKELY_SUFFIXES.some((suffix) => normalized.startsWith(suffix))
}

export function normalizeSuggestion(context: string, rawText: string | undefined): string | null {
  let text = rawText
    ?.replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null

  text = text.replace(/^["'`]+|["'`]+$/g, '').trim()
  text = text.replace(TRAILING_PUNCTUATION, '').trim()

  if (!text || META_RESPONSE.test(text)) return null

  const previousWord = context.match(WORD_AT_END)?.[0]

  if (previousWord) {
    const firstWord = text.match(WORD_AT_START)?.[0]

    if (firstWord) {
      const overlap = findWordOverlap(previousWord, firstWord)

      if (overlap > 0 && overlap < firstWord.length) {
        text = `${firstWord.slice(overlap)}${text.slice(firstWord.length)}`
      } else if (!isLikelySuffix(firstWord)) {
        text = ` ${text}`
      }
    } else {
      text = ` ${text}`
    }
  } else {
    text = text.trimStart()
    if (SENTENCE_PUNCTUATION_AT_END.test(context) && WORD_AT_START.test(text)) {
      text = ` ${text}`
    }
  }

  const wordCount = countWords(text)
  if (wordCount < 1 || wordCount > 8) return null

  return text
}

export class OllamaClient {
  private abortController: AbortController | null = null

  async generate(context: string): Promise<string | null> {
    this.cancel()
    this.abortController = new AbortController()

    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5:7b',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: context }
          ],
          stream: false,
          options: { temperature: 0.4, num_predict: 25, stop: ['\n'] }
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) return null

      const data = await response.json()
      return normalizeSuggestion(context, data.message?.content as string | undefined)
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
