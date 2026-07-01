import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import VacancyTab from './VacancyTab'
import type { ApplicationDetail } from '@/types/application'

// Stub the api client + the reused vacancy detail (avoids its lookups context).
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
vi.mock('@/pages/vacancies/drawer/DetailsTab', () => ({ default: () => <div>details-tab</div> }))
vi.mock('@/context/VacancyLookupsContext', () => ({ VacancyLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Minimal application detail — only vacancyId drives this tab.
const app = (over: Partial<ApplicationDetail> = {}) => ({ id: 1, vacancyId: 7, ...over } as unknown as ApplicationDetail)

describe('VacancyTab', () => {
  beforeEach(() => mockGet.mockReset())

  it('shows the empty state when no vacancy is linked', () => {
    render(<VacancyTab application={app({ vacancyId: null })} />)
    expect(screen.getByText('vacancyDetail.empty')).toBeInTheDocument()
  })

  it('shows the loading state while fetching', () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    render(<VacancyTab application={app()} />)
    expect(screen.getByText('vacancyDetail.loading')).toBeInTheDocument()
  })

  it('shows the error state when the fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    render(<VacancyTab application={app()} />)
    expect(await screen.findByText('vacancyDetail.error')).toBeInTheDocument()
  })

  it('renders the reused vacancy detail on success', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    render(<VacancyTab application={app()} />)
    expect(await screen.findByText('details-tab')).toBeInTheDocument()
  })
})
