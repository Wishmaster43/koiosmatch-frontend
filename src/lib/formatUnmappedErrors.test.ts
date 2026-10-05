/**
 * formatUnmappedErrors — joins unmapped 422 entries into one banner string;
 * Laravel's raw "required" template is rewritten via the injected `t`, a
 * crafted message rides through verbatim, and an empty list yields null.
 */
import { describe, it, expect, vi } from 'vitest'
import { formatUnmappedErrors } from './formatUnmappedErrors'

const t = vi.fn((key: string, opts?: Record<string, unknown>) => `${key}:${JSON.stringify(opts)}`)

describe('formatUnmappedErrors', () => {
  it('rewrites the raw Laravel required template via the named field', () => {
    const list = [{ key: 'custom_fields.vog', message: 'The custom_fields.vog field is required.' }]
    expect(formatUnmappedErrors(list, t)).toBe('common:validation.fieldRequiredNamed:{"field":"vog"}')
  })

  it('passes a crafted (non-template) message through verbatim', () => {
    const list = [{ key: 'items.0.sku', message: 'This SKU is already taken.' }]
    expect(formatUnmappedErrors(list, t)).toBe('This SKU is already taken.')
  })

  it('falls back to the named-field translation when an entry carries no message', () => {
    const list = [{ key: 'custom_fields.vog', message: null }]
    expect(formatUnmappedErrors(list, t)).toBe('common:validation.fieldRequiredNamed:{"field":"vog"}')
  })

  it('joins multiple entries with a space', () => {
    const list = [
      { key: 'items.0.sku', message: 'This SKU is already taken.' },
      { key: 'custom_fields.vog', message: 'The custom_fields.vog field is required.' },
    ]
    expect(formatUnmappedErrors(list, t)).toBe('This SKU is already taken. common:validation.fieldRequiredNamed:{"field":"vog"}')
  })

  it('returns null for an empty list', () => {
    expect(formatUnmappedErrors([], t)).toBeNull()
  })
})
