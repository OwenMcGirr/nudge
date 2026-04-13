import { describe, expect, it } from 'vitest'
import { resolveAutocompleteContext, selectFocusedTextCandidate } from './active-text-reader'

describe('resolveAutocompleteContext', () => {
  it('falls back to the keyboard buffer when focused text is unavailable', () => {
    expect(resolveAutocompleteContext('typed context', null)).toBe('typed context')
  })

  it('uses focused text when it already ends with the keyboard buffer', () => {
    expect(resolveAutocompleteContext('world', 'hello world')).toBe('hello world')
  })

  it('uses text through the latest buffer occurrence when focused text includes trailing content', () => {
    expect(resolveAutocompleteContext('brave', 'hello brave world')).toBe('hello brave')
  })

  it('uses focused text when it cannot be aligned with the keyboard buffer', () => {
    expect(resolveAutocompleteContext('typed context', 'existing input text')).toBe('existing input text')
  })
})

describe('selectFocusedTextCandidate', () => {
  it('prefers the focused edit control when it has useful text', () => {
    expect(
      selectFocusedTextCandidate(
        [
          {
            text: 'document text that includes hello world',
            relation: 'ancestor',
            distance: 2,
            pattern: 'textPatternDocument',
            controlType: 'ControlType.Document'
          },
          {
            text: 'hello world',
            relation: 'focused',
            distance: 0,
            pattern: 'valuePattern',
            controlType: 'ControlType.Edit'
          }
        ],
        'world'
      )
    ).toMatchObject({ text: 'hello world' })
  })

  it('uses an aligned document candidate when the focused edit is not useful', () => {
    expect(
      selectFocusedTextCandidate(
        [
          {
            text: '\n',
            relation: 'focused',
            distance: 0,
            pattern: 'valuePattern',
            controlType: 'ControlType.Edit'
          },
          {
            text: 'earlier text plus typed context after it',
            relation: 'ancestor',
            distance: 3,
            pattern: 'textPatternDocument',
            controlType: 'ControlType.Document'
          }
        ],
        'typed context'
      )
    ).toMatchObject({ text: 'earlier text plus typed context after it' })
  })

  it('rejects document candidates that do not align with the keyboard buffer', () => {
    expect(
      selectFocusedTextCandidate(
        [
          {
            text: 'unrelated document body',
            relation: 'ancestor',
            distance: 1,
            pattern: 'textPatternDocument',
            controlType: 'ControlType.Document'
          }
        ],
        'typed context'
      )
    ).toMatchObject({ text: null, source: 'noUsableCandidate' })
  })
})
