import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { makeKoiosColumn } from './koiosColumn'

// Minimal row shape — only what adviceOf reads.
interface Row { id: number; advice: { action: string; label: string } | null }

describe('makeKoiosColumn', () => {
  it('renders the header with the Koios mark + the given label', () => {
    const col = makeKoiosColumn<Row>({ adviceOf: () => null, colored: true, label: 'Koios' })
    render(<table><thead><tr>{col.header}</tr></thead></table>)
    expect(screen.getByText('Koios')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
  })

  it('renders the resolved advice via the shared pill', () => {
    const col = makeKoiosColumn<Row>({ adviceOf: r => r.advice, colored: true, label: 'Koios' })
    const row: Row = { id: 1, advice: { action: 'contact', label: 'Contact' } }
    render(<table><tbody><tr>{col.render?.(row)}</tr></tbody></table>)
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })

  it('renders an honest dash when the resolver returns null', () => {
    const col = makeKoiosColumn<Row>({ adviceOf: () => null, colored: true, label: 'Koios' })
    const row: Row = { id: 1, advice: null }
    render(<table><tbody><tr>{col.render?.(row)}</tr></tbody></table>)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('sorts on the advice action slug (dash rows share one empty-string bucket)', () => {
    const col = makeKoiosColumn<Row>({ adviceOf: r => r.advice, colored: true, label: 'Koios' })
    const withAdvice: Row = { id: 1, advice: { action: 'contact', label: 'Contact' } }
    const withoutAdvice: Row = { id: 2, advice: null }
    expect(col.sortValue?.(withAdvice)).toBe('contact')
    expect(col.sortValue?.(withoutAdvice)).toBe('')
  })

  it('falls back to fallbackLabel when the advice carries no label', () => {
    const col = makeKoiosColumn<Row>({
      adviceOf: () => ({ action: 'contact' }), colored: false, label: 'Koios',
      fallbackLabel: a => `label:${a}`,
    })
    render(<table><tbody><tr>{col.render?.({ id: 1, advice: null })}</tr></tbody></table>)
    expect(screen.getByText('label:contact')).toBeInTheDocument()
  })
})
