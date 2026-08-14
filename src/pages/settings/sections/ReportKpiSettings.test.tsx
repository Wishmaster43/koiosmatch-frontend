/**
 * ReportKpiSettings — the per-report nine-slot KPI editor. Mutation test asserts
 * the REQUEST (route key + full nine-key body), not just that a callback fired
 * (§13). Also covers the vanished-key fallback notice.
 *
 * Note: today every 'fixed'-family report's catalogue equals its default order
 * 1:1 (design doc — no spare cards exist yet), so a slot's picker legitimately
 * offers no OTHER card to swap in; the meaningfully testable mutation right now
 * is REORDER (drag), which this test drives directly on the shared DragList's
 * plain draggable rows (no dataTransfer payload needed — see SettingsControls.jsx).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ReportKpiSettings from './ReportKpiSettings'
import { getReportKpiDefaultOrder, reportKpiSettingsKey } from '@/pages/reports/kpiCatalog'

const t = (key: string) => i18n.t(key, { ns: 'analytics' })
const st = (key: string) => i18n.t(key, { ns: 'settings' })

// Recruiters is not the first sub-tab (candidates is) — switch to it explicitly.
async function openRecruitersTab() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: st('reportKpis.reportNames.recruiters') }))
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
  it('renders the recruiters report default nine-slot order when its tab is selected', async () => {
    render(<ReportKpiSettings />)
    await openRecruitersTab()
    const defaultOrder = getReportKpiDefaultOrder('recruiters')
    expect(screen.getAllByText(t('recruiters.summary.recruiters')).length).toBeGreaterThan(0)
    expect(defaultOrder).toHaveLength(9)
    expect(defaultOrder[0]).toBe('recruiters')
  })

  it('says there are no spare cards yet for a fixed-family report (honest, not decorative)', async () => {
    render(<ReportKpiSettings />)
    await openRecruitersTab()
    expect(screen.getByText(st('reportKpis.noSpareCards'))).toBeTruthy()
  })

  it('reordering PUTs the exact settings key with the same nine keys in the new order', async () => {
    const { container } = render(<ReportKpiSettings />)
    await openRecruitersTab()
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(9)

    // Drag row 0 ("recruiters") onto row 1 ("candidates") — swaps their positions.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalled())
    const body = saveSettingsKeys.mock.calls.at(-1)?.[0] as Record<string, string[]>
    const key = reportKpiSettingsKey('recruiters')
    expect(body[key]).toHaveLength(9)
    expect(body[key][0]).toBe('candidates')
    expect(body[key][1]).toBe('recruiters')
    expect(new Set(body[key]).size).toBe(9) // still every card exactly once
  })

  it('shows a visible fallback notice when a stored key no longer exists', async () => {
    mockSettings.mockReturnValue({
      [reportKpiSettingsKey('recruiters')]: JSON.stringify(['ghost', ...getReportKpiDefaultOrder('recruiters').slice(1)]),
    })
    render(<ReportKpiSettings />)
    await openRecruitersTab()
    expect(screen.getByText(st('reportKpis.fellBackNotice'))).toBeTruthy()
  })
})
