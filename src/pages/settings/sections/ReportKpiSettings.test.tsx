/**
 * ReportKpiSettings — the per-report nine-slot KPI editor. Mutation test asserts
 * the REQUEST (route key + full nine-key body), not just that a callback fired
 * (§13). Also covers the vanished-key fallback notice.
 *
 * RAPPORTEN-DANNY10-1: the workhorse scope moved from `recruiters` (retired with
 * its report page) to `matches` — a surviving fixed-family scope with nine
 * defaults plus real spares (REPORTS-KPI-SPARE-1). `prospects` stays the
 * "still no spares" honesty control (its 'axis'-family sibling `customers` grew
 * signal spares that are deliberately NOT mirrored onto Prospects — see
 * kpiCatalog.ts's own note on why).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ReportKpiSettings from './ReportKpiSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from '@/pages/reports/kpiCatalog'

const t = (key: string) => i18n.t(key, { ns: 'analytics' })
const st = (key: string) => i18n.t(key, { ns: 'settings' })

// Matches is not the first sub-tab (candidates is) — switch to it explicitly.
async function openMatchesTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: st('reportKpis.reportNames.matches') }))
}

async function openVacanciesTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: st('reportKpis.reportNames.vacancies') }))
}

// Prospects is the "still no spares" control case (see file-top note).
async function openProspectsTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: st('reportKpis.reportNames.prospects') }))
}

const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
const mockLoaded = vi.hoisted(() => vi.fn(() => true))
// The call SIGNATURE is declared as a type argument rather than as a named-but-unused
// parameter: the assertions below read the recorded payload off mock.calls, so the
// signature has to carry that argument, while an unused parameter name would only
// exist to be linted away.
const saveSettingsKeys = vi.hoisted(() =>
  vi.fn<(partial: Record<string, unknown>) => Promise<void>>(async () => {}))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useAllSettings: () => mockSettings(),
    useSettingsLoaded: () => mockLoaded(),
    saveSettingsKeys,
  }
})

afterEach(() => vi.clearAllMocks())

describe('ReportKpiSettings', () => {
  it('renders the matches report default nine-slot order when its tab is selected', async () => {
    render(<ReportKpiSettings />)
    await openMatchesTab()
    const defaultOrder = getReportKpiDefaultOrder('matches')
    expect(screen.getAllByText(t('matches.kpi.total')).length).toBeGreaterThan(0)
    expect(defaultOrder).toHaveLength(9)
    expect(defaultOrder[0]).toBe('total')
  })

  it('says there are no spare axes yet for an axis-family report with none (honest, not decorative)', async () => {
    render(<ReportKpiSettings />)
    await openProspectsTab()
    expect(screen.getByText(st('reportKpis.noSpareAxes'))).toBeTruthy()
  })

  // KPI-MATCHES-1 supersede: the four ad-hoc spares retired with the server-suite
  // flip — matches now shows the honest no-spares notice, and every suite entry
  // carries a real i18n label. The spare-offering path stays covered by vacancies.
  it('shows the honest no-spares notice for matches after the server-suite flip', async () => {
    render(<ReportKpiSettings />)
    await openMatchesTab()
    expect(screen.getByText(st('reportKpis.noSpareCards'))).toBeTruthy()
    const catalog = getReportKpiCatalog('matches')
    expect(catalog).toHaveLength(9)
    for (const entry of catalog) {
      expect(i18n.t(entry.labelKey, { ns: 'analytics' })).not.toBe(entry.labelKey)
    }
  })
  it('offers real spare cards for vacancies (REPORTS-KPI-SPARE-1 path stays covered)', async () => {
    render(<ReportKpiSettings />)
    await openVacanciesTab()
    expect(screen.queryByText(st('reportKpis.noSpareCards'))).toBeNull()
    const catalog = getReportKpiCatalog('vacancies')
    const defaultOrder = getReportKpiDefaultOrder('vacancies')
    expect(catalog.length).toBeGreaterThan(defaultOrder.length)
  })

  it('reordering PUTs the exact settings key with the same nine keys in the new order', async () => {
    const { container } = render(<ReportKpiSettings />)
    await openMatchesTab()
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(9)

    // Drag row 0 ("total") onto row 1 ("new_in_period") — swaps their positions.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalled())
    const body = saveSettingsKeys.mock.calls.at(-1)?.[0] as Record<string, string[]>
    const key = reportKpiSettingsKey('matches')
    expect(body[key]).toHaveLength(9)
    expect(body[key][0]).toBe('new_in_period')
    expect(body[key][1]).toBe('total')
    expect(new Set(body[key]).size).toBe(9) // still every card exactly once
  })

  it('shows a visible fallback notice when a stored key no longer exists', async () => {
    mockSettings.mockReturnValue({
      [reportKpiSettingsKey('matches')]: JSON.stringify(['ghost', ...getReportKpiDefaultOrder('matches').slice(1)]),
    })
    render(<ReportKpiSettings />)
    await openMatchesTab()
    expect(screen.getByText(st('reportKpis.fellBackNotice'))).toBeTruthy()
  })
})
