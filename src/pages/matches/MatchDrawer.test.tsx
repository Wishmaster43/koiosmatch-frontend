/**
 * MatchDrawer — Koppelingen tab regression guard (EXTRACT-1): the shared
 * BackofficeLinksTab is wired in as the LAST tab, with the entity/id/canLink
 * props MatchDrawer derives from its own props (mirrors VacancyDrawer.test.tsx —
 * every other tab body is stubbed so only the header + tab bar + the tab under
 * test actually mount).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) instance so the tab labels resolve genuine Dutch text — kept as
// a binding (not just the old side-effect import) so new-key assertions below can
// read the SAME resolved string the component itself renders (see MATCH-TERMINATE-1/
// NT-MATCH-1 blocks at the bottom): stable whether or not the reported nl copy for
// those new keys has landed in matches.json yet.
import i18n from '@/i18n'
import MatchDrawer from './MatchDrawer'
import type { MatchRow } from '@/types/match'

// MATCH-TERMINATE-1: metaOf's is_closed flag now drives the header's terminate
// button gate — the mock must return a working metaOf, not just a bare list.
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
// so the pre-existing tab-bar assertions below keep proving the SHOWN case; the
// dedicated describe block near the bottom overrides this to prove the hidden case.
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'hf' }) })
// goedkeuring-badge-eerlijk (08-08): default the tenant approval mode to a "real"
// one (not 'off') so every pre-existing test below — including the DD-FE-5/M2 badge
// test on an 'approved' fixture — keeps proving its own thing undisturbed; the
// dedicated describe block near the bottom overrides this to prove the honesty gate.
const mockUseMatchApprovalMode = vi.fn()
vi.mock('./hooks/useMatchApprovalMode', () => ({ useMatchApprovalMode: () => mockUseMatchApprovalMode() }))
beforeEach(() => { mockUseMatchApprovalMode.mockReturnValue({ approvalMode: 'always' }) })
// avatar_color values off the /users payload — DATA fixtures, not UI styling.
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
const COLOR_A = '#abcdef'
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
const COLOR_B = '#123456'

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

// The shared component itself has its own test suite (BackofficeLinksTab.test.tsx);
// here we only prove MatchDrawer wires it in with the right props.
const mockBackofficeLinksTab = vi.fn()
vi.mock('@/components/drawer/BackofficeLinksTab', () => ({
  default: (props: Record<string, unknown>) => { mockBackofficeLinksTab(props); return <div>backoffice-links-content</div> },
}))

const match = {
  id: 'm1', referenceNumber: 'M-00001', candidate: 'Jan Jansen', initials: 'JJ',
  vacancy: 'Verpleegkundige', client: 'Acme', candidateId: null, vacancyId: null, clientId: null,
  score: null, stage: '', status: 'open', stageColor: '', owner: '', ownerInitials: '', ownerColor: null,
  date: '', approval_status: 'approved', archived: false,
  helloflexLink: null, shiftmanagerLink: { status: 'linked', externalId: 'HF-9', lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null },
} as unknown as MatchRow

describe('MatchDrawer · Koppelingen tab (EXTRACT-1)', () => {
  // M9 (overzicht-layout): Relaties folded into Overzicht and removed — one fewer tab.
  it('renders "Koppelingen" as the LAST tab, after Overzicht/Contract & financieel', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    const tabLabels = ['Overzicht', 'Contract & financieel', 'Koppelingen']
    const tabButtons = screen.getAllByRole('tab').filter(b => tabLabels.includes(b.textContent ?? ''))
    expect(tabButtons.map(b => b.textContent)).toEqual(tabLabels)
  })

  it('shows the shared BackofficeLinksTab content when the Koppelingen tab is clicked, with the right entity/id/canLink props', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} canLinkBackoffice />)
    await user.click(screen.getByRole('tab', { name: 'Koppelingen' }))
    expect(screen.getByText('backoffice-links-content')).toBeInTheDocument()
    expect(mockBackofficeLinksTab).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'matches', id: 'm1', canLink: true,
      helloflexLink: null, shiftmanagerLink: match.shiftmanagerLink,
    }))
  })

  it('defaults canLink to false when the caller omits canLinkBackoffice (no matches.update permission)', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Koppelingen' }))
    expect(mockBackofficeLinksTab).toHaveBeenCalledWith(expect.objectContaining({ canLink: false }))
  })
})

// DD-FE-6 ("no empty tabs" — 08-08): the match drawer passes no extra children
// into BackofficeLinksTab, so with BOTH connector apps off its body would render
// nothing (no card, no "Koppelen" button) — the tab must not even be listed.
describe('MatchDrawer · Koppelingen tab hidden when empty (DD-FE-6)', () => {
  it('drops the Koppelingen tab when neither HelloFlex nor Shiftmanager is enabled', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => false })
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    expect(screen.queryByRole('tab', { name: 'Koppelingen' })).not.toBeInTheDocument()
  })

  it('still lists Koppelingen when only Shiftmanager is enabled', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'shiftmanager' })
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Koppelingen' })).toBeInTheDocument()
  })
})

/**
 * DD-FE-5/M2 (08-08, DRILL-DOWN-CONSISTENCY): the header's approval badge used to
 * read as a bare status word ("Goedgekeurd") right beside the separate operational
 * Status picker ("Open") — two different axes reading as one contradictory pair.
 * The badge now names its own axis.
 */
describe('MatchDrawer · approval badge names its own axis (DD-FE-5/M2)', () => {
  it('prefixes the approval badge so it never reads as the same field as Status', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} onSetStatus={vi.fn()} />)
    // The fixture match carries approval_status: 'approved' and status: 'open'.
    const badgeLabel = i18n.t('matches:approval.badgeWithLabel', {
      label: i18n.t('matches:approval.badgeLabel'), status: i18n.t('matches:approval.status.approved'),
    })
    expect(screen.getByText(badgeLabel)).toBeInTheDocument()
    // The bare, unprefixed approval word must not appear on its own anymore.
    expect(screen.queryByText(i18n.t('matches:approval.status.approved'))).not.toBeInTheDocument()
    // The operational Status picker still reads its own, unrelated value ("Open").
    expect(screen.getByText('Open')).toBeInTheDocument()
  })
})

/**
 * goedkeuring-badge-eerlijk (08-08): Danny saw "Beoordeling: Goedgekeurd" and asked
 * where it comes from — with the tenant's approval_mode setting OFF, a new match
 * always defaults to 'approved' and nothing can ever move it off that value, so the
 * badge carried no information. MatchApprovalBadge's own gating logic is covered in
 * MatchApprovalBadge.test.tsx — this file only proves MatchDrawer reads
 * useMatchApprovalMode and actually feeds it through to the badge.
 */
describe('MatchDrawer · approval badge honesty gate (goedkeuring-badge-eerlijk)', () => {
  const approvedBadgeText = () => i18n.t('matches:approval.badgeWithLabel', {
    label: i18n.t('matches:approval.badgeLabel'), status: i18n.t('matches:approval.status.approved'),
  })
  const rejectedBadgeText = () => i18n.t('matches:approval.badgeWithLabel', {
    label: i18n.t('matches:approval.badgeLabel'), status: i18n.t('matches:approval.status.rejected'),
  })

  it('hides the badge on an approved match when approval_mode is off (uit)', () => {
    mockUseMatchApprovalMode.mockReturnValue({ approvalMode: 'off' })
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    expect(screen.queryByText(approvedBadgeText())).not.toBeInTheDocument()
  })

  it('still shows a genuine rejection even when approval_mode is off — never hide a real rejection', () => {
    mockUseMatchApprovalMode.mockReturnValue({ approvalMode: 'off' })
    render(<MatchDrawer match={{ ...match, approval_status: 'rejected' }} onClose={vi.fn()} />)
    expect(screen.getByText(rejectedBadgeText())).toBeInTheDocument()
  })

  it('shows the badge on an approved match once approval_mode is genuinely on (altijd)', () => {
    mockUseMatchApprovalMode.mockReturnValue({ approvalMode: 'always' })
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    expect(screen.getByText(approvedBadgeText())).toBeInTheDocument()
  })
})

/**
 * MATCH-OWNER-1: the header owner used to be a dead <div> that LOOKED like a
 * control (metaExtra) while PATCH /matches/{id} has accepted owner_id all along.
 * These guard the two halves: a real picker when a handler is wired, and an
 * honest read-only value — never a no-op picker — when it is not.
 */
// Owner name deliberately differs from the fixture's candidate name — SelectMenu's
// trigger concatenates the avatar initials into its accessible name ("NBNina Bakker"),
// so the queries below match on the name fragment.
const owned = (over: Partial<MatchRow> = {}) =>
  ({ ...match, owner: 'Nina Bakker', ownerId: 'u-1', ownerInitials: 'NB', ownerColor: COLOR_A, ...over }) as unknown as MatchRow

describe('MatchDrawer · owner picker (MATCH-OWNER-1)', () => {
  it('reassigns via a real picker, handing the caller the whole picked user', async () => {
    const user = userEvent.setup()
    const onSetOwner = vi.fn()
    render(<MatchDrawer match={owned()} onClose={vi.fn()} onSetOwner={onSetOwner} />)

    // The trigger shows the CURRENT owner — proof it preselects on ownerId, not on name.
    await user.click(screen.getByRole('button', { name: /Nina Bakker/ }))
    await user.click(screen.getByRole('button', { name: /Piet de Vries/ }))
    // The page forwards this object straight into the owner_id PATCH + optimistic write.
    expect(onSetOwner).toHaveBeenCalledWith({ id: 'u-7', name: 'Piet de Vries', avatar_color: COLOR_B })
  })

  it('shows the placeholder, not a blank box, on an ownerless match', () => {
    render(<MatchDrawer match={owned({ owner: '', ownerId: null, ownerInitials: '' })} onClose={vi.fn()} onSetOwner={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Geen eigenaar/ })).toBeInTheDocument()
  })

  it('keeps an owner who is no longer in /users visible, and picking that entry is a no-op', async () => {
    const user = userEvent.setup()
    const onSetOwner = vi.fn()
    render(<MatchDrawer match={owned({ owner: 'Ex Medewerker', ownerId: 'u-gone', ownerInitials: 'EM' })} onClose={vi.fn()} onSetOwner={onSetOwner} />)

    await user.click(screen.getByRole('button', { name: /Ex Medewerker/ }))
    // The synthetic fallback entry is a label, not a target: selecting it must not PATCH.
    await user.click(screen.getAllByRole('button', { name: /Ex Medewerker/ })[1])
    expect(onSetOwner).not.toHaveBeenCalled()
  })

  it('renders the owner READ-ONLY (no picker) when no handler is wired — no fake affordance', () => {
    render(<MatchDrawer match={owned()} onClose={vi.fn()} />)
    expect(screen.getByText('Nina Bakker')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nina Bakker/ })).not.toBeInTheDocument()
  })

  it('renders the owner READ-ONLY on an archived match — restore first (mirrors the status picker)', () => {
    render(<MatchDrawer match={owned({ archived: true })} onClose={vi.fn()} onSetOwner={vi.fn()} />)
    expect(screen.getByText('Nina Bakker')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nina Bakker/ })).not.toBeInTheDocument()
  })
})

/**
 * MOVED-FROM-OVERVIEW-1 (Danny 22-08): the new Statistieken tab sits right
 * after Overzicht (the ordinal footnote it replaces used to live there) and
 * before Contract & financieel.
 */
describe('MatchDrawer · Statistieken tab (MOVED-FROM-OVERVIEW-1)', () => {
  // Danny 24-08: Statistieken is the LAST tab, app-wide (supersedes the
  // 22-08 after-Overzicht placement).
  it('lists Statistieken as the very last tab', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} allRows={[match]} />)
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    const statsLabel = i18n.t('matches:drawer.tabs.statistics')
    expect(labels.indexOf(statsLabel)).toBe(labels.length - 1)
  })
})

/**
 * NT-MATCH-1: the Notities tab is wired in after the content tabs (Overzicht/
 * Contract & financieel — M9: Relaties folded into Overzicht and removed) and
 * before Extra/Koppelingen — never a Changelog TAB (record history stays the
 * icon-popover, §3A(d)).
 */
describe('MatchDrawer · Notities tab (NT-MATCH-1)', () => {
  it('renders "Notities" after Contract & financieel and before Koppelingen', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    // Read the SAME i18n instance the component renders through — correct whether
    // the reported nl copy for this key has landed in matches.json yet or not.
    const notesLabel = i18n.t('matches:notes.title')
    const labels = screen.getAllByRole('tab').map(b => b.textContent)
    const contractIdx = labels.indexOf('Contract & financieel')
    const koppIdx = labels.indexOf('Koppelingen')
    const notesIdx = labels.indexOf(notesLabel)
    expect(contractIdx).toBeGreaterThan(-1)
    expect(koppIdx).toBeGreaterThan(-1)
    expect(notesIdx).toBeGreaterThan(contractIdx)
    expect(notesIdx).toBeLessThan(koppIdx)
  })
})

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
      onClose={vi.fn()} onUnmark={onUnmark} onMarkDeletion={vi.fn()} graceDays={30} />)
    // House date format, never ISO/slash-locale (DATUM-1).
    expect(screen.getByText(new RegExp(i18n.t('trash.pendingSince', { ns: 'common', date: '10-08-2026' })))).toBeInTheDocument()
    // In the trash the mark action is gone; unmark takes over.
    expect(screen.queryByRole('button', { name: markLabel })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: unmarkLabel }))
    expect(onUnmark).toHaveBeenCalledWith('m1')
  })

  it('hides the unmark action without the permission (prop absent)', () => {
    render(<MatchDrawer
      match={{ ...match, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-08-10T12:00:00Z' }}
      onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: unmarkLabel })).not.toBeInTheDocument()
  })
})
