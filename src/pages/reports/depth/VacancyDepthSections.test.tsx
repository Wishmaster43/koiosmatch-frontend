// Behavioural coverage for VacancyDepthSections: each optional field renders
// its own section from a fixture in the exact server shape, the fixed-window
// caption shows where required, the aging row click fires with the exact row,
// and a section disappears entirely when its field is undefined.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import VacancyDepthSections from './VacancyDepthSections'
import type { VacanciesReportData } from '@/types/analytics'

// Minimal renderer wired to the real i18n instance (matches the reference
// report test's provider setup).
function renderSections(data: VacanciesReportData, onAgingRow = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <VacancyDepthSections data={data} onAgingRow={onAgingRow} />
    </I18nextProvider>,
  )
  return { onAgingRow }
}

// Base fixture with all four optional depth fields populated in the exact
// server shape (§ measured facts) — each field typed from the real
// VacanciesReportData type, never cast away, so a server field rename fails
// this file at compile time.
const ttfDecomposition: NonNullable<VacanciesReportData['ttf_decomposition']> = {
  published_to_first_application: 3, first_application_to_proposal: 5, proposal_to_match: null,
}
const fillRateTimeseries: NonNullable<VacanciesReportData['fill_rate_timeseries']> = [
  { date: '2026-08-10', total: 4, filled: 2, rate: 50 },
  { date: '2026-08-11', total: 2, filled: 0, rate: null },
]
const fillRateByBranch: NonNullable<VacanciesReportData['fill_rate_by_branch']> = [
  { branch_id: 'b1', branch: 'Amsterdam', total: 10, filled: 4, rate: 40 },
  { branch_id: null, branch: 'Onbekend', total: 3, filled: 1, rate: 33.3 },
]
const aging: NonNullable<VacanciesReportData['aging']> = [
  { id: 'v1', title: 'Verpleegkundige IC', days_open: 42, recruiter: 'Danny', recruiter_id: 'u1', candidates_in_process: 2, applications: 6 },
  { id: 'v2', title: 'Logistiek medewerker', days_open: 30, recruiter: null, recruiter_id: null, candidates_in_process: 0, applications: 0 },
]
const fullData: Pick<VacanciesReportData, 'ttf_decomposition' | 'fill_rate_timeseries' | 'fill_rate_by_branch' | 'aging'> = {
  ttf_decomposition: ttfDecomposition,
  fill_rate_timeseries: fillRateTimeseries,
  fill_rate_by_branch: fillRateByBranch,
  aging,
}

describe('VacancyDepthSections', () => {
  it('renders ttf_decomposition as three KPI tiles, dash for a null step', () => {
    renderSections(fullData as VacanciesReportData)
    expect(screen.getByText(i18n.t('vacancies.daysValue', { days: 3, ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('vacancies.daysValue', { days: 5, ns: 'analytics' }))).toBeInTheDocument()
    // proposal_to_match is null on this fixture -> the KPI tile itself shows the
    // house dash (scoped to the tile, not the whole render, so the aging
    // table's own unrelated dash cell cannot make this pass by accident).
    const proposalTile = screen.getByText(i18n.t('vacancies.depth.ttf.proposalToMatch', { ns: 'analytics' })).closest('div')?.parentElement
    expect(proposalTile).toHaveTextContent('—')
  })

  it('renders fill_rate_by_branch rows with the fixed-window caption, mapping a null branch_id', () => {
    renderSections(fullData as VacanciesReportData)
    expect(screen.getByText('Amsterdam')).toBeInTheDocument()
    // branch_id null -> the shared "no branch" key, never the server's raw label.
    expect(screen.getByText(i18n.t('vacancies.depth.noBranch', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getAllByText(i18n.t('vacancies.depth.fixedWindow', { ns: 'analytics' })).length).toBeGreaterThan(0)
  })

  it('fires onAgingRow with the exact clicked row', async () => {
    const { onAgingRow } = renderSections(fullData as VacanciesReportData)
    await userEvent.click(screen.getByText('Verpleegkundige IC'))
    expect(onAgingRow).toHaveBeenCalledWith(fullData.aging![0])
  })

  it('renders the applications column (the drill population) alongside candidates_in_process', () => {
    renderSections(fullData as VacanciesReportData)
    const row = screen.getByText('Verpleegkundige IC').closest('tr') as HTMLElement
    expect(row).toHaveTextContent('6')
  })

  it('renders an unresolved recruiter dash for a null recruiter', () => {
    renderSections(fullData as VacanciesReportData)
    // Logistiek row has recruiter: null -> renders as the house dash.
    const row = screen.getByText('Logistiek medewerker').closest('tr') as HTMLElement
    expect(row).toHaveTextContent('—')
  })

  it('renders the fill_rate_by_branch table as inert (no row click affordance)', () => {
    renderSections(fullData as VacanciesReportData)
    const row = screen.getByText('Amsterdam').closest('tr') as HTMLElement
    expect(row).not.toHaveAttribute('role', 'button')
    expect(row.style.cursor).not.toBe('pointer')
  })

  it('omits a section entirely when its field is undefined', () => {
    renderSections({} as VacanciesReportData)
    expect(screen.queryByText(i18n.t('vacancies.depth.ttf.title', { ns: 'analytics' }))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('vacancies.depth.aging.title', { ns: 'analytics' }))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('vacancies.depth.fillRateSeries.title', { ns: 'analytics' }))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('vacancies.depth.fillRateBranch.title', { ns: 'analytics' }))).not.toBeInTheDocument()
  })
})
