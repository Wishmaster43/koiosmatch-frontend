import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApplicationTab from './ApplicationTab'
import type { ApplicationDetail } from '@/types/application'

// RejectionBlock fetches the reasons on mount → stub the api client.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }))

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
})
