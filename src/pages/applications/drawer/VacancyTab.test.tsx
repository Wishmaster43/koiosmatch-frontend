import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import VacancyTab from './VacancyTab'
import type { ApplicationDetail } from '@/types/application'

// Stub the api client + the reused vacancy detail (avoids its lookups context).
// Keep the real unwrap/unwrapList (importActual): VacancyTab itself now unwraps a
// single resource, and useVacancyLinkOptions pulls in unwrapList — a partial mock
// left either undefined at load time.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
vi.mock('@/pages/vacancies/drawer/DetailsTab', () => ({ default: () => <div>details-tab</div> }))
vi.mock('@/context/VacancyLookupsContext', () => ({ VacancyLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Minimal application detail — only vacancyId drives this tab.
const app = (over: Partial<ApplicationDetail> = {}) => ({ id: 1, vacancyId: 7, ...over } as unknown as ApplicationDetail)

describe('VacancyTab', () => {
  // VACTAB-TEST-1 root cause (bisected 2026-07-15): `beforeEach(() => mockGet.mockReset())`
  // implicitly RETURNED the mock (mockReset() returns `this`) — vitest treats a function
  // returned from beforeEach as a cleanup hook and CALLED api.get() with no args after
  // every test, producing an unhandled 'boom' rejection that deadlocked the runner.
  // Braces (statement body, no implicit return) are load-bearing here.
  beforeEach(() => { mockGet.mockReset() })

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
