/**
 * OutreachDrawer — the enkelstuks-sweep archived state: an archived bellijst shows
 * the shared ArchivedBanner with a working per-id restore, skips the guaranteed-404
 * detail fetch, renders the row's fallback name and hides the owner picker (its
 * PATCH 404s on a soft-deleted record). (The live seed has no archived campaigns,
 * so this wiring is verified here.)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text.
import '@/i18n'
import OutreachDrawer from './OutreachDrawer'

// The detail hook is the drawer's only data source — stub it and observe the id it gets.
const { detailMock } = vi.hoisted(() => ({ detailMock: vi.fn() }))
vi.mock('./hooks/useOutreachDetail', () => ({
  useOutreachDetail: (id: string | null) => {
    detailMock(id)
    return { detail: null, loading: false, error: false, setTargetStatus: vi.fn(), setTargetOutcome: vi.fn(), setOwner: vi.fn(), setCustomFields: vi.fn() }
  },
}))
// The targets tab has its own data needs — out of scope for the drawer wiring test.
vi.mock('./drawer/TargetsTab', () => ({ default: () => null }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))

describe('OutreachDrawer — archived state', () => {
  it('skips the 404 fetch, shows fallback name + banner, and fires the per-id restore', () => {
    const onRestore = vi.fn()
    render(<OutreachDrawer id="c1" archived fallbackName="Bellijst Zorg" fallbackStatus="active"
      onRestore={onRestore} onClose={() => {}} />)
    // Archived → the hook receives null (no fetch), the row's name stands in.
    expect(detailMock).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('Bellijst Zorg')).toBeInTheDocument()
    // Banner line + subtitle both say archived; the owner picker is hidden.
    expect(screen.getAllByText('Gearchiveerd').length).toBeGreaterThan(0)
    expect(screen.queryByText('Eigenaar')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Herstellen' }))
    expect(onRestore).toHaveBeenCalledWith('c1')
  })

  it('fetches + shows the owner picker and no banner for an active campaign', () => {
    render(<OutreachDrawer id="c2" onClose={() => {}} />)
    expect(detailMock).toHaveBeenLastCalledWith('c2')
    expect(screen.queryByText('Gearchiveerd')).toBeNull()
    expect(screen.getByText('Eigenaar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Herstellen' })).toBeNull()
  })
})
