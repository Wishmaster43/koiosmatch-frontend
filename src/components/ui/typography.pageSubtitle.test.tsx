import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageSubtitle, pageSubtitleStyle, tableHeadStyle } from './typography'

// The subtitle atom keeps the identity the 136 hand-written sites carried: 12px, 400, muted.
describe('PageSubtitle', () => {
  it('renders the 12/400/muted identity and honours as + layout style', () => {
    render(<PageSubtitle as="div" style={{ marginTop: 2 }}>sub</PageSubtitle>)
    const el = screen.getByText('sub')
    expect(el.tagName).toBe('DIV')
    expect(el.style.fontSize).toBe('12px')
    expect(el.style.fontWeight).toBe('400')
    expect(el.style.color).toBe('var(--text-muted)')
    expect(el.style.marginTop).toBe('2px')
  })
  it('exports the raw identities', () => {
    expect(pageSubtitleStyle).toEqual({ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' })
    expect(tableHeadStyle.fontSize).toBe(11)
    expect(tableHeadStyle.fontWeight).toBe(600)
    expect(tableHeadStyle.color).toBe(pageSubtitleStyle.color)
  })
})
