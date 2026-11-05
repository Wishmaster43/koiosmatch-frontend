/**
 * MatchDrawer — Koppelingen tab regression guard (EXTRACT-1): the shared
 * BackofficeLinksTab is wired in as the LAST tab, with the entity/id/canLink
 * props MatchDrawer derives from its own props (mirrors VacancyDrawer.test.tsx —
 * every other tab body is stubbed so only the header + tab bar + the tab under
 * test actually mount).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) instance so the tab labels resolve genuine Dutch text — kept as
// a binding (not just the old side-effect import) so new-key assertions below can
// read the SAME resolved string the component itself renders (see the NT-MATCH-1 block
// below; MATCH-TERMINATE-1 lives in MatchDrawer.actions.test.tsx): stable whether or not
// the reported nl copy for those new keys has landed in matches.json yet.
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
// so the pre-existing tab-bar assertions below keep proving the SHOWN case; the
// dedicated describe block further down overrides this to prove the hidden case.
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'hf' }) })
// goedkeuring-badge-eerlijk (08-08): default the tenant approval mode to a "real"
// one (not 'off') so every pre-existing test below — including the DD-FE-5/M2 badge
// test on an 'approved' fixture — keeps proving its own thing undisturbed; the
// dedicated describe block further down overrides this to prove the honesty gate.
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
// The shared component itself has its own test suite (BackofficeLinksTab.test.tsx);
// here we only prove MatchDrawer wires it in with the right props.
const mockBackofficeLinksTab = vi.fn()
vi.mock('@/components/drawer/BackofficeLinksTab', () => ({
  default: (props: Record<string, unknown>) => { mockBackofficeLinksTab(props); return <div>backoffice-links-content</div> },
}))

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

// X-3: the AI-sessies tab needs the koios_ai module AND both matches.view + applications.view.
describe('MatchDrawer · AI-sessies tab gate (X-3)', () => {
  const tabName = i18n.t('matches:drawer.tabs.agentSessions')
  const auth = (module: boolean, perms: string[]) => ({
    hasModule: (m: string) => module && m === 'koios_ai',
    hasPermission: (p: string) => perms.includes(p),
  })
  afterEach(() => { mockUseAuth.mockReset(); mockUseAuth.mockImplementation(() => null) })

  it('renders the tab with the module and both permissions', () => {
    mockUseAuth.mockReturnValue(auth(true, ['matches.view', 'applications.view']))
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    expect(screen.getByRole('tab', { name: tabName })).toBeInTheDocument()
  })

  it('hides the tab without the module, and without applications.view', () => {
    mockUseAuth.mockReturnValue(auth(false, ['matches.view', 'applications.view']))
    const { unmount } = render(<MatchDrawer match={match} onClose={vi.fn()} />)
    expect(screen.queryByRole('tab', { name: tabName })).toBeNull()
    unmount()
    mockUseAuth.mockReturnValue(auth(true, ['matches.view']))
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    expect(screen.queryByRole('tab', { name: tabName })).toBeNull()
  })
})
