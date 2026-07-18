/**
 * OutreachDrawer — the enkelstuks-sweep archived state: an archived bellijst shows
 * the shared ArchivedBanner (flag-only, or "Archived on {date}" once archivedAt is
 * set — W2 delivered, measured: OutreachCampaignResource carries deleted_at) with a
 * working per-id restore. W2 also delivered show() as withTrashed, so the drawer now
 * FETCHES the real detail even while archived (only the owner picker stays hidden —
 * update() is still a plain findOrFail and it's a deliberate product choice either
 * way). (The live seed has no archived campaigns, so this wiring is verified here.)
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
  it('still fetches the real detail (W2: show() is withTrashed), shows the flag-only banner, and fires the per-id restore', () => {
    const onRestore = vi.fn()
    render(<OutreachDrawer id="c1" archived fallbackName="Bellijst Zorg" fallbackStatus="active"
      onRestore={onRestore} onClose={() => {}} />)
    // Archived no longer skips the fetch — the hook still gets the real id.
    expect(detailMock).toHaveBeenLastCalledWith('c1')
    // The stubbed hook returns detail: null, so the fallback name still stands in
    // while loading.
    expect(screen.getByText('Bellijst Zorg')).toBeInTheDocument()
    // No archivedAt passed → flag-only banner; the owner picker stays hidden.
    expect(screen.getByText('Gearchiveerd')).toBeInTheDocument()
    expect(screen.queryByText('Eigenaar')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Herstellen' }))
    expect(onRestore).toHaveBeenCalledWith('c1')
  })

  // W2 delivered (measured): OutreachCampaignResource now carries deleted_at — the
  // banner upgrades from the flag-only line to the dated one once it's on the record.
  it('shows the dated banner once archivedAt is set', () => {
    render(<OutreachDrawer id="c1" archived archivedAt="2026-07-10T10:00:00" fallbackName="Bellijst Zorg"
      onClose={() => {}} />)
    expect(screen.getByText('Gearchiveerd op 10-07-2026')).toBeInTheDocument()
  })

  it('fetches + shows the owner picker and no banner for an active campaign', () => {
    render(<OutreachDrawer id="c2" onClose={() => {}} />)
    expect(detailMock).toHaveBeenLastCalledWith('c2')
    expect(screen.queryByText('Gearchiveerd')).toBeNull()
    expect(screen.getByText('Eigenaar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Herstellen' })).toBeNull()
  })
})
