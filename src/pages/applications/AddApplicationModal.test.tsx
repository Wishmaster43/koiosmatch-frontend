/**
 * AddApplicationModal — covers S2 (Danny): the widened 720px two-column panel
 * (mirrors MatchPlacementModal) with comfortable candidate/vacancy/owner pickers.
 * Layout/CSS is not asserted pixel-by-pixel (implementation detail); this checks
 * the panel actually renders wider than the old 440px modal and that all three
 * pickers are the shared searchable CreatableSelect, never a bare `<select>`.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AddApplicationModal from './AddApplicationModal'

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' } }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ funnelTypes: [] }) }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(() => Promise.resolve({ data: { data: {} } })) },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))

describe('AddApplicationModal', () => {
  it('renders the widened 720px panel (not the old 440px width)', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    const panel = screen.getByRole('dialog')
    expect(panel).toHaveStyle({ width: '720px' })
  })

  it('renders candidate/vacancy/owner as searchable CreatableSelect pickers, never a bare <select>', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByText('add.candidate')).toBeInTheDocument()
    expect(screen.getByText('add.vacancy')).toBeInTheDocument()
    expect(screen.getByText('add.owner')).toBeInTheDocument()
    expect(document.querySelector('select')).toBeNull()
    // Three CreatableSelect toggle buttons (one per picker) — the owner one already
    // shows the pre-selected logged-in user's name (APP-OWNER-1 default).
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()
    expect(document.querySelectorAll('button[type="button"]').length).toBe(3)
  })

  it('shows the vacancy as a locked, non-editable display when opened from a vacancy', () => {
    render(<AddApplicationModal onClose={vi.fn()} onCreated={vi.fn()} lockedVacancy={{ id: 'v1', title: 'Verpleegkundige', client: 'Yesway' }} />)
    expect(screen.getByText('Verpleegkundige · Yesway')).toBeInTheDocument()
    // Locked vacancy: only 2 CreatableSelect pickers remain (candidate + owner).
    expect(document.querySelectorAll('button[type="button"]').length).toBe(2)
  })
})
