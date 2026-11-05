/** MatchDrawer · header actions and trash lifecycle (split from MatchDrawer.test.tsx; mock header duplicated, hoisted mocks cannot be shared). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MatchDrawer from './MatchDrawer'
import { match, COLOR_A, COLOR_B } from './MatchDrawer.testKit'

// MATCH-TERMINATE-1: metaOf's is_closed flag now drives the header's terminate
// button gate — the mock must return a working metaOf, not just a bare list.
// X-3 / B2: auth is mocked per test — null (no provider) by default, so every block
// written before the mock keeps the exact behaviour it was written against.
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn((): unknown => null) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

vi.mock('@/lib/useMatchStatuses', () => ({
  useMatchStatuses: () => ({
    statuses: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Afgesloten' }],
    metaOf: (v?: string | null) => ({
      open: { value: 'open', label: 'Open', is_closed: false },
      closed: { value: 'closed', label: 'Afgesloten', is_closed: true },
    })[v ?? ''],
  }),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// DD-FE-6 ("no empty tabs"): the Koppelingen tab now only lists when a connector
// app is enabled (useBackofficeLinksVisible reads this). Default to "hf" enabled
// so the tab bar keeps proving the SHOWN case here; the dedicated describe block in
// MatchDrawer.test.tsx overrides this to prove the hidden case.
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'hf' }) })
// goedkeuring-badge-eerlijk (08-08): default the tenant approval mode to a "real"
// one (not 'off') so every test in this file keeps proving its own thing undisturbed; the dedicated
// describe block in MatchDrawer.test.tsx overrides this to prove the honesty gate.
const mockUseMatchApprovalMode = vi.fn()
vi.mock('./hooks/useMatchApprovalMode', () => ({ useMatchApprovalMode: () => mockUseMatchApprovalMode() }))
beforeEach(() => { mockUseMatchApprovalMode.mockReturnValue({ approvalMode: 'always' }) })

// The owner picker's option source (MATCH-OWNER-1) — stubbed so no QueryClient is needed.
vi.mock('@/lib/queries', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/queries')>()),
  useUsers: () => ({ data: [
    { id: 'u-1', name: 'Nina Bakker', avatar_color: COLOR_A },
    { id: 'u-7', name: 'Piet de Vries', avatar_color: COLOR_B },
  ] }),
}))
// Every other tab body pulls in its own API/react-query dependencies, irrelevant
// to this tab-bar guard — stub them (mirrors VacancyDrawer.test.tsx).
vi.mock('./drawer/OverviewTab', () => ({ default: () => null }))
vi.mock('./drawer/StatisticsTab', () => ({ default: () => null }))
vi.mock('./drawer/MatchContractSection', () => ({ default: () => null }))
vi.mock('./drawer/ChangelogTab', () => ({ default: () => null }))
vi.mock('./drawer/NotesTab', () => ({ default: () => null }))
// TerminateMatchModal has its own test suite (TerminateMatchModal.test.tsx) — here
// we only prove MatchDrawer opens it (with the right match) on the header button click.
const mockTerminateMatchModal = vi.fn()
vi.mock('./drawer/TerminateMatchModal', () => ({
  default: (props: Record<string, unknown>) => { mockTerminateMatchModal(props); return <div>terminate-modal-content</div> },
}))

// G04/MATCH-RENEWAL-1: RenewMatchModal has its own test suite (RenewMatchModal.test.tsx) —
// here we only prove MatchDrawer opens it (with the right match) on the header button click.
const mockRenewMatchModal = vi.fn()
vi.mock('./drawer/RenewMatchModal', () => ({
  default: (props: Record<string, unknown>) => { mockRenewMatchModal(props); return <div>renew-modal-content</div> },
}))

/**
 * MATCH-TERMINATE-1: the "Beëindigen" header action opens TerminateMatchModal
 * (its own POST/body/422 behaviour is covered in TerminateMatchModal.test.tsx —
 * this file only proves the wiring: visibility gate + open-on-click).
 */
describe('MatchDrawer · terminate action (MATCH-TERMINATE-1)', () => {
  it('shows the Beëindigen button for an open, non-archived match and opens the modal on click', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} onUpdate={vi.fn()} canTerminate />)
    const terminateLabel = i18n.t('matches:drawer.terminate.button')
    const btn = screen.getByRole('button', { name: terminateLabel })
    await user.click(btn)
    expect(mockTerminateMatchModal).toHaveBeenCalledWith(expect.objectContaining({ match }))
  })

  // §7: the terminate action is permission-gated like every sibling header action —
  // without the caller's matches.update the button must not render at all.
  it('hides the button without the canTerminate permission (the default)', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    const terminateLabel = i18n.t('matches:drawer.terminate.button')
    expect(screen.queryByRole('button', { name: terminateLabel })).not.toBeInTheDocument()
  })

  it('hides the button once the match status carries the is_closed flag', () => {
    render(<MatchDrawer match={{ ...match, status: 'closed' }} onClose={vi.fn()} canTerminate />)
    const terminateLabel = i18n.t('matches:drawer.terminate.button')
    expect(screen.queryByRole('button', { name: terminateLabel })).not.toBeInTheDocument()
  })

  it('hides the button on an archived match — restore first, mirrors every other header action', () => {
    render(<MatchDrawer match={{ ...match, archived: true }} onClose={vi.fn()} canTerminate />)
    const terminateLabel = i18n.t('matches:drawer.terminate.button')
    expect(screen.queryByRole('button', { name: terminateLabel })).not.toBeInTheDocument()
  })
})

/**
 * G04/MATCH-RENEWAL-1: the "Verlengen" header action opens RenewMatchModal (its
 * own POST/body/422 behaviour is covered in RenewMatchModal.test.tsx — this file
 * only proves the wiring: visibility gate + open-on-click + the honest
 * disabled-with-a-reason state, which deliberately differs from terminate's
 * hide-outright once the match is closed/archived).
 */
describe('MatchDrawer · renew action (G04/MATCH-RENEWAL-1)', () => {
  it('shows an enabled Verlengen button for an open, non-archived match and opens the modal on click', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} onUpdate={vi.fn()} canRenew />)
    const renewLabel = i18n.t('matches:drawer.renew.button')
    const btn = screen.getByRole('button', { name: renewLabel })
    expect(btn).not.toBeDisabled()
    await user.click(btn)
    expect(mockRenewMatchModal).toHaveBeenCalledWith(expect.objectContaining({ match }))
  })

  // §7: the renew action is permission-gated like terminate — without the
  // caller's matches.update the button must not render at all.
  it('hides the button without the canRenew permission (the default)', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    const renewLabel = i18n.t('matches:drawer.renew.button')
    expect(screen.queryByRole('button', { name: renewLabel })).not.toBeInTheDocument()
  })

  it('disables the button with an honest reason once the match status carries the is_closed flag', async () => {
    const user = userEvent.setup()
    // Isolate this test's spy assertion from any earlier test's calls in this file
    // (this suite has no global clearMocks — mirrors the isolation the other
    // describe blocks get "for free" by never asserting on call history).
    mockRenewMatchModal.mockClear()
    render(<MatchDrawer match={{ ...match, status: 'closed' }} onClose={vi.fn()} canRenew />)
    const disabledReason = i18n.t('matches:drawer.renew.disabledClosed')
    const btn = screen.getByRole('button', { name: disabledReason })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', disabledReason)
    // A click on a disabled/no-op button must never open the modal (no fake affordance).
    await user.click(btn)
    expect(mockRenewMatchModal).not.toHaveBeenCalled()
  })

  it('disables the button with an honest reason on an archived match — restore first', () => {
    render(<MatchDrawer match={{ ...match, archived: true }} onClose={vi.fn()} canRenew />)
    const disabledReason = i18n.t('matches:drawer.renew.disabledArchived')
    const btn = screen.getByRole('button', { name: disabledReason })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', disabledReason)
  })
})

// TRASH-OVERAL-2: the two-step trash lifecycle in the drawer — an ARCHIVED match
// offers "Definitief verwijderen" (matches.delete-gated at the page: prop absent =
// button HIDDEN), a TRASHED match swaps the archived banner for the pending-erase
// banner with the DD-MM-YYYY note + the unmark action (matches.update-gated).
describe('MatchDrawer · trash lifecycle (TRASH-OVERAL-2)', () => {
  const markLabel = i18n.t('trash.markAction', { ns: 'common' })
  const unmarkLabel = i18n.t('trash.unmarkAction', { ns: 'common' })

  it('shows the mark-deletion action on an archived match and hands back the id', async () => {
    const user = userEvent.setup()
    const onMarkDeletion = vi.fn()
    render(<MatchDrawer match={{ ...match, archived: true }} onClose={vi.fn()} onMarkDeletion={onMarkDeletion} />)
    await user.click(screen.getByRole('button', { name: markLabel }))
    expect(onMarkDeletion).toHaveBeenCalledWith('m1')
  })

  it('hides the mark-deletion action without the permission (prop absent) and on a live match', () => {
    const { rerender } = render(<MatchDrawer match={{ ...match, archived: true }} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: markLabel })).not.toBeInTheDocument()
    rerender(<MatchDrawer match={match} onClose={vi.fn()} onMarkDeletion={vi.fn()} />)
    expect(screen.queryByRole('button', { name: markLabel })).not.toBeInTheDocument()
  })

  it('a trashed match shows the pending-erase note (DD-MM-YYYY) and the unmark action', async () => {
    const user = userEvent.setup()
    const onUnmark = vi.fn()
    render(<MatchDrawer
      match={{ ...match, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-08-10T12:00:00Z' }}
      onClose={vi.fn()} onUnmark={onUnmark} onMarkDeletion={vi.fn()} graceWindow={{ amount: 30, unit: 'days' }} />)
    // House date format, never ISO/slash-locale (DATUM-1).
    expect(screen.getByText(new RegExp(i18n.t('trash.pendingSince', { ns: 'common', date: '10-08-2026' })))).toBeInTheDocument()
    // In the trash the mark action is gone; unmark takes over.
    expect(screen.queryByRole('button', { name: markLabel })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: unmarkLabel }))
    expect(onUnmark).toHaveBeenCalledWith('m1')
  })

  it('ONIX N-007: disables the unmark button while unmarkBusy, enabled otherwise', () => {
    render(<MatchDrawer
      match={{ ...match, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-08-10T12:00:00Z' }}
      onClose={vi.fn()} onUnmark={vi.fn()} unmarkBusy />)
    expect(screen.getByRole('button', { name: unmarkLabel })).toBeDisabled()
  })

  it('ONIX N-007: the unmark button stays enabled without unmarkBusy', () => {
    render(<MatchDrawer
      match={{ ...match, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-08-10T12:00:00Z' }}
      onClose={vi.fn()} onUnmark={vi.fn()} />)
    expect(screen.getByRole('button', { name: unmarkLabel })).toBeEnabled()
  })

  it('hides the unmark action without the permission (prop absent)', () => {
    render(<MatchDrawer
      match={{ ...match, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-08-10T12:00:00Z' }}
      onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: unmarkLabel })).not.toBeInTheDocument()
  })
})

// S004: a months window reaches buildTrashNote as a unit (31-01 + 1 month = 28-02), not a derived day count.
describe('MatchDrawer · months grace window (S004)', () => {
  it('renders the exact month-end erase date for a one-month window', () => {
    render(<MatchDrawer
      match={{ ...match, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-01-31T12:00:00Z' }}
      onClose={vi.fn()} onUnmark={vi.fn()} graceWindow={{ amount: 1, unit: 'months' }} />)
    expect(screen.getByText(/28-02-2026/)).toBeInTheDocument()
    expect(screen.queryByText(/0[23]-03-2026/)).not.toBeInTheDocument()
  })
})
