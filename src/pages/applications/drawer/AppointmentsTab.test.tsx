import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppointmentsTab from './AppointmentsTab'
import api from '@/lib/api'
import type { ApplicationDetail } from '@/types/application'

// The composer persists via POST → stub the api client.
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(() => Promise.resolve({ data: {} })) } }))
// Stub useDateFormat so it doesn't transitively init i18n (keeps t() returning keys).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, locale: 'nl-NL' }) }))
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const app = (over: Partial<ApplicationDetail> = {}) =>
  ({ id: 5, candidateId: 'c1', appointments: [], ...over } as unknown as ApplicationDetail)

describe('AppointmentsTab', () => {
  it('shows the empty state with a CTA', () => {
    render(<AppointmentsTab application={app()} />)
    expect(screen.getByText('appointments.empty')).toBeInTheDocument()
    expect(screen.getByText('appointments.new')).toBeInTheDocument()
  })

  it('opens the composer and posts a new appointment', async () => {
    const user = userEvent.setup()
    mockPost.mockClear()
    render(<AppointmentsTab application={app()} />)
    await user.click(screen.getByText('appointments.new'))
    fireEvent.change(screen.getByLabelText('appointments.datetime'), { target: { value: '2026-07-10T14:30' } })
    await user.click(screen.getByTitle('appointments.save'))
    expect(mockPost).toHaveBeenCalledWith('/candidates/c1/appointments',
      expect.objectContaining({ application_id: 5, scheduled_at: '2026-07-10T14:30' }))
  })

  it('disables the new-appointment button without a candidate link', () => {
    render(<AppointmentsTab application={app({ candidateId: null })} />)
    expect(screen.getByText('appointments.new').closest('button')).toBeDisabled()
  })
})
