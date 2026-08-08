/**
 * conversationAssistApply — pure transform tests (G27). Covers the one thing
 * that matters most here: the composer draft is a SINGLE-LINE input, so
 * summarize collapses whitespace/newlines and actions join into one line —
 * unlike noteAssistApply's HTML output, never markup (mirrors its test shape).
 */
import { describe, it, expect } from 'vitest'
import { formatAssistResultForDraft } from './conversationAssistApply'
import type { ConversationAssistResult } from './conversationAssistApi'

const typeLabel = (type: string) => type.toUpperCase()

describe('formatAssistResultForDraft · summarize (text)', () => {
  it('collapses multi-line prose into one line for the single-line composer input', () => {
    const result: ConversationAssistResult = { kind: 'text', text: 'Line one.\n\nLine two.' }
    expect(formatAssistResultForDraft(result, typeLabel)).toBe('Line one. Line two.')
  })

  it('trims and collapses repeated whitespace', () => {
    const result: ConversationAssistResult = { kind: 'text', text: '  Hello   world  ' }
    expect(formatAssistResultForDraft(result, typeLabel)).toBe('Hello world')
  })
})

describe('formatAssistResultForDraft · actions', () => {
  it('joins items into one "; "-separated line with type + due date', () => {
    const result: ConversationAssistResult = {
      kind: 'actions',
      items: [
        { title: 'Bel terug', type: 'task', due_date: '2026-08-10', note_excerpt: null },
        { title: 'Stuur bevestiging', type: 'whatsapp', due_date: null, note_excerpt: null },
      ],
    }
    expect(formatAssistResultForDraft(result, typeLabel)).toBe('Bel terug (TASK · 2026-08-10); Stuur bevestiging (WHATSAPP)')
  })

  it('returns an empty string for zero items', () => {
    const result: ConversationAssistResult = { kind: 'actions', items: [] }
    expect(formatAssistResultForDraft(result, typeLabel)).toBe('')
  })
})
