/**
 * CandidateDetailDrawer — restyle regression test (Danny 24-07 "maak 'm hetzelfde"):
 * asserts the calm native-drawer header renders (name + soft, never-solid status
 * pill + mono reference chip) and a features soft-chip shows. Mirrors
 * SmCandidatesTable.test.tsx's convention of a real i18n (nl) side-effect import
 * so actual Dutch text resolves instead of raw keys.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import CandidateDetailDrawer from './CandidateDetailDrawer'
import type { ReportCandidate } from '@/types/reports'

const candidate: ReportCandidate = {
  id: 42, firstname: 'Anna', lastname: 'Jansen', position: 'Verpleegkundige',
  status: 'actief', email: 'anna@example.com', mobile: '0612345678', city: 'Utrecht',
  features: [{ name: 'Nachtdienst' }],
}

describe('CandidateDetailDrawer — restyled header', () => {
  it('shows the name, a soft (never solid) status pill and the mono reference chip', () => {
    render(<CandidateDetailDrawer candidate={candidate} onClose={() => {}} />)
    expect(screen.getByText('Anna Jansen')).toBeInTheDocument()

    // SoftChip tints via color-mix — never a solid fill (§4).
    const pill = screen.getByText('Actief')
    expect(pill.closest('span')).toHaveStyle({ background: 'color-mix(in srgb, var(--color-success) 10%, transparent)' })

    // ReferenceNumberChip — the id in JetBrains Mono with a click-to-copy affordance.
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders a features soft-chip', () => {
    render(<CandidateDetailDrawer candidate={candidate} onClose={() => {}} />)
    expect(screen.getByText('Nachtdienst')).toBeInTheDocument()
  })

  it('has an aria-labelled close button that fires onClose', () => {
    const onClose = vi.fn()
    render(<CandidateDetailDrawer candidate={candidate} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing when there is no candidate (loading/closed state)', () => {
    const { container } = render(<CandidateDetailDrawer candidate={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
