import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppointmentsTab from './AppointmentsTab'
import api from '@/lib/api'
import type { ApplicationDetail } from '@/types/application'

// The tab loads /candidates/{id}/appointments and books/edits via the shared
// PlanIntakeModal — stub both so this file only tests AppointmentsTab's own wiring
// (loading/error/empty/filter/display), not the modal's internals.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useAppointmentTypes', () => ({
  useAppointmentTypes: () => ({ metaOf: (v?: string) => (v ? { label: `Type:${v}` } : undefined) }),
}))
interface StubModalProps {
  candidateId?: string; applicationId?: string | null; defaultVacancyId?: string | null
  mode?: string; existing?: { id?: string }
}
vi.mock('@/pages/candidates/drawer/PlanIntakeModal', () => ({
  default: (props: StubModalProps) => (
    <div data-testid="plan-intake-modal">
      <span data-testid="modal-props">{JSON.stringify({
        candidateId: props.candidateId, applicationId: props.applicationId,
        defaultVacancyId: props.defaultVacancyId, mode: props.mode,
        existingId: props.existing?.id ?? null,
      })}</span>
    </div>
  ),
}))

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

const app = (over: Partial<ApplicationDetail> = {}) =>
  ({ id: 5, candidateId: 'c1', vacancyId: 'v9', appointments: [], ...over } as unknown as ApplicationDetail)

describe('AppointmentsTab', () => {
  it('shows a loading state while the shared appointments entity is fetched', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<AppointmentsTab application={app()} />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('shows an error state with a retry when the load fails', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    render(<AppointmentsTab application={app()} />)
    await waitFor(() => expect(screen.getByText('appointments.loadError')).toBeInTheDocument())
    expect(screen.getByText('common:error.retry')).toBeInTheDocument()
  })

  it('shows the empty state with a CTA when there are no linked appointments', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<AppointmentsTab application={app()} />)
    await waitFor(() => expect(screen.getByText('appointments.empty')).toBeInTheDocument())
    expect(screen.getByText('appointments.new')).toBeInTheDocument()
  })

  it('disables the new-appointment button without a candidate link', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<AppointmentsTab application={app({ candidateId: null })} />)
    await waitFor(() => expect(screen.getByText('appointments.new').closest('button')).toBeDisabled())
  })

  it('opens the shared modal in create mode with applicationId + defaultVacancyId wired', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    const user = userEvent.setup()
    render(<AppointmentsTab application={app()} />)
    await waitFor(() => screen.getByText('appointments.new'))
    await user.click(screen.getByText('appointments.new'))
    const shown = JSON.parse(screen.getByTestId('modal-props').textContent || '{}')
    expect(shown).toEqual({ candidateId: 'c1', applicationId: 5, defaultVacancyId: 'v9', mode: 'appointment', existingId: null })
  })

  it('filters the candidate-wide list to this application and renders formatted rows', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          { id: 'a1', application_id: 5, type: 'intake_flex', scheduled_at: '2026-07-15T10:45:00+00:00', duration_min: 30, modality: 'office', owner: { id: 'u1', name: 'Jill' }, location_name: 'HQ Amsterdam', status: 'planned' },
          { id: 'a2', application_id: 999, type: 'intake_flex', scheduled_at: '2026-07-15T10:45:00+00:00', status: 'planned' },
        ],
      },
    })
    render(<AppointmentsTab application={app()} />)
    await waitFor(() => expect(screen.getAllByText('Type:intake_flex')).toHaveLength(1))
    expect(screen.getByText('appointments.statusPlanned')).toBeInTheDocument()
    expect(screen.getByText('HQ Amsterdam')).toBeInTheDocument()
  })

  it('opens the shared modal in edit mode, prefilled, when the pencil is clicked', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          { id: 'a1', application_id: 5, type: 'intake_flex', scheduled_at: '2026-07-15T10:45:00+00:00', duration_min: 30, modality: 'office', owner: { id: 'u1', name: 'Jill' }, status: 'planned' },
        ],
      },
    })
    const user = userEvent.setup()
    render(<AppointmentsTab application={app()} />)
    await waitFor(() => screen.getByText('Type:intake_flex'))
    await user.click(screen.getByLabelText('common:edit'))
    const shown = JSON.parse(screen.getByTestId('modal-props').textContent || '{}')
    expect(shown.existingId).toBe('a1')
    expect(shown.mode).toBe('appointment')
  })
})
