/**
 * NotesPopoutPage — F5-uitbreiding: proves the dispatcher renders the RIGHT
 * entity page for `:entity`/`:id` (candidate/customer/vacancy), forwarding the id,
 * and falls back to an honest error state (never a blank screen, §3) for an
 * unknown/stale `:entity` segment instead of crashing or silently picking one.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotesPopoutPage from './NotesPopoutPage'

// Mutable route params the mocked useParams reads — set per test.
const { routeParams } = vi.hoisted(() => ({ routeParams: { entity: 'candidate', id: 'x-1' } }))
vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useParams: () => routeParams,
}))

// Stub every entity page — this test only proves DISPATCH, not each page's own
// four states (covered by CandidateNotesPopout/CustomerNotesPopout/VacancyNotesPopout tests).
vi.mock('./CandidateNotesPopout', () => ({ default: ({ id }: { id?: string }) => <div>candidate-page:{id}</div> }))
vi.mock('./CustomerNotesPopout', () => ({ default: ({ id }: { id?: string }) => <div>customer-page:{id}</div> }))
vi.mock('./VacancyNotesPopout', () => ({ default: ({ id }: { id?: string }) => <div>vacancy-page:{id}</div> }))

describe('NotesPopoutPage', () => {
  it('renders CandidateNotesPopout for entity=candidate, forwarding the id', () => {
    routeParams.entity = 'candidate'; routeParams.id = 'cand-1'
    render(<NotesPopoutPage />)
    expect(screen.getByText('candidate-page:cand-1')).toBeInTheDocument()
  })

  it('renders CustomerNotesPopout for entity=customer, forwarding the id', () => {
    routeParams.entity = 'customer'; routeParams.id = 'cust-1'
    render(<NotesPopoutPage />)
    expect(screen.getByText('customer-page:cust-1')).toBeInTheDocument()
  })

  it('renders VacancyNotesPopout for entity=vacancy, forwarding the id', () => {
    routeParams.entity = 'vacancy'; routeParams.id = 'vac-1'
    render(<NotesPopoutPage />)
    expect(screen.getByText('vacancy-page:vac-1')).toBeInTheDocument()
  })

  it('shows an honest error state for an unknown entity segment, never a blank screen', () => {
    routeParams.entity = 'bogus'; routeParams.id = 'x-1'
    render(<NotesPopoutPage />)
    expect(screen.getByText('popout.unknownEntity')).toBeInTheDocument()
  })
})
