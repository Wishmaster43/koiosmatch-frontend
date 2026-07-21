import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
// Real i18n (nl) side-effect init so the "AI-agent" column header resolves genuine
// Dutch text (mirrors VacancyDrawer.test.tsx's convention).
import '@/i18n'
import VacanciesTable from './VacanciesTable'
import type { Vacancy } from '@/types/vacancy'

// Lookups arrive via a mocked hook — statusMeta only matters for rows without a
// resolved statusLabel, which these fixtures don't exercise.
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ statusMeta: () => ({ label: '', color: '' }) }),
}))
// Real getBoolSetting (pure) stays wired; only the API-backed loader is stubbed
// so the table renders without a live /settings fetch.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => ({}) }
})
// Identity date formatter — this test doesn't cover date rendering.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    locale: 'nl-NL',
    formatDate: (d: unknown) => (d == null ? '—' : String(d)),
    formatDateTime: (d: unknown) => (d == null ? '—' : String(d)),
  }),
}))

// Minimal rows — only the fields the table's columns actually read; cast past the
// full Vacancy shape (mirrors DetailsTab.test.tsx's VacancyDetail cast).
const rows = [
  { id: 'v1', title: 'Verpleegkundige', aiAgentName: 'Kelly' },
  { id: 'v2', title: 'Doktersassistent', aiAgentName: '' },
] as unknown as Vacancy[]

describe('VacanciesTable · AI-agent column (Danny 22-07)', () => {
  it('renders the Sparkle avatar + name when an agent is linked, and a plain em-dash when none is', () => {
    const { container } = render(<VacanciesTable rows={rows} />)

    // Locate the AI-agent column by its real (nl) header text, not a hardcoded index.
    const headerCell = screen.getByText('AI-agent').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const tableRows = container.querySelectorAll('tbody tr')
    expect(tableRows).toHaveLength(2)

    const agentCellRow1 = tableRows[0].children[colIndex]
    expect(agentCellRow1.textContent).toContain('Kelly')
    expect(agentCellRow1.querySelector('svg')).toBeTruthy()

    const agentCellRow2 = tableRows[1].children[colIndex]
    expect(agentCellRow2.textContent).toBe('—')
    expect(agentCellRow2.querySelector('svg')).toBeFalsy()
  })
})
