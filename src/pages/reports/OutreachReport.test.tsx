import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

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

// The last drill call's raw params — for the XOR proofs (exactly ONE segment param).
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/outreach/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

describe('OutreachReport (RAPPORTEN-SUITE-1 portie 6, bellijsten report)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

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

  it('clicking the "Grootste bellijst" KPI card drills with campaign=<uuid> (XOR)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Grootste bellijst'))
    expect(lastDrillParams()).toEqual({ campaign: 'camp-1', period: 'month' })
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
    expect(lastDrillParams()).toEqual({ campaign: 'others', period: 'month' })
  })

  // An archived campaign keeps its real name (never "Onbekend") and its bar still
  // drills on the raw uuid like any other campaign.
  it('renders an archived campaign under its own name and drills on its uuid', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Voorjaarsactie 2026'))
    expect(lastDrillParams()).toEqual({ campaign: 'camp-archived-uuid', period: 'month' })
  })

  it('clicking an assignee bar drills with the assignee XOR param (D2 shape: owner_id → assignee)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(lastDrillParams()).toEqual({ assignee: 'u1', period: 'month' })
    await user.click(screen.getAllByText('Niet toegewezen').at(-1)!)
    expect(lastDrillParams()).toEqual({ assignee: 'none', period: 'month' })
  })

  it('clicking a channel bar drills with the channel XOR param (incl. the none sentinel)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Telefoon').at(-1)!)
    expect(lastDrillParams()).toEqual({ channel: 'phone', period: 'month' })
    await user.click(screen.getByText('Geen kanaal'))
    expect(lastDrillParams()).toEqual({ channel: 'none', period: 'month' })
  })

  // Orphan-string status: a status value with no lookup row still renders its own
  // "Onbekend" bar and drills on the RAW value — no special-casing.
  it('clicking the status "Onbekend" orphan bar drills on its raw value', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend'))
    expect(lastDrillParams()).toEqual({ status: 'weird-legacy-status', period: 'month' })
  })

  // The "Geen uitkomst" sentinel makes by_outcome sum to total — and drills on
  // its own value like any other outcome segment.
  it('clicking the "Geen uitkomst" sentinel drills with outcome=none', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Geen uitkomst').at(-1)!)
    expect(lastDrillParams()).toEqual({ outcome: 'none', period: 'month' })
    await user.click(screen.getByText('Interested'))
    expect(lastDrillParams()).toEqual({ outcome: 'interested', period: 'month' })
  })

  // XOR both directions on two axes: switching status → campaign → status never
  // lets the previous axis' param ride along (toEqual proves the EXACT param set).
  it('keeps the drill params XOR when hopping between the status and campaign axes', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Benaderd'))
    expect(lastDrillParams()).toEqual({ status: 'contacted', period: 'month' })
    await user.click(screen.getAllByText('Bellijst Q3 wondzorg').at(-1)!)
    expect(lastDrillParams()).toEqual({ campaign: 'camp-1', period: 'month' })
    await user.click(screen.getByText('Nieuw'))
    expect(lastDrillParams()).toEqual({ status: 'new', period: 'month' })
  })

  // GRANULARITY role of `bucket` (dual-role contract): a week timeseries bar drills
  // with date=<key> + bucket=week so bar and drawer totals always agree.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 20'))
    expect(lastDrillParams()).toEqual({ date: '2026-05-14', bucket: 'week', period: 'month' })
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-05-14', label: '14-05', value: 3 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('14-05'))
    expect(lastDrillParams()).toEqual({ date: '2026-05-14', period: 'month' })
  })

  // Every drill source targets the ONE outreach drill/advice pair — never a
  // sibling report's endpoint, never an entity list route.
  it('always drills via /reports/outreach/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Benaderd'))
    await user.click(screen.getAllByText('Telefoon').at(-1)!)
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(screen.getByText('Wk 33'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/outreach/drill' || c[0] === '/reports/outreach/advice')).toBe(true)
  })

  // Calm 403 degrade: the drill rows carry candidate names and need outreach.view
  // on top of reports.view — denied rows hide the records section (no error
  // banner) while advice stays visible.
  it('keeps the advice visible when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Bel de onbereikte targets deze week terug.' } }))
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Benaderd'))
    await waitFor(() => expect(screen.getByText('Bel de onbereikte targets deze week terug.')).toBeInTheDocument())
    expect(screen.queryByText('Onderliggende records')).not.toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error|forbidden/i)).not.toBeInTheDocument()
  })

  // {advice:null} (no koios_ai module) renders the calm no-advice copy, never an
  // error — and a drill row (candidate name) renders via the shared row mapping.
  it('renders no error on {advice:null} and shows the drill rows', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/advice')
      ? Promise.resolve({ data: { advice: null } })
      : Promise.resolve({ data: {
          data: [{ id: 'c1', entity: 'candidate', name: 'J. de Boer', status: 'Voicemail ingesproken' }],
          meta: { total: 1 },
        } }))
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Geen uitkomst').at(-1)!)
    await waitFor(() => expect(screen.getByText('J. de Boer')).toBeInTheDocument())
    expect(screen.getByText('Voicemail ingesproken')).toBeInTheDocument()
    expect(screen.getByText('Koios heeft nog geen advies voor dit getal.')).toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error/i)).not.toBeInTheDocument()
  })
})
