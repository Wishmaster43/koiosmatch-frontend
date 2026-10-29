// stripComments — the english-code counter's comment stripper must blank only real comments
// and never touch string, template or regex literals (ONIX-RECHECK-1 #231).
import { describe, it, expect } from 'vitest'
import { stripComments } from './stripComments.mjs'

describe('stripComments (english-code counter)', () => {
  it('blanks line and block comments but keeps every newline and column', () => {
    const src = 'const a = 1 // tail\n/* block\n spans */ const b = 2\n'
    const out = stripComments(src)
    expect(out.length).toBe(src.length)
    expect(out.split('\n').length).toBe(src.split('\n').length)
    expect(out).not.toContain('tail')
    expect(out).not.toContain('spans')
    expect(out).toContain('const b = 2')
    expect(out.indexOf('const b')).toBe(src.indexOf('const b'))
  })

  it('leaves a /* inside a string alone, so following code is not blanked', () => {
    const src = "const g = '**/*.test.*'\nconst keep = 1 */ still code\n"
    expect(stripComments(src)).toBe(src)
  })

  it('leaves a // inside a string or template alone', () => {
    const src = 'const u = "https://example.com/x" + `//${path("//y")}`\n'
    expect(stripComments(src)).toBe(src)
  })

  it('keeps a regex literal that contains // and blanks the comment after it', () => {
    const src = 'const re = /https?:\\/\\//i // comment\nreturn /\\/\\/[a-z]/.test(s)\n'
    const out = stripComments(src)
    expect(out).toContain('/https?:\\/\\//i')
    expect(out).not.toContain('comment')
    expect(out).toContain('return /\\/\\/[a-z]/.test(s)')
  })

  it('treats a / after an operand as division, not as a regex start', () => {
    const src = 'const x = a / b // half\nconst y = (a) / 2\n'
    const out = stripComments(src)
    expect(out).not.toContain('half')
    expect(out).toContain('const y = (a) / 2')
  })

  it('blanks a comment inside a template expression without losing the template text', () => {
    const src = 'const t = `a ${x /* why */ + 1} b`\n'
    const out = stripComments(src)
    expect(out).not.toContain('why')
    expect(out).toContain('const t = `a ${x')
    expect(out).toContain('+ 1} b`')
  })
})
