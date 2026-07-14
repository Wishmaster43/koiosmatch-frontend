import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationTab from './ApplicationTab'
import type { ApplicationDetail } from '@/types/application'

// RejectionBlock fetches the reasons on mount; the vacancy-link edit mode
// (useVacancyLinkOptions) fetches /vacancies — stub both so this file only
// tests ApplicationTab's own wiring, not either dependency's internals.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))
import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Minimal application detail for the read-only "Sollicitatie" tab.
const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, source: 'Facebook', client: 'Yesway', vacancyTitle: 'Verpleegkundige',
  bucket: 'active', score: null, matchCriteria: [], ai: {}, ...over,
} as unknown as ApplicationDetail)

describe('ApplicationTab', () => {
  it('renders the read-only details (source/client/vacancy)', () => {
    render(<ApplicationTab application={app()} />)
    expect(screen.getByText('drawer.details')).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })

  it('shows the rejection block for an active application', () => {
    render(<ApplicationTab application={app()} />)
    expect(screen.getByText('rejection.title')).toBeInTheDocument()
  })

  it('hides the rejection block once the application is a match', () => {
    render(<ApplicationTab application={app({ bucket: 'matched' })} />)
    expect(screen.queryByText('rejection.title')).toBeNull()
  })

  it('hides the Details edit pencil when onLinkVacancy is not provided', () => {
    render(<ApplicationTab application={app()} />)
    expect(screen.queryByLabelText('common:edit')).toBeNull()
  })

  it('opens the vacancy picker in edit mode, showing a diskette + cancel', async () => {
    const user = userEvent.setup()
    render(<ApplicationTab application={app()} onLinkVacancy={vi.fn()} />)
    await user.click(screen.getByLabelText('common:edit'))
    expect(screen.getByLabelText('common:save')).toBeInTheDocument()
    expect(screen.getByLabelText('common:cancel')).toBeInTheDocument()
    // The read-only vacancy value is replaced by the picker while editing.
    expect(screen.queryByText('Verpleegkundige')).toBeNull()
  })

  it('cancels the edit without calling onLinkVacancy', async () => {
    const onLinkVacancy = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationTab application={app()} onLinkVacancy={onLinkVacancy} />)
    await user.click(screen.getByLabelText('common:edit'))
    await user.click(screen.getByLabelText('common:cancel'))
    expect(screen.queryByLabelText('common:save')).toBeNull()
    expect(onLinkVacancy).not.toHaveBeenCalled()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })

  it('picks a vacancy option and saves via the shared onLinkVacancy handler', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'v2', title: 'Chirurg', client_name: 'Acme' }] } })
    const onLinkVacancy = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationTab application={app()} onLinkVacancy={onLinkVacancy} />)

    await user.click(screen.getByLabelText('common:edit'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/vacancies', { params: { per_page: 100 } }))
    // Open the searchable select (starts on the "no vacancy" entry) and pick the loaded option.
    await user.click(screen.getByRole('button', { name: 'drawer.noVacancy' }))
    await waitFor(() => screen.getByRole('button', { name: 'Chirurg · Acme' }))
    await user.click(screen.getByRole('button', { name: 'Chirurg · Acme' }))
    await user.click(screen.getByLabelText('common:save'))

    expect(onLinkVacancy).toHaveBeenCalledWith(1, 'v2', { title: 'Chirurg', client: 'Acme' })
  })
})
