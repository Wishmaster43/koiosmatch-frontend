/**
 * jsonFormat — the draft ⇄ stored-string round trip per catalogue json format.
 */
import { describe, it, expect } from 'vitest'
import { toDraft, fromDraft } from './jsonFormat'

describe('jsonFormat', () => {
  it('string_list renders one item per line and parses back to a JSON array string', () => {
    expect(toDraft('["a","b"]', 'string_list')).toBe('a\nb')
    expect(fromDraft(' a \n\nb\n', 'string_list')).toBe('["a","b"]')
    expect(fromDraft('', 'string_list')).toBe('[]')
  })

  it('key_value renders key=value lines and keeps "=" inside values', () => {
    expect(toDraft('{"x":"1","y":"a=b"}', 'key_value')).toBe('x=1\ny=a=b')
    expect(fromDraft('x=1\ny=a=b\nbare', 'key_value')).toBe('{"x":"1","y":"a=b","bare":""}')
  })

  it('raw json pretty-prints stored text and re-minifies a valid draft', () => {
    expect(toDraft('{"a":1}', undefined)).toBe('{\n  "a": 1\n}')
    expect(fromDraft('{ "a" : 1 }', undefined)).toBe('{"a":1}')
    expect(() => fromDraft('{oops', undefined)).toThrow()
  })

  it('tolerates a blank or malformed stored value', () => {
    expect(toDraft('', 'string_list')).toBe('')
    expect(toDraft('not json', 'key_value')).toBe('')
    expect(toDraft('not json', undefined)).toBe('not json')
  })
})
