import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KoiosAdvicePill } from './koiosAdviceMeta'

// Shared "Koios" column pill — was two near-duplicate ADVICE_META maps in
// CandidatesTable and CustomersTable; this is now the one renderer both use.
describe('KoiosAdvicePill', () => {
  it('renders a dash when there is no advice', () => {
    render(<KoiosAdvicePill advice={null} colored />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a dash when the action is "none"', () => {
    render(<KoiosAdvicePill advice={{ action: 'none' }} colored />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders plain text (no icon wrapper) when colored is false', () => {
    render(<KoiosAdvicePill advice={{ action: 'contact', label: 'Bellen' }} colored={false} />)
    expect(screen.getByText('Bellen')).toBeInTheDocument()
  })

  it('renders the coloured pill with its icon for a known action', () => {
    const { container } = render(<KoiosAdvicePill advice={{ action: 'plan_intake', label: 'Intake plannen' }} colored />)
    expect(screen.getByText('Intake plannen')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('falls back to the default icon/colour for an unrecognised action', () => {
    const { container } = render(<KoiosAdvicePill advice={{ action: 'something_new', label: 'Iets nieuws' }} colored />)
    expect(screen.getByText('Iets nieuws')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('resolves the label via fallbackLabel when the advice carries none', () => {
    render(<KoiosAdvicePill advice={{ action: 'contact' }} colored={false} fallbackLabel={a => `label:${a}`} />)
    expect(screen.getByText('label:contact')).toBeInTheDocument()
  })
})
