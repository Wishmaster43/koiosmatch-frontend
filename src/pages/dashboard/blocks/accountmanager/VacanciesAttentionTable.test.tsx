/**
 * VacanciesAttentionTable — asserts row render from the exact server shape and
 * navigation to the vacancy's applicants tab on row click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacanciesAttentionTable from './VacanciesAttentionTable'
import type { VacancyAttentionRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})` }) }))

const rows: VacancyAttentionRow[] = [
  { vacancy_id: 'v1', title: 'Verpleegkundige', customer: 'Zorggroep A', days_open: 12, candidates_in_process: 3, last_application_at: '2026-08-20T10:00:00Z' },
  { vacancy_id: 'v2', title: 'Chauffeur', customer: null, days_open: 5, candidates_in_process: 0, last_application_at: null },
]

describe('VacanciesAttentionTable', () => {
  it('renders rows from the server shape', () => {
    render(<VacanciesAttentionTable rows={rows} onNavigate={vi.fn()} />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Zorggroep A')).toBeInTheDocument()
    // The formatted (not raw ISO) last-application value must appear.
    expect(screen.getByText('fmt(2026-08-20T10:00:00Z)')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2) // no customer + no last-application for v2
  })

  it('navigates to the vacancy applicants tab on row click', async () => {
    const onNavigate = vi.fn()
    render(<VacanciesAttentionTable rows={rows} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByText('Verpleegkundige'))
    expect(onNavigate).toHaveBeenCalledWith('vacancies', { open: 'v1', tab: 'applicants' })
  })
})
