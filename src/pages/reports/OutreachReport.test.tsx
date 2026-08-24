import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OutreachReport from './OutreachReport'
import type { OutreachReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseOutreachReport = vi.fn()
vi.mock('./useOutreachReport', () => ({ useOutreachReport: () => mockUseOutreachReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default axis order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

// Portie-6 payload: the fase-1 fields (total_targets/reached/reach_rate + legacy
// status/outcome keys) are still present; every new axis sums to `total`. The
// series has NO ghost zero-bucket — series[0].date === from.
const data: OutreachReportData = {
  period: 'month', from: '2026-05-14', to: '2026-08-14',
  total_targets: 40, reached: 25, reach_rate: 0.63, total: 40,
  timeseries: { bucket: 'week', series: [
    { date: '2026-05-14', label: 'Wk 20', value: 18 },
    { date: '2026-08-10', label: 'Wk 33', value: 22 },
  ] },
  by_status: [
    { status: 'contacted', value: 'contacted', label: 'Benaderd', count: 25 },
    { status: 'new', value: 'new', label: 'Nieuw', count: 11 },
    // Orphan-string status: its own "Onbekend" bar, drillable on the RAW value.
    { status: 'weird-legacy-status', value: 'weird-legacy-status', label: 'Onbekend', count: 4 },
  ],
  by_outcome: [
    { outcome: 'interested', value: 'interested', label: 'Interested', count: 10, share_of_reached: 0.4 },
    { outcome: 'not_interested', value: 'not_interested', label: 'Geen interesse', count: 15, share_of_reached: 0.6 },
    // The sentinel that makes the axis sum to total (targets without any outcome).
    { outcome: 'none', value: 'none', label: 'Geen uitkomst', count: 15, share_of_reached: null },
  ],
  by_campaign: [
    { value: 'camp-1', label: 'Bellijst Q3 wondzorg', count: 20 },
    // An archived campaign keeps its real name and stays drillable on its uuid.
    { value: 'camp-archived-uuid', label: 'Voorjaarsactie 2026', count: 12 },
    { value: 'others', label: 'Overige bellijsten', count: 8 },
  ],
  by_assignee: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 30 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 10 },
  ],
  by_channel: [
    { value: 'phone', label: 'Telefoon', count: 26 },
    { value: 'whatsapp', label: 'WhatsApp', count: 9 },
    { value: 'none', label: 'Geen kanaal', count: 5 },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <OutreachReport period="month" />
    </QueryClientProvider>,
  )
}

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

describe('OutreachReport (RAPPORTEN-SUITE-1 portie 6, bellijsten report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseOutreachReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Outreach laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseOutreachReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de outreach niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no targets', () => {
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, total_targets: 0, reached: 0, reach_rate: null, total: 0,
        timeseries: { bucket: 'week', series: [] },
        by_status: [], by_outcome: [], by_campaign: [], by_assignee: [], by_channel: [] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen bellijst-targets in deze periode')).toBeInTheDocument()
  })

  // Contract: every axis (fase-1 status/outcome included) renders every segment
  // (incl. 'none'/'others'/orphan bars) and sums exactly to the report total.
  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // getAllByText: a few axis labels (Niet toegewezen/Telefoon/Geen uitkomst) now
    // also double as a KPI-card label or sub — presence is what this test proves.
    for (const label of ['Wk 20', 'Wk 33', 'Bellijst Q3 wondzorg', 'Voorjaarsactie 2026', 'Overige bellijsten',
      'Anna de Vries', 'Niet toegewezen', 'Telefoon', 'WhatsApp', 'Geen kanaal',
      'Benaderd', 'Nieuw', 'Onbekend', 'Interested', 'Geen interesse', 'Geen uitkomst']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_outcome.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_campaign.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_assignee.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_channel.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // Fase-1 regression: the legacy KPI numbers (targets / reached / reach rate)
  // still render unchanged next to the new portie-6 axes.
  it('still renders the fase-1 reach KPI strip (regression)', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal targets')).toBeInTheDocument()
    expect(screen.getByText('Bereikt')).toBeInTheDocument()
    expect(screen.getByText('Bereikpercentage')).toBeInTheDocument()
    expect(screen.getByText('63%')).toBeInTheDocument()
  })

  // RAPPORT-KAARTDRILLS-1: total/reached/notReached/rate drill via the new
  // per-KPI-card endpoint GET /reports/outreach/kpis/drill?kpi=<key>.
  it('clicking the "Totaal targets" KPI card drills via /reports/outreach/kpis/drill?kpi=total_targets', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Totaal targets'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/kpis/drill',
      expect.objectContaining({ params: { kpi: 'total_targets', period: 'month' } }))
  })

  it('clicking the "Bereikt" KPI card drills with kpi=reached', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Bereikt'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/kpis/drill',
      expect.objectContaining({ params: { kpi: 'reached', period: 'month' } }))
  })

  // Opus-REJECT: de kaart toont reach_rate (reached/total) terwijl de sleutel
  // conversion_pct een andere noemer draagt — ontkoppeld tot de strip de
  // server-kpis[] leest; total/reached blijven wél drillen (hard bevestigd).
  it('the rate card carries no drill; total still drills via kpi=total_targets', async () => {
    const user = userEvent.setup()
    renderReport()
    await user.click(await screen.findByText('63%'))
    expect(getSpy.mock.calls.map(c => String(c[0])).some(u => u.includes('/kpis/drill'))).toBe(false)
    await user.click(screen.getByText('Totaal targets'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'total_targets' }) }))
  })

  // A null/missing reach_rate must never crash and must never fabricate a
  // clickable card for a value that doesn't exist.
  it('does not crash and keeps the rate card non-clickable when reach_rate is null', () => {
    mockUseOutreachReport.mockReturnValue({ data: { ...data, reach_rate: null }, loading: false, error: false })
    expect(() => renderReport()).not.toThrow()
    expect(screen.getByText('Bereikpercentage').closest('[role="button"]')).toBeNull()
  })

  // Nine-card footprint (Danny's "negen KPI rows"): the fase-1 three plus two
  // derived complements (not-reached/assigned) and four real axis-derived cards
  // (unassigned, no-outcome, top campaign, top channel) — never a fabricated ninth.
  it('renders exactly nine KPI cards, each a real number from the fixture', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const cardLabels = ['Totaal targets', 'Bereikt', 'Bereikpercentage', 'Niet bereikt', 'Toegewezen',
      'Niet toegewezen', 'Geen uitkomst', 'Grootste bellijst', 'Grootste kanaal']
    expect(cardLabels).toHaveLength(9)
    // getAllByText: 'Niet toegewezen'/'Geen uitkomst' double as an axis-bar label
    // below, so at least one instance (not exactly one) is what proves the card.
    for (const label of cardLabels) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    // Values collide with axis-bar counts (15/30 each appear twice) — presence,
    // not uniqueness, is what these two derived cards need to prove.
    expect(screen.getAllByText(String(data.total_targets - data.reached)).length).toBeGreaterThan(0) // notReached
    expect(screen.getAllByText(String(data.total_targets - 10)).length).toBeGreaterThan(0) // assigned
    // topCampaign sub shows the campaign name (the biggest real one, 'others'
    // excluded) — it also appears as its own bar below, so at least one instance.
    expect(screen.getAllByText('Bellijst Q3 wondzorg').length).toBeGreaterThan(0)
  })

  // Nine-card footprint holds even without a real top campaign/channel (only
  // 'others'/'none' sentinel rows) — the two slots are PERMANENT and render the
  // house dash instead of shrinking the strip to seven (Danny — always nine).
  it('dash-fills topCampaign/topChannel when only sentinel rows exist', () => {
    mockUseOutreachReport.mockReturnValue({
      data: { ...data,
        by_campaign: [{ value: 'others', label: 'Overige bellijsten', count: 40 }],
        by_channel: [{ value: 'none', label: 'Geen kanaal', count: 40 }],
      },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Grootste bellijst')).toBeInTheDocument()
    expect(screen.getByText('Grootste kanaal')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBe(2)
  })

  // "Grootste bellijst" is also the campaign axis's own mount default (camp-1 is
  // the biggest real bar) — the request is already in the call history from the
  // mount-seed effect; asserted here over the FULL history, never "last call".
  it('clicking the "Grootste bellijst" KPI card drills with campaign=<uuid> (XOR)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Grootste bellijst'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'camp-1', period: 'month' } }))
  })

  // BELANGRIJK per contract: the window comes from the RESPONSE and must render
  // prominently as DD-MM-YYYY — never ISO (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Bellijst-targets 14-05-2026 t/m 14-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-05-14/)).not.toBeInTheDocument()
  })

  it('clicking a campaign bar drills with campaign=<uuid> (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Bellijst Q3 wondzorg').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'camp-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/advice',
      expect.objectContaining({ params: { campaign: 'camp-1', period: 'month' } }))
  })

  // 'others' = the exact complement of the top-20 — a real, clickable row.
  it('clicking the "Overige bellijsten" bar drills with campaign=others', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Overige bellijsten'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'others', period: 'month' } }))
  })

  // An archived campaign keeps its real name (never "Onbekend") and its bar still
  // drills on the raw uuid like any other campaign.
  it('renders an archived campaign under its own name and drills on its uuid', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Voorjaarsactie 2026'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'camp-archived-uuid', period: 'month' } }))
  })

  it('clicking an assignee bar drills with the assignee XOR param (D2 shape: owner_id → assignee)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { assignee: 'u1', period: 'month' } }))
    await user.click(screen.getAllByText('Niet toegewezen').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { assignee: 'none', period: 'month' } }))
  })

  it('clicking a channel bar drills with the channel XOR param (incl. the none sentinel)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Telefoon').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { channel: 'phone', period: 'month' } }))
    await user.click(screen.getByText('Geen kanaal'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { channel: 'none', period: 'month' } }))
  })

  // Orphan-string status: a status value with no lookup row still renders its own
  // "Onbekend" bar and drills on the RAW value — no special-casing.
  it('clicking the status "Onbekend" orphan bar drills on its raw value', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { status: 'weird-legacy-status', period: 'month' } }))
  })

  // The "Geen uitkomst" sentinel makes by_outcome sum to total — and drills on
  // its own value like any other outcome segment.
  it('clicking the "Geen uitkomst" sentinel drills with outcome=none', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Geen uitkomst').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { outcome: 'none', period: 'month' } }))
    await user.click(screen.getByText('Interested'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { outcome: 'interested', period: 'month' } }))
  })

  // XOR both directions on two axes: switching status → campaign → status never
  // lets the previous axis' param ride along — each axis keeps its own params.
  it('keeps the drill params XOR when hopping between the status and campaign axes', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Nieuw'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { status: 'new', period: 'month' } }))
    await user.click(screen.getByText('Overige bellijsten'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'others', period: 'month' } }))
    // Neither call ever mixed the other axis's param onto its own.
    const statusCall = getSpy.mock.calls.find(c => c[0] === '/reports/outreach/drill'
      && (c[1] as { params: Record<string, unknown> }).params.status === 'new')
    expect(statusCall?.[1].params).not.toHaveProperty('campaign')
  })

  // GRANULARITY role of `bucket` (dual-role contract): a week timeseries bar drills
  // with date=<key> + bucket=week so bar and list totals always agree.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 20'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { date: '2026-05-14', bucket: 'week', period: 'month' } }))
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-05-14', label: '14-05', value: 3 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('14-05'))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/outreach/drill'
      && (c[1] as { params: Record<string, unknown> }).params.date === '2026-05-14')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })

  // Every drill source targets the ONE outreach drill/advice pair — never a
  // sibling report's endpoint, never an entity list route.
  it('always drills via /reports/outreach/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Nieuw'))
    await user.click(screen.getByText('WhatsApp'))
    await user.click(screen.getAllByText('Niet toegewezen').at(-1)!)
    await user.click(screen.getByText('Wk 33'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/outreach/drill' || c[0] === '/reports/outreach/advice')).toBe(true)
  })

  // REPORTS-KPI-SPARES-1: the settings-picked spare cards render real values off
  // fields already in the fixture, and the strip stays exactly nine.
  it('renders spare KPI cards with real values when picked in settings, strip stays nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_outreach: [
        'topStatus', 'topOutcome', 'campaignsCount', 'channelsUsed', 'assigneesCount',
        'assigned', 'reached', 'rate', 'total',
      ],
    })
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // topStatus = the biggest by_status segment ('contacted'/'Benaderd', 25).
    expect(screen.getByText('Grootste status')).toBeInTheDocument()
    expect(screen.getAllByText('Benaderd').length).toBeGreaterThan(0)
    // topOutcome excludes the 'none' sentinel, so the biggest real outcome wins
    // ('not_interested'/'Geen interesse', 15).
    expect(screen.getByText('Grootste uitkomst')).toBeInTheDocument()
    expect(screen.getAllByText('Geen interesse').length).toBeGreaterThan(0)
    // campaignsCount = real campaigns excl. 'others' (camp-1, camp-archived-uuid) = 2.
    expect(screen.getByText('Aantal bellijsten')).toBeInTheDocument()
    // channelsUsed = real channels excl. 'none' (phone, whatsapp) = 2.
    expect(screen.getByText('Gebruikte kanalen')).toBeInTheDocument()
    // assigneesCount = real assignees excl. 'none' (u1) = 1.
    expect(screen.getByText('Aantal toegewezen recruiters')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  // RAPPORTEN-DRILLLIST-1: every axis section shows its own always-visible list
  // beside the chart, seeded with a real request on mount — never a blank panel.
  it('renders a drill list beside each axis chart, defaulted on mount', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The campaign axis's top segment (camp-1, 20) seeds its own list on mount.
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'camp-1', period: 'month' } }))
    // The channel axis independently seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { channel: 'phone', period: 'month' } }))
  })

  // Clicking a segment in one chart must never change another chart's list — each
  // section owns its own drill state, never a shared overlay. "Nieuw" is NOT the
  // status axis's mount default (Benaderd/contacted is), so this click is
  // guaranteed to fire a fresh request — while the already-seeded channel axis
  // fires none.
  it("clicking a segment in one chart does not change another chart's list", async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Nieuw')) // the status axis, non-default segment
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { status: 'new', period: 'month' } }))
    // No request was fired for the channel axis's ALREADY-seeded default (phone) —
    // it stayed exactly as mount left it.
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/outreach/drill'
      && (c[1] as { params: Record<string, unknown> }).params.channel === 'phone')).toBe(false)
  })
})
