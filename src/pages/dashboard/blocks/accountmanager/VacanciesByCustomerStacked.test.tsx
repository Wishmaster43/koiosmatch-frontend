/**
 * VacanciesByCustomerStacked — asserts the series union (keyed on status_id) and
 * navigation to the customer's vacancies tab on a bar click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import VacanciesByCustomerStacked from './VacanciesByCustomerStacked'
import type { VacanciesByCustomerRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))

let captured: { onBarClick?: (row: unknown, series: unknown) => void; data?: unknown[]; series?: unknown[] } = {}
vi.mock('@/components/charts/WeeklyBarChartCard', () => ({
  default: (props: typeof captured) => { captured = props; return <div data-testid="bar" /> },
}))

const rows: VacanciesByCustomerRow[] = [
  { customer_id: 'c1', name: 'Zorggroep A', by_status: [{ status_id: 's1', label: 'Open', count: 3 }, { status_id: 's2', label: 'Draft', count: 1 }] },
  { customer_id: 'c2', name: 'Zorggroep B', by_status: [{ status_id: 's1', label: 'Open', count: 2 }] },
]

describe('VacanciesByCustomerStacked', () => {
  it('builds one series per distinct status and one row per customer', () => {
    render(<VacanciesByCustomerStacked rows={rows} onNavigate={vi.fn()} />)
    expect(captured.series).toHaveLength(2)
    expect(captured.data).toHaveLength(2)
    expect((captured.data![0] as Record<string, unknown>).name).toBe('Zorggroep A')
  })

  it('navigates to the customer vacancies tab on bar click (flat shape)', () => {
    const onNavigate = vi.fn()
    render(<VacanciesByCustomerStacked rows={rows} onNavigate={onNavigate} />)
    captured.onBarClick?.({ customerId: 'c2' }, {})
    expect(onNavigate).toHaveBeenCalledWith('customers', { open: 'c2', tab: 'vacancies' })
  })

  it('navigates to the customer vacancies tab on bar click (recharts payload shape)', () => {
    const onNavigate = vi.fn()
    render(<VacanciesByCustomerStacked rows={rows} onNavigate={onNavigate} />)
    captured.onBarClick?.({ payload: { customerId: 'c2' } }, {})
    expect(onNavigate).toHaveBeenCalledWith('customers', { open: 'c2', tab: 'vacancies' })
  })
})
