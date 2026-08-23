import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KoiosContextChips from './KoiosContextChips'

const t = (k: string) => k

describe('KoiosContextChips', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(<KoiosContextChips chips={[]} t={t} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a chip per row and calls its own onRemove', () => {
    const onRemove = vi.fn()
    render(<KoiosContextChips chips={[{ ref: { type: 'candidate', id: '1', label: 'Ahmed Vos' }, onRemove }]} t={t} />)
    expect(screen.getByText('Ahmed Vos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'remove Ahmed Vos' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  // A type the backend cannot resolve yet (koiosContextTypes: only 'candidate'
  // today) renders dashed + tooltipped, never solid — the pin stays visible but
  // honest about not being sent.
  it('renders an unresolvable type as a dashed, tooltipped chip', () => {
    render(<KoiosContextChips chips={[{ ref: { type: 'vacancy', id: 'v1', label: 'Verpleegkundige' }, onRemove: vi.fn() }]} t={t} />)
    const chip = screen.getByText('Verpleegkundige').closest('span')
    expect(chip).toHaveAttribute('title', 'koios.contextPending')
    // jsdom can't resolve var() inside the `border` shorthand for toHaveStyle's
    // computed-style diff, so assert the raw inline style string instead.
    expect(chip?.getAttribute('style')).toContain('dashed')
  })

  it('renders a resolvable type without the pending tooltip/dashing', () => {
    render(<KoiosContextChips chips={[{ ref: { type: 'candidate', id: 'c1', label: 'Ahmed Vos' }, onRemove: vi.fn() }]} t={t} />)
    const chip = screen.getByText('Ahmed Vos').closest('span')
    expect(chip).not.toHaveAttribute('title')
    expect(chip?.getAttribute('style')).toContain('solid')
  })
})
