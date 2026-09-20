/**
 * waMarkup — WA-COMPOSER-1: WhatsApp's bold/italic/strikethrough markup
 * rendered as React elements, never HTML parsing / dangerouslySetInnerHTML (§7).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderWaMarkup } from './waMarkup'

describe('renderWaMarkup', () => {
  it('renders *bold* as <strong>', () => {
    const { container } = render(<div>{renderWaMarkup('hi *there* now')}</div>)
    expect(container.querySelector('strong')?.textContent).toBe('there')
  })

  it('renders _italic_ as <em>', () => {
    const { container } = render(<div>{renderWaMarkup('_note_')}</div>)
    expect(container.querySelector('em')?.textContent).toBe('note')
  })

  it('renders ~strike~ as <s>', () => {
    const { container } = render(<div>{renderWaMarkup('~oops~')}</div>)
    expect(container.querySelector('s')?.textContent).toBe('oops')
  })

  it('leaves an unmatched marker literal', () => {
    const { container } = render(<div>{renderWaMarkup('price is *5 euro')}</div>)
    expect(container.textContent).toBe('price is *5 euro')
    expect(container.querySelector('strong')).toBeNull()
  })

  it('leaves an underscore inside a word literal (snake_case, not paired on the line)', () => {
    const { container } = render(<div>{renderWaMarkup('field_name only')}</div>)
    expect(container.textContent).toBe('field_name only')
    expect(container.querySelector('em')).toBeNull()
  })

  it('never crosses a newline boundary', () => {
    const { container } = render(<div>{renderWaMarkup('*open\nclose*')}</div>)
    expect(container.querySelector('strong')).toBeNull()
    expect(container.textContent).toBe('*openclose*')
    expect(container.querySelector('br')).not.toBeNull()
  })
})
