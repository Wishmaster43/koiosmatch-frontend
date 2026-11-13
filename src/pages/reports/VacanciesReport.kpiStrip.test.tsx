/** VacanciesReport · KPI strip and catalogue (split from VacanciesReport.test.tsx; the outer describe title is deliberately repeated so full test names stay identical). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VacanciesReport from './VacanciesReport'
import { data, dataWithKpis } from './VacanciesReport.testKit'
import i18n from '@/i18n'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseVacanciesReport = vi.fn()
vi.mock('./useVacanciesReport', () => ({ useVacanciesReport: (...args: unknown[]) => mockUseVacanciesReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket/row click sends — mutation tests must
// assert the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// The tenant picked all nine suite cards (the backend default is only four)
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['total', 'open', 'filled', 'fill_rate', 'stale_online', 'long_concept', 'no_matches', 'closing_soon', 'customers_count'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings, controllable per test (RAPPORT-KPI-INSTELBAAR).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <VacanciesReport period="month" />
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

// RAPPORT-GEZICHT-WAVE2: the Recharts house charts need real layout (jsdom has
// none) — stubs expose the exact click contract the real components deliver
// (donut: the datum incl. `key`; bar: the original ChartDatum). Mirrors
// CandidatesReport.test.tsx's stub 1:1.
type StubDatum = { name: string; value: number; key?: string }
vi.mock('@/components/charts/PieChartCard', () => ({
  default: ({ data, onItemClick }: { data?: StubDatum[]; onItemClick?: (d: unknown) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onItemClick?.(d)}>{d.name}</button>)}</>
  ),
}))
vi.mock('@/components/charts/BarChartCard', () => ({
  default: ({ data, onBarClick }: { data?: StubDatum[]; onBarClick?: (d: StubDatum) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onBarClick?.(d)}>{d.name}</button>)}</>
  ),
}))

describe('VacanciesReport (RAPPORTEN-SUITE-1 portie 4, additive on C-34)', () => {
  beforeEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  // Asserts (or denies) a rendered element's semantic ink token — the token lives
  // in the assertion argument, not in a style literal (mirrors MatchesReport.test.tsx).
  function expectInk(el: HTMLElement, token: string, opts?: { absent?: boolean }) {
    const m = expect(el)
    if (opts?.absent) m.not.toHaveInlineStyle({ color: token })
    else m.toHaveInlineStyle({ color: token })
  }

  describe('VacanciesReport (nine-card server-suite KPI strip, KPI-VAC-1)', () => {
    beforeEach(() => { getSpy.mockClear() })

    // Each plain-count card renders its own server value; fill_rate (unit
    // 'ratio') renders ×100 with the shared UNIT-CANON formatter.
    it('renders every suite card with its own value, fill_rate formatted via kpiUnitFormat', () => {
      mockUseVacanciesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
      renderReport()
      for (const value of ['84', '51', '29', '17', '13', '19', '23', '37']) {
        expect(screen.getByText(value)).toBeInTheDocument()
      }
      // fill_rate: 0.345 → formatRatio → "34,5%" (FMT-PROCENT-1: ≤1 decimal).
      expect(screen.getByText('34,5%')).toBeInTheDocument()
    })

    // Semantic colour only on the four signal keys, only when non-zero (§4).
    it('colours filled/stale_online/no_matches/closing_soon only, all non-zero in the fixture', () => {
      mockUseVacanciesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
      renderReport()
      expectInk(screen.getByText('29'), 'var(--color-success)') // filled
      expectInk(screen.getByText('17'), 'var(--color-warning)') // stale_online
      expectInk(screen.getByText('19'), 'var(--color-danger)') // no_matches
      expectInk(screen.getByText('23'), 'var(--color-warning)') // closing_soon
      // A plain count key carries no signal colour (falls back to the house text token).
      expectInk(screen.getByText('51'), 'var(--color-success)', { absent: true })
    })

    // Value and drill share ONE backend predicate per key: clicking any suite
    // card requests /reports/vacancies/kpis/drill?kpi=<its own key> (§13 mutation test).
    it('clicking a suite card drills via its own kpi key', async () => {
      const user = userEvent.setup()
      mockUseVacanciesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
      renderReport()
      getSpy.mockClear()
      await user.click(screen.getByText('13')) // long_concept
      expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
        expect.objectContaining({ params: expect.objectContaining({ kpi: 'long_concept', period: 'month' }) }))
      getSpy.mockClear()
      await user.click(screen.getByText('34,5%')) // fill_rate
      expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
        expect.objectContaining({ params: expect.objectContaining({ kpi: 'fill_rate', period: 'month' }) }))
    })

    // PARITY EXCEPTION (KPI-VAC-1, documented BE-side): customers_count counts
    // DISTINCT customers while its drill lists those customers' VACANCIES (rows
    // ≥ card value) — the card wires an explicit subtitle naming the exception
    // instead of the default window text.
    it('the customers_count card drills with its documented parity-exception subtitle', async () => {
      const user = userEvent.setup()
      mockUseVacanciesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
      renderReport()
      await user.click(screen.getByText('37')) // customers_count
      expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
        expect.objectContaining({ params: expect.objectContaining({ kpi: 'customers_count', period: 'month' }) }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(i18n.t('vacancies.kpi.customersCountDrillSub', { ns: 'analytics' }))).toBeInTheDocument()
    })

    // Honest fallback (UNIT-CANON): with no kpis[] at all (a pre-suite cached
    // envelope), every card renders the house dash with no drill affordance —
    // never a value from another population.
    it('renders dashes with no drill when kpis[] is absent from the envelope', async () => {
      const user = userEvent.setup()
      mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
      renderReport()
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9)
      getSpy.mockClear()
      await user.click(screen.getAllByText('—')[0])
      expect(getSpy).not.toHaveBeenCalledWith('/reports/vacancies/kpis/drill', expect.anything())
    })

    // RAPPORT-KPI-INSTELBAAR: which nine keys render, and in what order, is the
    // tenant's stored Settings → Reports choice, not the hardcoded default order.
    it('renders the KPI strip in the tenant-chosen stored order', () => {
      const reorderedKeys = [
        'customers_count', 'closing_soon', 'no_matches', 'long_concept', 'stale_online', 'fill_rate', 'filled', 'open', 'total',
      ]
      mockUseReportKpiSelection.mockReturnValue({ data: reorderedKeys, isLoading: false })
      mockUseVacanciesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
      const { container } = renderReport()
      const totalLabel = i18n.t('vacancies.kpi.total', { ns: 'analytics' })
      const customersCountLabel = i18n.t('vacancies.kpi.customersCount', { ns: 'analytics' })
      const text = container.textContent ?? ''
      // The stored order puts customers_count FIRST and total LAST — the strip
      // must render in that exact order, not today's hardcoded sequence.
      expect(text.indexOf(customersCountLabel)).toBeGreaterThanOrEqual(0)
      expect(text.indexOf(customersCountLabel)).toBeLessThan(text.indexOf(totalLabel))
    })

    // A vanished stored key falls back silently on the report itself (never a
    // crash or a blank slot) but surfaces a visible notice via ReportKpiBand.
    it('falls back a vanished stored key to the default and shows a notice, never crashing', () => {
      mockUseReportKpiSelection.mockReturnValue({
        data: [
          'ghost_key', 'open', 'filled', 'fill_rate', 'stale_online', 'long_concept', 'no_matches', 'closing_soon', 'customers_count',
        ],
        isLoading: false,
      })
      mockUseVacanciesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
      renderReport()
      expect(screen.getByText(i18n.t('vacancies.kpi.total', { ns: 'analytics' }))).toBeInTheDocument() // backfilled default
      expect(screen.getByText(i18n.t('vacancies.kpiOrderFellBack', { ns: 'analytics' }))).toBeInTheDocument()
    })
  })

  // KPI-VAC-1: the catalogue is now the server suite's own nine keys — no
  // spares (supersedes the old REPORTS-KPI-SPARE-1 six-spare block).
  describe('VacanciesReport (kpi catalogue, KPI-VAC-1)', () => {
    it('offers the nine server-suite keys, in suite order; the backend default is the first four', async () => {
      const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
      const keys = getReportKpiCatalog('vacancies').map(c => c.key)
      expect(keys).toEqual([
        'total', 'open', 'filled', 'fill_rate', 'stale_online',
        'long_concept', 'no_matches', 'closing_soon', 'customers_count',
      ])
      expect(getReportKpiDefaultOrder('vacancies')).toEqual(keys.slice(0, 4))
      expect(reportHasSpareKpiCards('vacancies')).toBe(true)
    })
  })
})
