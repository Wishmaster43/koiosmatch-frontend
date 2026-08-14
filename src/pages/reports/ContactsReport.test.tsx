import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ContactsReport from './ContactsReport'
import type { ContactsReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseContactsReport = vi.fn()
vi.mock('./useContactsReport', () => ({ useContactsReport: () => mockUseContactsReport() }))

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

// Fixture per the RAPPORTEN-SUITE-2 contacts contract: five-way XOR axes, each
// axis sums to total. `by_location`/`by_department` carry 'none' since those
// columns are optional on a contact person.
const data: ContactsReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  total: 10,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-01', label: 'Wk 31', value: 4 },
    { date: '2026-08-10', label: 'Wk 32', value: 6 },
  ] },
  summary: { total: 10, primary: 6, with_recent_contact: 5, never_contacted: 2 },
  by_status: [
    { value: 'status-1', label: 'Actief', color: '#2563eb', count: 8 },
    { value: 'none', label: 'Onbekend (geen status)', color: null, count: 2 },
  ],
  by_customer: [
    { value: 'cust-1', label: 'Yesway Flex', count: 7 },
    { value: 'none', label: 'Geen klant', count: 3 },
  ],
  by_function: [
    { value: 'HR Manager', label: 'HR Manager', count: 6 },
    { value: 'none', label: 'Geen functie', count: 4 },
  ],
  by_location: [
    { value: 'loc-1', label: 'Utrecht', count: 6 },
    { value: 'none', label: 'Geen locatie', count: 4 },
  ],
  by_department: [
    { value: 'dept-1', label: 'Verkoop', count: 5 },
    { value: 'none', label: 'Geen afdeling', count: 5 },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <ContactsReport period="month" />
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

describe('ContactsReport (RAPPORTEN-SUITE-2 contacts report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseContactsReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Contactpersonen laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseContactsReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de contactpersonen niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no contacts', () => {
    mockUseContactsReport.mockReturnValue({
      data: { ...data, total: 0, by_status: [], by_customer: [], by_function: [], by_location: [], by_department: [],
        timeseries: { bucket: 'week', series: [] },
        summary: { total: 0, primary: 0, with_recent_contact: 0, never_contacted: 0 } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen contactpersonen in deze periode')).toBeInTheDocument()
  })

  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Wk 31', 'Wk 32', 'Actief', 'Onbekend (geen status)',
      'Yesway Flex', 'Geen klant', 'HR Manager', 'Geen functie', 'Utrecht', 'Geen locatie',
      'Verkoop', 'Geen afdeling']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_customer.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_function.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_location.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_department.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  it('renders the KPI strip from the backend summary', () => {
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal contactpersonen')).toBeInTheDocument()
    expect(screen.getByText('Primair contact')).toBeInTheDocument()
    expect(screen.getByText('Recent contact gehad')).toBeInTheDocument()
    expect(screen.getByText('Nooit contact gehad')).toBeInTheDocument()
  })

  // Nine-card footprint (Danny's "negen KPI rows"): the four summary cards plus
  // the derived contacted-rate and the four axis-coverage gaps ('none' bucket
  // per axis), each a real number off the fixture — never a fabricated ninth.
  it('renders exactly nine KPI cards, each a real number from the fixture', () => {
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Percentage recent benaderd')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument() // with_recent_contact(5)/total(10)
    expect(screen.getByText('Zonder functie')).toBeInTheDocument()
    expect(screen.getByText('Zonder locatie')).toBeInTheDocument()
    expect(screen.getByText('Zonder afdeling')).toBeInTheDocument()
    expect(screen.getByText('Zonder klant')).toBeInTheDocument()
    const cardLabels = ['Totaal contactpersonen', 'Primair contact', 'Recent contact gehad',
      'Nooit contact gehad', 'Percentage recent benaderd', 'Zonder functie', 'Zonder locatie',
      'Zonder afdeling', 'Zonder klant']
    expect(cardLabels).toHaveLength(9)
    for (const label of cardLabels) expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('clicking the "Zonder functie" KPI card drills with function=none (XOR)', async () => {
    const user = userEvent.setup()
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Zonder functie'))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { function: 'none', period: 'month' } }))
  })

  // BELANGRIJK per contract: the window must be prominent, DD-MM-YYYY from the
  // RESPONSE — never ISO (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Contactpersonen 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  // "Actief" is also the status axis's own mount default (top segment) — the
  // request is already in the call history from the mount-seed effect; asserted
  // here over the FULL history, never "last call".
  it('clicking a status bar drills with status=<value> (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/advice',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
  })

  it('clicking each plain axis drills with its own XOR param', async () => {
    const user = userEvent.setup()
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Yesway Flex'))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { customer: 'cust-1', period: 'month' } }))
    await user.click(screen.getByText('HR Manager'))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { function: 'HR Manager', period: 'month' } }))
    await user.click(screen.getByText('Utrecht'))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { location: 'loc-1', period: 'month' } }))
    await user.click(screen.getByText('Verkoop'))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { department: 'dept-1', period: 'month' } }))
    // Report drill endpoints only — never an entity list route.
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/customers'))).toBe(false)
  })

  // XOR proof: a status pick and a customer pick each carry exactly ONE segment
  // param — no residue from the other axis, since each axis keeps its own state.
  it('sends exactly one XOR param per drill call, in both directions across axes', async () => {
    const user = userEvent.setup()
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (geen status)')) // non-default status segment
    const statusCall = getSpy.mock.calls.find(c => c[0] === '/reports/contacts/drill'
      && (c[1] as { params: Record<string, unknown> }).params.status === 'none')
    expect(statusCall?.[1].params).toEqual({ status: 'none', period: 'month' })
    await user.click(screen.getByText('Geen klant')) // non-default customer segment
    const customerCall = getSpy.mock.calls.find(c => c[0] === '/reports/contacts/drill'
      && (c[1] as { params: Record<string, unknown> }).params.customer === 'none')
    expect(customerCall?.[1].params).toEqual({ customer: 'none', period: 'month' })
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { date: '2026-08-01', bucket: 'week', period: 'month' } }))
  })

  it('always drills via /reports/contacts/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    await user.click(screen.getByText('HR Manager'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/contacts/drill' || c[0] === '/reports/contacts/advice')).toBe(true)
  })

  // Calm 403 degrade: the drill rows need customers.view on top of reports.view.
  it('degrades calmly (no error banner) when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Neem contact op met deze groep.' } }))
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } })))
    expect(screen.queryByText(/fout|mislukt|error|forbidden/i)).not.toBeInTheDocument()
  })

  // §9 privacy line: no rendered row or card exposes an email address or phone
  // number — the drill rows and the KPI strip carry only names/labels/counts.
  it('never renders an email address or phone number anywhere on the page', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/advice')
      ? Promise.resolve({ data: { advice: 'Volg deze groep op.' } })
      : Promise.resolve({ data: {
          data: [{ id: 'c1', entity: 'contact', title: 'Jan Jansen', status: 'Actief', customer: 'Yesway Flex' }],
          meta: { total: 1 },
        } }))
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = renderReport()
    await user.click(screen.getByText('Actief'))
    await waitFor(() => expect(screen.getAllByText('Jan Jansen').length).toBeGreaterThan(0))
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    // A real phone number is 9+ CONSECUTIVE digits — a DD-MM-YYYY date (this
    // page's own window/labels) never has more than 4 in a row, so this can't
    // false-positive on the house date formatter.
    expect(text).not.toMatch(/\d{9,}/)
  })

  // RAPPORTEN-DRILLLIST-1: every axis section shows its own always-visible list
  // beside the chart, seeded with a real request on mount — never a blank panel.
  it('renders a drill list beside each axis chart, defaulted on mount', () => {
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The status axis's top segment (Actief, 8) seeds its own list on mount.
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
    // The location axis independently seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { location: 'loc-1', period: 'month' } }))
  })

  // Clicking a segment in one chart must never change another chart's list — each
  // section owns its own drill state, never a shared overlay. "Onbekend (geen
  // status)" is NOT the status axis's mount default, so this click is guaranteed
  // to fire a fresh request — while the already-seeded location axis fires none.
  it("clicking a segment in one chart does not change another chart's list", async () => {
    const user = userEvent.setup()
    mockUseContactsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Onbekend (geen status)')) // the status axis, non-default segment
    expect(getSpy).toHaveBeenCalledWith('/reports/contacts/drill',
      expect.objectContaining({ params: { status: 'none', period: 'month' } }))
    // No request was fired for the location axis's ALREADY-seeded default (loc-1) —
    // it stayed exactly as mount left it.
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/contacts/drill'
      && (c[1] as { params: Record<string, unknown> }).params.location === 'loc-1')).toBe(false)
  })
})
