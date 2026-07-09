/**
 * buildVarFields — bundle expansion contract (CMBE 2026-07-09): list output
 * fields expose item[0]'s keys as flat {{field}} placeholders (send-modules run
 * per bundle item); scalars stay node-scoped; no run → whole-output token.
 */
import { describe, it, expect } from 'vitest'
import { buildVarFields } from './useWorkflowEditor'

describe('buildVarFields', () => {
  it('expands a list field into flat {{field}} tokens from item[0], incl. dot-paths', () => {
    const fields = buildVarFields('n1', {
      candidates: [{ firstname: 'Eva', datum_nl: 'wo 9 jul', user: { email: 'e@x.nl' } }],
      count: 8,
    })
    const tokens = fields.map(f => f.token)
    expect(tokens).toContain('{{firstname}}')
    expect(tokens).toContain('{{datum_nl}}')
    expect(tokens).toContain('{{user.email}}')
    // The list summary row itself is NOT insertable anymore.
    expect(tokens).not.toContain('{{n1.candidates}}')
    // Scalars keep the node-scoped token.
    expect(tokens).toContain('{{n1.count}}')
  })

  it('treats a top-level array output as one bundle (no node-scoped duplicates)', () => {
    const fields = buildVarFields('n2', [{ name: 'A', mobile: '06' }])
    const tokens = fields.map(f => f.token)
    expect(tokens).toEqual(expect.arrayContaining(['{{name}}', '{{mobile}}']))
    expect(tokens.some(t => t.startsWith('{{n2.'))).toBe(false)
  })

  it('dedupes identical field names across multiple list fields', () => {
    const fields = buildVarFields('n3', {
      candidates: [{ name: 'A' }],
      customers: [{ name: 'B', city: 'Utrecht' }],
    })
    const tokens = fields.map(f => f.token)
    expect(tokens.filter(t => t === '{{name}}')).toHaveLength(1)
    expect(tokens).toContain('{{city}}')
  })

  it('keeps a scalar-only output fully node-scoped', () => {
    const tokens = buildVarFields('n4', { total: 5, ok: true }).map(f => f.token)
    expect(tokens).toEqual(expect.arrayContaining(['{{n4.total}}', '{{n4.ok}}']))
  })

  it('falls back to the whole-output token when the node never ran', () => {
    expect(buildVarFields('n5', null)).toEqual([{ token: '{{n5}}', label: '' }])
  })

  it('ignores empty lists and lists of scalars (no bundle to expand)', () => {
    const tokens = buildVarFields('n6', { empty: [], ids: [1, 2, 3], note: 'x' }).map(f => f.token)
    expect(tokens).toContain('{{n6.note}}')
    expect(tokens.some(t => t === '{{0}}' || t === '{{1}}')).toBe(false)
  })
})
