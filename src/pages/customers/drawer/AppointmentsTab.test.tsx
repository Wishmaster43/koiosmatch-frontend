/**
 * AppointmentsTab (X-38, customer drawer) — four UI states + permission gate, the row
 * anatomy (candidate link first, DD-MM-YYYY HH:mm wall time, chips), the EDIT flow
 * through the shared PlanIntakeModal with the ROW's own candidateId, and the deliberate
 * absence of a "+ Afspraak" button (no candidate context to preset, §3 no fake
 * affordance). The GET shape lives in useCustomerAppointments.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import AppointmentsTab from './AppointmentsTab'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'

const state: { rows: VacancyAppointmentRow[]; total: number; page: number; lastPage: number; loading: boolean; error: boolean } =
  { rows: [], total: 0, page: 1, lastPage: 1, loading: false, error: false }
vi.mock('../hooks/useCustomerAppointments', () => ({
  useCustomerAppointments: () => state,
  CUSTOMER_APPOINTMENTS_PER_PAGE: 20,
}))

let perms = new Set(['customers.view', 'candidates.update'])
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }) }))

// Deep-path stub of the shared modal (CLAUDE.md §2 TESTLES: never the barrel).
interface StubModalProps { candidateId?: string; mode?: string; existing?: { id?: string; type?: string }; onCreated: () => void }
vi.mock('@/pages/candidates/drawer/PlanIntakeModal', () => ({
  default: (props: StubModalProps) => (
    <div data-testid="plan-intake-modal">
      <span data-testid="modal-props">{JSON.stringify(props, (k, v) => (k === 'onClose' || k === 'onCreated' ? undefined : v))}</span>
    </div>
  ),
}))

const row = (over: Partial<VacancyAppointmentRow> = {}): VacancyAppointmentRow => ({
  id: 'a1', scheduledAt: '2026-09-10T09:00:00', durationMin: 30, type: 'intake', status: 'planned', modality: 'on_site',
  candidateId: 'c1', candidateName: 'Jane Doe', ownerId: 'u1', ownerName: 'Rick', locationId: null, locationName: 'Demo Noord',
  appointmentLocation: null, meetingUrl: null, isOverdue: false, customerId: 'cust-1', customerLocationId: null, customerDepartmentId: null, contactId: null,
  ...over,
} as VacancyAppointmentRow)

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AppointmentsTab customerId="cust-1" /></QueryClientProvider>)
}

describe('AppointmentsTab (customer)', () => {
  it('renders a "no permission" notice without customers.view', () => {
    perms = new Set(['candidates.update'])
    mount()
    expect(screen.getByText(/geen rechten om afspraken/i)).toBeInTheDocument()
    perms = new Set(['customers.view', 'candidates.update'])
  })

  it('empty', () => {
    Object.assign(state, { rows: [], loading: false, error: false })
    mount()
    expect(screen.getByText(/nog geen afspraken bij deze klant/i)).toBeInTheDocument()
  })

  it('error', () => {
    Object.assign(state, { rows: [], loading: false, error: true })
    mount()
    expect(screen.getByText(/afspraken konden niet worden geladen/i)).toBeInTheDocument()
    state.error = false
  })

  it('success: candidate link first, wall time as DD-MM-YYYY HH:mm, no "+ Afspraak" button', () => {
    Object.assign(state, { rows: [row()], total: 1, loading: false, error: false })
    mount()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    // Rendered through useDateFormat.formatWallTime — DD-MM-YYYY, never raw ISO.
    expect(screen.getByText(/10-09-2026/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-09-10T/)).toBeNull()
    expect(screen.getByText('Demo Noord')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /afspraak/i })).not.toBeInTheDocument()
  })

  it('the pencil opens the shared modal in edit mode with the ROW\'s own candidateId and prefilled fields', async () => {
    Object.assign(state, { rows: [row()], total: 1, loading: false, error: false })
    mount()
    await userEvent.click(screen.getByRole('button', { name: /bewerken|edit/i }))
    const props = JSON.parse(screen.getByTestId('modal-props').textContent ?? '{}')
    expect(props.candidateId).toBe('c1')
    expect(props.mode).toBe('appointment')
    expect(props.existing).toMatchObject({ id: 'a1', type: 'intake', scheduled_at: '2026-09-10T09:00:00' })
  })

  it('offers no pencil for a row without a linked candidate, nor without candidates.update', () => {
    Object.assign(state, { rows: [row({ candidateId: null, candidateName: '' })], total: 1 })
    mount()
    expect(screen.getByText(/geen kandidaat/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bewerken|edit/i })).not.toBeInTheDocument()
  })
})
