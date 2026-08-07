/**
 * noteAssistApply — pure transform tests (NOTE-ASSIST-1). Covers the two things
 * that matter most: improve REPLACES vs summarize/actions APPEND (Danny's
 * explicit "nooit auto-overschrijven"), and the model's plain-text reply is
 * always escaped before it becomes HTML (never inserted raw, §7).
 */
import { describe, it, expect } from 'vitest'
import { applyAssistResult } from './noteAssistApply'
import type { AssistResult } from './noteAssistApi'

const typeLabel = (type: string) => type.toUpperCase()

describe('applyAssistResult · improve', () => {
  it('REPLACES the current body entirely', () => {
    const result: AssistResult = { kind: 'text', text: 'Better prose.' }
    const next = applyAssistResult('<p>Old body</p>', 'improve', result, typeLabel)
    expect(next).toBe('<p>Better prose.</p>')
    expect(next).not.toContain('Old body')
  })

  it('splits multi-paragraph prose into one <p> per line', () => {
    const result: AssistResult = { kind: 'text', text: 'Line one.\n\nLine two.' }
    const next = applyAssistResult('<p>Old</p>', 'improve', result, typeLabel)
    expect(next).toBe('<p>Line one.</p><p>Line two.</p>')
  })

  it('escapes HTML-significant characters in the model reply', () => {
    const result: AssistResult = { kind: 'text', text: 'Cost < 100 & > expected' }
    const next = applyAssistResult('', 'improve', result, typeLabel)
    expect(next).toBe('<p>Cost &lt; 100 &amp; &gt; expected</p>')
  })
})

describe('applyAssistResult · summarize', () => {
  it('APPENDS below the existing body — never overwrites it', () => {
    const result: AssistResult = { kind: 'text', text: 'Short summary.' }
    const next = applyAssistResult('<p>Original note</p>', 'summarize', result, typeLabel)
    expect(next).toBe('<p>Original note</p><p>Short summary.</p>')
  })
})

describe('applyAssistResult · actions', () => {
  it('APPENDS a bullet list of title + type + due date', () => {
    const result: AssistResult = {
      kind: 'actions',
      items: [
        { title: 'Bel terug', type: 'task', due_date: '2026-08-10', note_excerpt: null },
        { title: 'Stuur WhatsApp', type: 'whatsapp', due_date: null, note_excerpt: null },
      ],
    }
    const next = applyAssistResult('<p>Note</p>', 'actions', result, typeLabel)
    expect(next).toBe(
      '<p>Note</p><ul><li><strong>Bel terug</strong> (TASK · 2026-08-10)</li>'
      + '<li><strong>Stuur WhatsApp</strong> (WHATSAPP)</li></ul>',
    )
  })

  it('escapes an action title carrying HTML-significant characters', () => {
    const result: AssistResult = { kind: 'actions', items: [{ title: 'Bel <VIP>', type: 'task', due_date: null, note_excerpt: null }] }
    const next = applyAssistResult('', 'actions', result, typeLabel)
    expect(next).toContain('Bel &lt;VIP&gt;')
    expect(next).not.toContain('<VIP>')
  })
})
