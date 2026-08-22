/**
 * AppointmentsTab (AFSPRAKEN-VACATURE-1, VACDRAWER-ACTIONS-1) — four explicit
 * UI states + permission gate (unchanged, mirrors MatchesTab.test.tsx), plus
 * CREATE (candidate-pick → shared PlanIntakeModal, vacancy preset) and EDIT
 * (pencil → shared PlanIntakeModal, prefilled, per-row candidateId). The
 * GET-request shape itself is covered by useVacancyAppointments.test.ts; this
 * file proves the tab renders the fetched rows, the date in DD-MM-YYYY HH:mm,
 * and wires both modals with the exact props the shared modal expects (§13:
 * assert the request/props shape, not just "a callback fired").
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import AppointmentsTab from './AppointmentsTab'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'

const state: { rows: VacancyAppointmentRow[]; total: number; page: number; lastPage: number; loading: boolean; error: boolean } =
  { rows: [], total: 0, page: 1, lastPage: 1, loading: false, error: false }
vi.mock('../hooks/useVacancyAppointments', () => ({
  useVacancyAppointments: () => state,
  VACANCY_APPOINTMENTS_PER_PAGE: 20,
}))

// Permission SET, not a boolean: viewing rides vacancies.view, while create/
// edit ride candidates.update (the routes' own gate) — tests drop either side.
let perms = new Set(['vacancies.view', 'candidates.update'])
let canView = true
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => canView && perms.has(p) }) }))

// Stub the shared modal at its DEEP path (never the barrel — CLAUDE.md §2
// TESTLES) so the barrel's other exports stay real; captures the exact props
// AppointmentsTab hands it (create AND edit both flow through this one modal).
interface StubModalProps {
  candidateId?: string; defaultVacancyId?: string | null; mode?: string
  existing?: { id?: string; scheduled_at?: string; duration_min?: number | null; owner_id?: string; type?: string; vacancy_id?: string | null; location_id?: string | null; appointment_location?: string | null }
  onCreated: () => void
}
vi.mock('@/pages/candidates/drawer/PlanIntakeModal', () => ({
  default: (props: StubModalProps) => (
    <div data-testid="plan-intake-modal">
      <span data-testid="modal-props">{JSON.stringify(props, (k, v) => (k === 'onClose' || k === 'onCreated' ? undefined : v))}</span>
      <button onClick={props.onCreated}>fire-onCreated</button>
    </div>
  ),
}))

// Stub the candidate-pick step (sibling file, its own request shape is covered
// by PickCandidateForAppointmentModal.test.tsx) — only its WIRING matters here.
interface StubPickProps { vacancyId: string; onCreated: () => void }
vi.mock('./PickCandidateForAppointmentModal', () => ({
  default: (props: StubPickProps) => (
    <div data-testid="pick-candidate-modal">
      <span data-testid="pick-props">{JSON.stringify({ vacancyId: props.vacancyId })}</span>
      <button onClick={props.onCreated}>fire-picked-created</button>
    </div>
  ),
}))

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

// AppointmentsTab now reads useQueryClient() directly (invalidate-on-save), so
// every render needs a real QueryClient ancestor.
const renderTab = () => {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  render(<QueryClientProvider client={queryClient}><AppointmentsTab vacancy={vacancy} /></QueryClientProvider>)
  return { invalidateSpy }
}

describe('AppointmentsTab (vacancy drawer) · four UI states + permission gate', () => {
  it('renders a "no permission" notice when vacancies.view is missing', () => {
    canView = false
    state.rows = []; state.loading = false; state.error = false
    renderTab()
    expect(screen.getByText(/appointmentsTab.noPermission|no permission|geen rechten/i)).toBeInTheDocument()
    canView = true
  })

  it('loading', () => {
    state.rows = []; state.loading = true; state.error = false
    renderTab()
    expect(screen.getByText(/laden|loading/i)).toBeInTheDocument()
  })

  it('error', () => {
    state.rows = []; state.loading = false; state.error = true
    renderTab()
    expect(screen.getByText(/could not load appointments|konden niet worden geladen/i)).toBeInTheDocument()
  })

  it('empty', () => {
    state.rows = []; state.loading = false; state.error = false
    renderTab()
    expect(screen.getByText(/no appointments|nog geen afspraken/i)).toBeInTheDocument()
  })

  it('success — renders the fetched appointment, candidate link and the date as DD-MM-YYYY HH:mm', () => {
    state.rows = [row()]; state.total = 1; state.loading = false; state.error = false
    renderTab()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    // Rendered through useDateFormat.formatDateTime — DD-MM-YYYY, never raw ISO.
    expect(screen.getByText(/20-08-2026/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-20T/)).toBeNull()
  })
})

describe('AppointmentsTab (vacancy drawer) · create', () => {
  it('opens the candidate-pick step with THIS vacancy id, then invalidates the cached list once a candidate is picked and the appointment is created', async () => {
    state.rows = [row()]; state.total = 1; state.loading = false; state.error = false
    const user = userEvent.setup()
    const { invalidateSpy } = renderTab()
    await user.click(screen.getByRole('button', { name: /nieuwe afspraak/i }))
    expect(screen.getByTestId('pick-candidate-modal')).toBeInTheDocument()
    expect(JSON.parse(screen.getByTestId('pick-props').textContent || '{}')).toEqual({ vacancyId: 'v-1' })
    // The pick step's own onCreated fires once PlanIntakeModal succeeds inside it.
    await user.click(screen.getByText('fire-picked-created'))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vacancies', 'v-1', 'appointments'] })
    // The pick step unmounts once its own flow is done.
    expect(screen.queryByTestId('pick-candidate-modal')).not.toBeInTheDocument()
  })
})

describe('AppointmentsTab (vacancy drawer) · edit', () => {
  it('opens the shared modal in edit mode with the ROW\'s own candidateId + prefilled fields, and invalidates on save', async () => {
    state.rows = [row()]; state.total = 1; state.loading = false; state.error = false
    const user = userEvent.setup()
    const { invalidateSpy } = renderTab()
    await user.click(screen.getByLabelText(/bewerken|^edit$/i))
    const shown = JSON.parse(screen.getByTestId('modal-props').textContent || '{}')
    expect(shown.candidateId).toBe('cand-1')
    expect(shown.mode).toBe('appointment')
    expect(shown.existing).toEqual({
      id: 'a-1', scheduled_at: '2026-08-20T09:30:00+00:00', duration_min: 30,
      modality: 'office', owner_id: 'u-1', type: 'intake',
      vacancy_id: 'v-1', location_id: 'loc-1', appointment_location: 'office',
    })
    await user.click(screen.getByText('fire-onCreated'))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vacancies', 'v-1', 'appointments'] })
    expect(screen.queryByTestId('plan-intake-modal')).not.toBeInTheDocument()
  })

  it('offers no edit pencil for a row without a linked candidate (no /candidates/{id}/appointments/{id} route to PATCH)', async () => {
    state.rows = [row({ id: 'a-2', candidateId: null, candidateName: null })]; state.total = 1; state.loading = false; state.error = false
    renderTab()
    await waitFor(() => expect(screen.getByText(/no candidate|geen kandidaat/i)).toBeInTheDocument())
    expect(screen.queryByLabelText(/bewerken|^edit$/i)).not.toBeInTheDocument()
  })

  // Opus F1: create/edit go through /candidates/{id}/appointments, gated
  // candidates.update — readonly/backoffice/sales hold vacancies.view WITHOUT
  // it, so neither affordance may render for them (§3: no control whose save
  // dies on a 403).
  it('hides both the + button and the edit pencil without candidates.update', async () => {
    perms = new Set(['vacancies.view'])
    state.rows = [row({})]; state.total = 1; state.loading = false; state.error = false
    renderTab()
    await waitFor(() => expect(screen.getByText(/Jane Doe/)).toBeInTheDocument())
    expect(screen.queryByText(/appointmentsTab.new/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/bewerken|^edit$/i)).not.toBeInTheDocument()
    perms = new Set(['vacancies.view', 'candidates.update'])
  })
})
