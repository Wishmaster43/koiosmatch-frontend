/**
 * OutreachDrawer — the enkelstuks-sweep archived state: an archived bellijst shows
 * the shared ArchivedBanner (flag-only, or "Archived on {date}" once archivedAt is
 * set — W2 delivered, measured: OutreachCampaignResource carries deleted_at) with a
 * working per-id restore. W2 also delivered show() as withTrashed, so the drawer now
 * FETCHES the real detail even while archived (only the owner picker stays hidden —
 * update() is still a plain findOrFail and it's a deliberate product choice either
 * way). (The live seed has no archived campaigns, so this wiring is verified here.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text.
import '@/i18n'
import nlCommon from '@/i18n/locales/nl/common.json'
import nlOutreach from '@/i18n/locales/nl/outreach.json'

// Read the label from the locale file itself — the tab used to render an English
// defaultValue ("Stats") and now resolves the real key, so hardcoding either one
// makes this test a hostage of translation work.
import OutreachDrawer from './OutreachDrawer'
import { useCampaignAdvice } from '@/lib/useCampaignAdvice'
import type { Campaign } from './hooks/useOutreachCampaigns'

const statsTabLabel = (nlOutreach as { drawer: { tabs: { stats: string } } }).drawer.tabs.stats

// The detail hook is the drawer's only data source — stub it and observe the id it gets.
// `detailReturn` is a per-test mutable override so individual tests can supply a real
// detail payload (e.g. reference_number) instead of the default null/loading stub.
const { detailMock, detailReturn } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  detailReturn: { current: null as Record<string, unknown> | null },
}))
vi.mock('./hooks/useOutreachDetail', () => ({
  useOutreachDetail: (id: string | null) => {
    detailMock(id)
    return {
      detail: detailReturn.current, loading: false, error: false,
      setTargetStatus: vi.fn(), setTargetOutcome: vi.fn(), setOwner: vi.fn(), setCustomFields: vi.fn(),
      // G29/G30: real functions so the prop-wiring test can assert their type.
      setTargetNote: vi.fn(), assignTargets: vi.fn(),
    }
  },
}))
// The targets tab has its own data needs — out of scope for most drawer wiring
// tests, but its PROPS are captured so the G29/G30/G31 wiring test (below) can
// assert the drawer actually passes them through, not only that it compiles.
const { targetsTabProps } = vi.hoisted(() => ({ targetsTabProps: { current: null as Record<string, unknown> | null } }))
vi.mock('./drawer/TargetsTab', () => ({ default: (props: Record<string, unknown>) => { targetsTabProps.current = props; return null } }))
// The Stats tab (G31) likewise captures its props (filter/onPick/onClear) so the
// Stats-tab -> Targets-tab filter wiring can be asserted end-to-end.
const { statsTabProps } = vi.hoisted(() => ({ statsTabProps: { current: null as Record<string, unknown> | null } }))
vi.mock('./drawer/CampaignStatsTab', () => ({ default: (props: Record<string, unknown>) => { statsTabProps.current = props; return <div data-testid="stats-body" /> } }))
// The changelog CONTENT has its own test (drawer/ChangelogTab.test.tsx); here we only
// assert the drawer wires the shared popover shell into the title row.
vi.mock('./drawer/ChangelogTab', () => ({ default: () => <div data-testid="changelog-body" /> }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'r1', name: 'Nora Recruiter' }] }) }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))

describe('OutreachDrawer — archived state', () => {
  it('still fetches the real detail (W2: show() is withTrashed), shows the flag-only banner, and fires the per-id restore', () => {
    const onRestore = vi.fn()
    render(<OutreachDrawer id="c1" archived fallbackName="Bellijst Zorg" fallbackStatus="active"
      onRestore={onRestore} onClose={() => {}} />)
    // Archived no longer skips the fetch — the hook still gets the real id.
    expect(detailMock).toHaveBeenLastCalledWith('c1')
    // The stubbed hook returns detail: null, so the fallback name still stands in
    // while loading.
    expect(screen.getByText('Bellijst Zorg')).toBeInTheDocument()
    // No archivedAt passed → flag-only banner; the owner picker stays hidden.
    expect(screen.getByText('Gearchiveerd')).toBeInTheDocument()
    expect(screen.queryByText('Eigenaar')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Herstellen' }))
    expect(onRestore).toHaveBeenCalledWith('c1')
  })

  // W2 delivered (measured): OutreachCampaignResource now carries deleted_at — the
  // banner upgrades from the flag-only line to the dated one once it's on the record.
  it('shows the dated banner once archivedAt is set', () => {
    render(<OutreachDrawer id="c1" archived archivedAt="2026-07-10T10:00:00" fallbackName="Bellijst Zorg"
      onClose={() => {}} />)
    expect(screen.getByText('Gearchiveerd op 10-07-2026')).toBeInTheDocument()
  })

  it('fetches + shows the owner picker and no banner for an active campaign', () => {
    render(<OutreachDrawer id="c2" onClose={() => {}} />)
    expect(detailMock).toHaveBeenLastCalledWith('c2')
    expect(screen.queryByText('Gearchiveerd')).toBeNull()
    expect(screen.getByText('Eigenaar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Herstellen' })).toBeNull()
  })
})

// NUMMER-3: OutreachCampaignResource now sends reference_number on every row
// (measured) — the title row shows it as a copy chip, right before the status
// badge (§3A). Overrides the module-level stub with a per-test detail payload.
describe('OutreachDrawer — reference number chip', () => {
  afterEach(() => { detailReturn.current = null })

  it('shows the copy chip when reference_number is present', () => {
    detailReturn.current = { id: 'c3', name: 'Bellijst Zorg', reference_number: 'B-9' }
    render(<OutreachDrawer id="c3" onClose={() => {}} />)
    expect(screen.getByText('B-9')).toBeInTheDocument()
  })

  it('renders nothing when reference_number is absent', () => {
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    expect(screen.queryByText(/^B-/)).toBeNull()
  })
})

// CMFE 20: bellijsten were the LAST entity without a change log. GET
// /outreach-campaigns/{id}/activity is live (measured in
// routes/api/tenant/tasks-outreach.php), so the drawer now carries the house
// affordance: a changelog ICON in the title row opening the shared popover — never a
// tab (§3A(d)). Regression guard for the stale "no activity route yet" gate.
describe('OutreachDrawer — changelog icon (§3A(d))', () => {
  const openChangelog = () => fireEvent.click(screen.getByRole('button', { name: nlCommon.changelog }))

  it('puts the changelog icon in the title row and opens the shared popover, never a tab', () => {
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    // Icon present, popover closed until clicked (content mounts = fetches on open).
    const icon = screen.getByRole('button', { name: nlCommon.changelog })
    expect(icon).toHaveAttribute('aria-haspopup', 'dialog')
    expect(icon).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('changelog-body')).toBeNull()
    // It is NOT a tab: the tab bar holds only the call list (no custom fields defined).
    expect(screen.queryByRole('tab', { name: nlOutreach.changelog.empty })).toBeNull()
    expect(screen.queryByText(nlCommon.changelog, { selector: 'button[role="tab"]' })).toBeNull()

    openChangelog()
    expect(screen.getByRole('dialog', { name: nlCommon.changelog })).toBeInTheDocument()
    expect(screen.getByTestId('changelog-body')).toBeInTheDocument()
  })

  it('keeps the changelog reachable on an archived bellijst (activityLog is withTrashed)', () => {
    render(<OutreachDrawer id="c1" archived fallbackName="Bellijst Zorg" onClose={() => {}} />)
    openChangelog()
    expect(screen.getByTestId('changelog-body')).toBeInTheDocument()
  })
})

// G29/G30/G31: the drawer wires assignTargets/setTargetNote into the Targets
// tab, adds a Stats tab, and shares ONE filter axis between the two tabs — a
// donut pick on Stats must actually narrow the Targets tab's list, not just
// look like it does (§3A "a click genuinely does something").
describe('OutreachDrawer — G29/G30/G31 wiring (assign, note, stats filter)', () => {
  afterEach(() => { targetsTabProps.current = null; statsTabProps.current = null })

  it('passes the assign/note mutations and recruiter options through to the Targets tab', () => {
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    expect(targetsTabProps.current?.onAssignTargets).toBeTypeOf('function')
    expect(targetsTabProps.current?.onSetNote).toBeTypeOf('function')
    expect(targetsTabProps.current?.recruiters).toEqual([{ value: 'r1', label: 'Nora Recruiter' }])
    // No filter set yet — both tabs start in the "show everything" state.
    expect(targetsTabProps.current?.filter).toBeNull()
  })

  it('renders a Stats tab next to the call list', () => {
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    expect(screen.getByRole('tab', { name: statsTabLabel })).toBeInTheDocument()
  })

  it('a Stats-tab donut pick sets the SAME filter the Targets tab reads', () => {
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: statsTabLabel }))
    expect(statsTabProps.current?.filter).toBeNull()

    // Simulate the donut click via the captured onPick prop (the donut/recharts
    // click plumbing itself is CampaignStatsTab's own concern/test).
    act(() => { (statsTabProps.current?.onPick as (axis: string, value: string) => void)('status', 'contacted') })

    // Switch back to the call list — it now receives the SAME filter value.
    fireEvent.click(screen.getByRole('tab', { name: nlOutreach.drawer.tabs.targets }))
    expect(targetsTabProps.current?.filter).toEqual({ axis: 'status', value: 'contacted' })
  })

  it('clicking the same segment again clears the filter (toggle, mirrors the page-level insights row)', () => {
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: statsTabLabel }))
    act(() => { (statsTabProps.current?.onPick as (axis: string, value: string) => void)('status', 'contacted') })
    act(() => { (statsTabProps.current?.onPick as (axis: string, value: string) => void)('status', 'contacted') })
    expect(statsTabProps.current?.filter).toBeNull()
  })

  it('resets the filter when the drawer switches to a different campaign', () => {
    const { rerender } = render(<OutreachDrawer id="c1" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: statsTabLabel }))
    act(() => { (statsTabProps.current?.onPick as (axis: string, value: string) => void)('status', 'contacted') })
    expect(statsTabProps.current?.filter).toEqual({ axis: 'status', value: 'contacted' })

    // A new entity id resets EntityDrawer's own activeTab to the first tab
    // (Targets) too — read the filter back through that tab, which is the one
    // still mounted on this render pass.
    rerender(<OutreachDrawer id="c2" onClose={() => {}} />)
    expect(targetsTabProps.current?.filter).toBeNull()
  })
})

// KOIOS-ADVIES-OVERAL-1: the drawer shows EXACTLY the advice the bellijsten
// table's Koios column derives — asserted through the SAME resolver
// (useCampaignAdvice), never a copied literal. Without advice the section stays
// unmounted entirely (no empty shell above the call list).
describe('OutreachDrawer — table-identical Koios advice (KOIOS-ADVIES-OVERAL-1)', () => {
  const aiTitle = (nlCommon as { ai: { title: string } }).ai.title
  afterEach(() => { detailReturn.current = null })

  // Resolve the advice through the shared hook, exactly as OutreachList does.
  const resolveVia = (c: Campaign) => renderHook(() => useCampaignAdvice()).result.current(c)

  it('shows the block with the same label the table pill derives for an active list without targets', () => {
    const campaign: Campaign = { id: 'c1', name: 'Bellijst Zorg', status: 'active', targets_count: 0 }
    detailReturn.current = { ...campaign, targets: [] }
    const expected = resolveVia(campaign)?.label
    expect(expected).toBeTruthy()
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    expect(screen.getByText(aiTitle)).toBeInTheDocument()
    expect(screen.getByText(expected as string)).toBeInTheDocument()
  })

  it('renders NO advice block on a clean campaign (resolver returns null)', () => {
    const campaign: Campaign = { id: 'c1', name: 'Bellijst Zorg', status: 'done', targets_count: 0 }
    expect(resolveVia(campaign)).toBeNull()
    detailReturn.current = { ...campaign, targets: [] }
    render(<OutreachDrawer id="c1" onClose={() => {}} />)
    expect(screen.queryByText(aiTitle)).not.toBeInTheDocument()
  })
})
