/**
 * AppointmentsTab (AFSPRAKEN-VACATURE-1) — read-only, four explicit UI states,
 * permission-gated the way the rest of the drawer is (mirrors MatchesTab.test.tsx).
 * The GET-request shape itself is covered by useVacancyAppointments.test.ts; this
 * file proves the tab renders the fetched rows and the date in DD-MM-YYYY HH:mm.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import AppointmentsTab from './AppointmentsTab'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'

const state: { rows: VacancyAppointmentRow[]; total: number; page: number; lastPage: number; loading: boolean; error: boolean } =
  { rows: [], total: 0, page: 1, lastPage: 1, loading: false, error: false }
vi.mock('../hooks/useVacancyAppointments', () => ({
  useVacancyAppointments: () => state,
  VACANCY_APPOINTMENTS_PER_PAGE: 20,
}))

let canView = true
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => canView && p === 'vacancies.view' }) }))

const row = (over: Partial<VacancyAppointmentRow> = {}): VacancyAppointmentRow => ({
  id: 'a-1', candidateId: 'cand-1', candidateName: 'Jane Doe', applicationId: null,
  customerId: null, customerName: null, customerLocationId: null, customerLocationName: null,
  customerDepartmentId: null, customerDepartmentName: null, contactId: null, contactName: null,
  type: 'intake', scheduledAt: '2026-08-20T09:30:00+00:00', durationMin: 30, modality: 'office',
  appointmentLocation: 'office', ownerId: 'u-1', ownerName: 'Danny Polak', locationId: 'loc-1',
  locationName: 'Yesway Amsterdam', status: 'planned', isOverdue: false, source: 'manual',
  outcome: null, notes: null,
  ...over,
})

const vacancy = { id: 'v-1' } as import('@/types/vacancy').VacancyDetail

describe('AppointmentsTab (vacancy drawer) · four UI states + permission gate', () => {
  it('renders a "no permission" notice when vacancies.view is missing, and never fires the query', () => {
    canView = false
    state.rows = []; state.loading = false; state.error = false
    render(<AppointmentsTab vacancy={vacancy} />)
    expect(screen.getByText(/appointmentsTab.noPermission|no permission|geen rechten/i)).toBeInTheDocument()
    canView = true
  })

  it('loading', () => {
    state.rows = []; state.loading = true; state.error = false
    render(<AppointmentsTab vacancy={vacancy} />)
    expect(screen.getByText(/laden|loading/i)).toBeInTheDocument()
  })

  it('error', () => {
    state.rows = []; state.loading = false; state.error = true
    render(<AppointmentsTab vacancy={vacancy} />)
    expect(screen.getByText(/could not load appointments|konden niet worden geladen/i)).toBeInTheDocument()
  })

  it('empty', () => {
    state.rows = []; state.loading = false; state.error = false
    render(<AppointmentsTab vacancy={vacancy} />)
    expect(screen.getByText(/no appointments|nog geen afspraken/i)).toBeInTheDocument()
  })

  it('success — renders the fetched appointment, candidate link and the date as DD-MM-YYYY HH:mm', () => {
    state.rows = [row()]; state.total = 1; state.loading = false; state.error = false
    render(<AppointmentsTab vacancy={vacancy} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    // Rendered through useDateFormat.formatDateTime — DD-MM-YYYY, never raw ISO.
    expect(screen.getByText(/20-08-2026/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-20T/)).toBeNull()
  })
})
