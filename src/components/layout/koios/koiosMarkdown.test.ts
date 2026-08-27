/**
 * koiosMarkdownToHtml — KOIOS-CHAT (Danny screenshot): the chat bubble must
 * render bold text and lists as real markup, never raw asterisks, and must
 * never let a crafted reply inject markup of its own (escaped before conversion).
 */
import { describe, it, expect } from 'vitest'
import { koiosMarkdownToHtml } from './koiosMarkdown'

describe('koiosMarkdownToHtml', () => {
  it('renders bold text as <strong>', () => {
    expect(koiosMarkdownToHtml('this is **important**')).toBe('this is <strong>important</strong>')
  })

  it('renders a bulleted list as <ul><li>', () => {
    expect(koiosMarkdownToHtml('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })

  it('renders a numbered list as <ol><li>', () => {
    expect(koiosMarkdownToHtml('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
  })

  it('renders plain line breaks as <br/>', () => {
    expect(koiosMarkdownToHtml('line one\nline two')).toBe('line one<br/>line two')
  })

  it('escapes raw HTML before applying markdown, so no tag can be smuggled in', () => {
    expect(koiosMarkdownToHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    )
  })
})
