/**
 * TargetsTab (bellijst) — regression test for the Blueprint-7 audit residue,
 * re-verified 2026-08-05: the row's candidate name already opens the candidate
 * drawer via useNavigation().openEntity (mirrors ScopedMatchesTab's row-click
 * pattern), and the tab never renders a selection affordance — there is no bulk
 * action here to consume a selection, so a checkbox would be a fake affordance
 * (§3). This test pins both facts down so neither regresses silently.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch copy.
import '@/i18n'
import TargetsTab from './TargetsTab'
import type { OutreachTarget } from '../hooks/useOutreachDetail'

// openEntity is the seam under test — pin the exact page/id it is called with.
const openEntityMock = vi.fn()
vi.mock('@/context/NavigationContext', () => ({
  useNavigation: () => ({ openEntity: openEntityMock, navigate: vi.fn() }),
}))

// Tenant lookups are network-backed elsewhere (useCachedLookup) — stub static
// data here so the row renders deterministically without an API dependency.
vi.mock('@/lib/useOutreachOutcomes', () => ({
  useOutreachOutcomes: () => ({ outcomes: [], metaOf: () => undefined }),
}))
/* eslint-disable no-restricted-syntax -- DATA: mock hex mirrors useOutreachStatuses's own seed DATA, not UI styling */
vi.mock('@/lib/useOutreachStatuses', () => ({
  useOutreachStatuses: () => ({
    statuses: [
      { value: 'todo', label: 'Te doen', color: '#94A3B8', is_reached: false },
      { value: 'contacted', label: 'Benaderd', color: '#6E8FD6', is_reached: true },
    ],
    metaOf: (v?: string) =>
      v === 'contacted'
        ? { value: 'contacted', label: 'Benaderd', color: '#6E8FD6', is_reached: true }
        : { value: 'todo', label: 'Te doen', color: '#94A3B8', is_reached: false },
    initial: { value: 'todo', label: 'Te doen', color: '#94A3B8', is_reached: false },
  }),
}))
/* eslint-enable no-restricted-syntax */
// The vacancy picker only loads while the match prompt is open (never in this test).
vi.mock('@/pages/candidates/hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
// CandidateStatusChip reads LookupsContext — stub the two fields it touches.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ statusMeta: (v: string) => ({ label: v, color: '#000' }), phases: [{ value: 'lead' }] }),
}))

const target: OutreachTarget = {
  id: 't1',
  status: 'todo',
  candidate: { id: 'c1', name: 'Jan Jansen', status: 'available', phase: 'candidate' },
}

describe('TargetsTab · candidate link-through', () => {
  it('opens the candidate drawer when the row name is clicked (mirrors ScopedMatchesTab row-click)', async () => {
    const user = userEvent.setup()
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    await user.click(screen.getByText('Jan Jansen'))
    // THE SEAM: exact page + candidate id, never a generic "it navigated somewhere".
    expect(openEntityMock).toHaveBeenCalledWith('candidates', 'c1')
  })

  it('never renders a selection affordance (no bulk action exists to consume it, §3 no fake affordances)', () => {
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('handles the four UI states honestly (loading / error / empty / success)', () => {
    const { rerender } = render(<TargetsTab targets={[]} loading={true} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.getByText(/laden|loading/i)).toBeInTheDocument()

    rerender(<TargetsTab targets={[]} loading={false} error={true} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.getByText(/mislukt|error|fout/i)).toBeInTheDocument()

    rerender(<TargetsTab targets={[]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.queryByText('Jan Jansen')).toBeNull()

    rerender(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
  })
})
