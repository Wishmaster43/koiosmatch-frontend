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
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text.
import '@/i18n'
import nlCommon from '@/i18n/locales/nl/common.json'
import nlOutreach from '@/i18n/locales/nl/outreach.json'
import OutreachDrawer from './OutreachDrawer'

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
    return { detail: detailReturn.current, loading: false, error: false, setTargetStatus: vi.fn(), setTargetOutcome: vi.fn(), setOwner: vi.fn(), setCustomFields: vi.fn() }
  },
}))
// The targets tab has its own data needs — out of scope for the drawer wiring test.
vi.mock('./drawer/TargetsTab', () => ({ default: () => null }))
// The changelog CONTENT has its own test (drawer/ChangelogTab.test.tsx); here we only
// assert the drawer wires the shared popover shell into the title row.
vi.mock('./drawer/ChangelogTab', () => ({ default: () => <div data-testid="changelog-body" /> }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
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
