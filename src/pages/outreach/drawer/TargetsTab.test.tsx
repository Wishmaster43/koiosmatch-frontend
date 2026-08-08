/**
 * TargetsTab (bellijst) — candidate link-through regression (Blueprint-7 audit
 * residue), the four UI states, and the G29/G30/G31 additions: row selection +
 * round-robin assign (BELLIJST-ASSIGN-1), the per-target note, and the Stats-tab
 * click-to-filter narrowing. §13: mutation tests assert the exact request the
 * caller (useOutreachDetail, via props here) is invoked with — never only that
 * a callback fired.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch copy.
import '@/i18n'
import nlOutreach from '@/i18n/locales/nl/outreach.json'
import TargetsTab from './TargetsTab'
import { useVacancyOptions } from '@/pages/candidates/hooks/useVacancyOptions'
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
// The vacancy picker only loads while the match prompt is open — `vi.fn()` (not a
// plain arrow) so the G34 dropdown test below can override it with real options.
vi.mock('@/pages/candidates/hooks/useVacancyOptions', () => ({ useVacancyOptions: vi.fn(() => []) }))
// CandidateStatusChip reads LookupsContext — stub the two fields it touches.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ statusMeta: (v: string) => ({ label: v, color: '#000' }), phases: [{ value: 'lead' }] }),
}))

const target: OutreachTarget = {
  id: 't1',
  status: 'todo',
  candidate: { id: 'c1', name: 'Jan Jansen', status: 'available', phase: 'candidate' },
}
const contactedTarget: OutreachTarget = {
  id: 't2',
  status: 'contacted',
  candidate: { id: 'c2', name: 'Fatima Baz', status: 'available', phase: 'candidate' },
}

describe('TargetsTab · candidate link-through', () => {
  it('opens the candidate drawer when the row name is clicked (mirrors ScopedMatchesTab row-click)', async () => {
    const user = userEvent.setup()
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    await user.click(screen.getByText('Jan Jansen'))
    // THE SEAM: exact page + candidate id, never a generic "it navigated somewhere".
    expect(openEntityMock).toHaveBeenCalledWith('candidates', 'c1')
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

// G29 — BELLIJST-ASSIGN-1: selection + round-robin assign. The old blanket "no
// checkbox ever" assertion is gone — it was true only because no bulk action
// existed yet to consume a selection (§3 no fake affordances); now one does,
// gated behind the SAME props that used to be absent.
describe('TargetsTab · selection + assign (G29)', () => {
  it('renders no selection affordance when no assign handler is wired (still honest — §3)', () => {
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('renders a select-all + one checkbox per row once onAssignTargets is wired', () => {
    render(<TargetsTab targets={[target, contactedTarget]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()}
      recruiters={[{ value: 'r1', label: 'Nora Recruiter' }]} onAssignTargets={vi.fn()} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('selects a target then assigns it — POSTs the exact target_ids/recruiter_ids via onAssignTargets', async () => {
    const user = userEvent.setup()
    const onAssignTargets = vi.fn().mockResolvedValue({ updated: ['t1'], skipped: [] })
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()}
      recruiters={[{ value: 'r1', label: 'Nora Recruiter' }]} onAssignTargets={onAssignTargets} />)

    await user.click(screen.getByRole('checkbox', { name: 'Selecteer rij' }))
    // The select-all bar swaps for the assign bar once ≥1 row is selected.
    await user.click(screen.getByRole('button', { name: nlOutreach.drawer.assign.button }))
    await user.click(screen.getByRole('menuitem', { name: nlOutreach.drawer.assign.pickRecruiters }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Nora Recruiter' }))
    // The confirm button's accessible name grows a live "(1)" selection count.
    await user.click(screen.getByRole('button', { name: new RegExp(nlOutreach.drawer.assign.confirm) }))

    // THE SEAM: exact ids passed through to the mutation.
    expect(onAssignTargets).toHaveBeenCalledWith(['t1'], ['r1'])
  })

  it('disables the assign trigger with zero recruiters (no fake affordance)', async () => {
    const user = userEvent.setup()
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()}
      recruiters={[]} onAssignTargets={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: 'Selecteer rij' }))
    // No recruiters configured for this tenant → the trigger is disabled, never
    // a menu that always resolves to "no results".
    expect(screen.getByRole('button', { name: nlOutreach.drawer.assign.button })).toBeDisabled()
  })
})

// G30 — the note field + max:2000 validation already exist on the backend as a
// PLAIN string; this is a plain textarea, never the RichTextEditor.
describe('TargetsTab · per-target note (G30)', () => {
  it('renders nothing extra when no note handler is wired (no fake affordance)', () => {
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.queryByText(nlOutreach.drawer.note.empty)).toBeNull()
  })

  it('saves a note through the exact (id, note) shape the PATCH wrapper expects', async () => {
    const user = userEvent.setup()
    const onSetNote = vi.fn().mockResolvedValue(undefined)
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} onSetNote={onSetNote} />)

    expect(screen.getByText(nlOutreach.drawer.note.empty)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bewerken' }))
    await user.type(screen.getByPlaceholderText(nlOutreach.drawer.note.placeholder), 'Bel na 17u terug')
    await user.click(screen.getByRole('button', { name: 'Opslaan' }))

    // THE SEAM: exact target id + trimmed note text.
    expect(onSetNote).toHaveBeenCalledWith('t1', 'Bel na 17u terug')
  })

  it('displays an existing note read-only until the pencil is clicked', () => {
    render(<TargetsTab targets={[{ ...target, note: 'Al twee keer gemist' }]} loading={false} error={false}
      onSetStatus={vi.fn()} onSetOutcome={vi.fn()} onSetNote={vi.fn()} />)
    expect(screen.getByText('Al twee keer gemist')).toBeInTheDocument()
  })
})

// G31 — the Stats tab's donut click narrows THIS list to one status/outcome/
// assignee value; the filter chip here is the honest "you are looking at a
// subset" signal, with its own working clear button.
describe('TargetsTab · Stats-tab filter (G31)', () => {
  it('shows every target when no filter is active', () => {
    render(<TargetsTab targets={[target, contactedTarget]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Fatima Baz')).toBeInTheDocument()
  })

  it('narrows to the active filter value and clears it via the chip button', async () => {
    const user = userEvent.setup()
    const onClearFilter = vi.fn()
    render(<TargetsTab targets={[target, contactedTarget]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()}
      filter={{ axis: 'status', value: 'contacted' }} onClearFilter={onClearFilter} />)

    expect(screen.queryByText('Jan Jansen')).toBeNull()
    expect(screen.getByText('Fatima Baz')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: nlOutreach.insights.clearFilter }))
    expect(onClearFilter).toHaveBeenCalled()
  })

  it('shows the filtered-empty state (not the generic error) when nothing matches', () => {
    render(<TargetsTab targets={[target]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()}
      filter={{ axis: 'status', value: 'contacted' }} onClearFilter={vi.fn()} />)
    expect(screen.getByText(nlOutreach.drawer.stats.noMatches)).toBeInTheDocument()
  })

  it('filters by assignee (unassigned sentinel = empty string)', () => {
    const assigned: OutreachTarget = { ...target, assignee: { id: 'r1', name: 'Nora Recruiter' } }
    render(<TargetsTab targets={[assigned, contactedTarget]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()}
      filter={{ axis: 'assignee', value: '' }} onClearFilter={vi.fn()} />)
    // t1 has an assignee -> filtered out; t2 has none -> matches the '' sentinel.
    expect(screen.queryByText('Jan Jansen')).toBeNull()
    expect(screen.getByText('Fatima Baz')).toBeInTheDocument()
  })
})

// G34: the inline "Match maken" vacancy picker is the house CreatableSelect
// (allowCreate={false}), never a native <select> — proves the same setMatchVacancyId
// wiring as before (value/options identical) through the new click-to-open interaction.
describe('TargetsTab · vacancy match picker is the house CreatableSelect, not a native <select>', () => {
  it('renders no native <select>, and picking a vacancy enables the Confirm button', async () => {
    // The hook is called on every render (its own `enabled` gate lives inside the
    // real react-query implementation, mocked away here) — `mockReturnValue`, not
    // `...Once`, so the list is still there once the match prompt actually opens.
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A' }])
    const user = userEvent.setup()
    const { container } = render(<TargetsTab targets={[contactedTarget]} loading={false} error={false} onSetStatus={vi.fn()} onSetOutcome={vi.fn()} />)

    // contactedTarget is already "handled" (status !== todo) — the follow-up
    // actions (incl. "Match maken") render instead of the initial status chips.
    await user.click(screen.getByRole('button', { name: nlOutreach.drawer.action.makeMatch }))
    expect(container.querySelector('select')).toBeNull()
    expect(screen.getByRole('button', { name: nlOutreach.drawer.matchConfirm })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: nlOutreach.drawer.matchPick }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))

    expect(screen.getByRole('button', { name: nlOutreach.drawer.matchConfirm })).toBeEnabled()
  })
})
