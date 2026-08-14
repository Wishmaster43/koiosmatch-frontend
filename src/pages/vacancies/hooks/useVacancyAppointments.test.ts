/**
 * AFSPRAKEN-VACATURE-1: the vacancy Appointments tab must hit the dedicated
 * GET /vacancies/{id}/appointments route with pagination params, and map the
 * confirmed AppointmentResource shape correctly — mirrors useVacancyMatches.test.ts's
 * proof that the REQUEST (route + params), not just "a callback fired", is what
 * this pins (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useVacancyAppointments, VACANCY_APPOINTMENTS_PER_PAGE } from './useVacancyAppointments'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [], meta: { total: 0, current_page: 1, last_page: 1, per_page: 20 } } })) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useVacancyAppointments', () => {
  it('GETs the dedicated per-vacancy appointments route with page/per_page params', async () => {
    renderHook(() => useVacancyAppointments('vac-1', 2), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/vacancies/vac-1/appointments')
    expect(config?.params).toEqual({ page: 2, per_page: VACANCY_APPOINTMENTS_PER_PAGE })
  })

  it('never fires while no vacancyId is known yet (disabled query)', () => {
    renderHook(() => useVacancyAppointments(undefined), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('maps the confirmed AppointmentResource fields', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{
        id: 'a-1', candidate_id: 'cand-1', candidate_name: 'Jane Doe', application_id: null,
        customer_id: null, customer_name: null, customer_location_id: null, customer_location_name: null,
        customer_department_id: null, customer_department_name: null, contact_id: null, contact_name: null,
        type: 'intake', scheduled_at: '2026-08-20T09:30:00+00:00', duration_min: 30, modality: 'office',
        appointment_location: 'office', owner: { id: 'u-1', name: 'Danny Polak' }, location_id: 'loc-1',
        location_name: 'Yesway Amsterdam', status: 'planned', is_overdue: false, source: 'manual',
        outcome: null, notes: null,
      }], meta: { total: 1, current_page: 1, last_page: 1, per_page: 20 } },
    })
    const { result } = renderHook(() => useVacancyAppointments('vac-1'), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    const row = result.current.rows[0]
    expect(row.candidateId).toBe('cand-1')
    expect(row.candidateName).toBe('Jane Doe')
    expect(row.scheduledAt).toBe('2026-08-20T09:30:00+00:00')
    expect(row.ownerName).toBe('Danny Polak')
    expect(row.locationName).toBe('Yesway Amsterdam')
    expect(row.status).toBe('planned')
    expect(result.current.total).toBe(1)
  })
})
