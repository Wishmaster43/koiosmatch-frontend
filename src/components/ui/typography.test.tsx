/**
 * Typography atoms — the contract that keeps 159 headings, 371 paragraphs and
 * 601 captions from re-drifting: identity comes from the atom (size/weight/
 * token colour), semantics from `as`, layout stays with the caller.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageTitle, SectionTitle, BodyText, Caption, GroupLabel, FormLabel, Mono } from './typography'

describe('typography atoms', () => {
  it('PageTitle renders 15/600 on the text token, h2 by default, any tag via as', () => {
    render(<PageTitle>Overzicht</PageTitle>)
    const el = screen.getByRole('heading', { level: 2, name: 'Overzicht' })
    expect(el.style.fontSize).toBe('15px')
    expect(el.style.fontWeight).toBe('600')
    expect(el.style.color).toBe('var(--text)')
    render(<PageTitle as="h1">Hoofd</PageTitle>)
    expect(screen.getByRole('heading', { level: 1, name: 'Hoofd' })).toBeInTheDocument()
  })

  it('FormLabel is the 12/500 muted field label, a <label> by default so htmlFor reaches its field', () => {
    render(<><FormLabel htmlFor="f1">Naam</FormLabel><input id="f1" /></>)
    const el = screen.getByText('Naam')
    expect(el.tagName).toBe('LABEL')
    expect(el.style.fontSize).toBe('12px')
    expect(el.style.fontWeight).toBe('500')
    expect(el.style.color).toBe('var(--text-muted)')
    expect(screen.getByLabelText('Naam')).toBeInTheDocument()
  })

  it('Caption is the 11px muted meta line', () => {
    render(<Caption>2 dagen geleden</Caption>)
    const el = screen.getByText('2 dagen geleden')
    expect(el.style.fontSize).toBe('11px')
    expect(el.style.color).toBe('var(--text-muted)')
  })

  it('caller style may add layout but never silently loses the identity', () => {
    render(<SectionTitle style={{ marginBottom: 8 }}>Sectie</SectionTitle>)
    const el = screen.getByText('Sectie')
    expect(el.style.marginBottom).toBe('8px')
    expect(el.style.fontWeight).toBe('600')
  })

  it('BodyText is a real paragraph; GroupLabel uppercases via style, not content', () => {
    render(<BodyText>Lopende tekst.</BodyText>)
    expect(screen.getByText('Lopende tekst.').tagName).toBe('P')
    render(<GroupLabel>Contact</GroupLabel>)
    const g = screen.getByText('Contact')
    expect(g.style.textTransform).toBe('uppercase')
    expect(g.textContent).toBe('Contact') // screen readers hear the real word
  })

  it('Mono only sets the family — size follows the surrounding text', () => {
    render(<Mono>REF-001</Mono>)
    const el = screen.getByText('REF-001')
    expect(el.style.fontFamily).toContain('JetBrains Mono')
    expect(el.style.fontSize).toBe('')
  })
})
