/**
 * AddShiftCandidateColumn — D9 regression: the "candidates" group heading now
 * renders through the shared GroupLabel typography atom (§4) instead of a
 * locally re-picked fontSize/fontWeight/letterSpacing/uppercase identity.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AddShiftCandidateColumn from './AddShiftCandidateColumn'

const t = (k: string) => k

describe('AddShiftCandidateColumn · group label uses the shared typography atom (D9)', () => {
  it('renders the candidates heading with the GroupLabel identity (11px/600/uppercase/muted)', () => {
    render(
      <AddShiftCandidateColumn t={t} searchQuery="" setSearchQuery={vi.fn()}
        candidatesLoading={false} candidatesError={false} candidates={[]}
        candidate={null} setCandidate={vi.fn()} />,
    )
    const heading = screen.getByText('common:nav.candidates')
    expect(heading).toHaveStyle({ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' })
  })
})
