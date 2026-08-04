/**
 * OutreachPage · + Bellijst wiring (Danny 27-07: "+ Bellijst is geen
 * popup???"). The create flow used to swap the whole page for an inline
 * view; it must now open OutreachCreate as an overlay MODAL while the list
 * stays mounted behind it. Heavy/presentational children (insights row,
 * table, board, bulk bar, drawer) are stubbed — this test only covers the
 * page's open/close wiring. The modal's own submit/validation/payload
 * behaviour is covered separately in OutreachCreate.test.tsx.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import OutreachPage from './OutreachPage'
import type { Campaign } from './hooks/useOutreachCampaigns'

const CAMPAIGNS: Campaign[] = [{ id: 'c1', name: 'Bellijst A', channel: 'call', status: 'active', targets_count: 3 }]
// The real (now-unmocked) PaginationBar footer pulls the shared i18n singleton into
// this test's module graph, so `t()` resolves real strings everywhere in the page
// (it used to fall back to the raw key before PaginationBar existed on this page) —
// look the button name up for real, mirrors OpportunitiesPage.test.tsx's `cm` helper.
const newButtonLabel = i18n.t('new', { ns: 'outreach' })

// Auth/permissions — archive/restore both allowed so the toolbar renders in full.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
// The campaign list hook is network-backed — mocked directly (page wiring only).
vi.mock('./hooks/useOutreachCampaigns', () => ({
  useOutreachCampaigns: () => ({ campaigns: CAMPAIGNS, loading: false, error: false, reload: vi.fn(), add: vi.fn(), patch: vi.fn(), drop: vi.fn() }),
  OUTREACH_MAX_PER_PAGE: 200,
}))
vi.mock('./data/outreachApi', () => ({
  listCampaigns: vi.fn(() => Promise.resolve({ rows: [] })),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  restoreCampaign: vi.fn(),
  // Used by the real OutreachCreate modal rendered inside this page.
  createCampaign: vi.fn(() => Promise.resolve({ id: 'c2', name: 'New' })),
}))
// OutreachCreate's own /pools fetch for the source-pool picker.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }))
// Presentational/heavy children are out of scope for this wiring test.
vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/QuickViewToggle', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewModeToggle', () => ({ default: () => null }))
vi.mock('./OutreachList', () => ({ default: () => <div data-testid="outreach-list-stub" /> }))
vi.mock('./OutreachBoard', () => ({ default: () => null }))
vi.mock('./OutreachBulkBar', () => ({ default: () => null }))
vi.mock('./OutreachDrawer', () => ({ default: () => null }))

describe('OutreachPage · + Bellijst opens a modal, not a full-page swap', () => {
  it('the list is mounted before "+" is clicked', () => {
    render(<OutreachPage />)
    expect(screen.getByTestId('outreach-list-stub')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"+" opens OutreachCreate as an overlay dialog, with the list still mounted behind it', async () => {
    const user = userEvent.setup()
    render(<OutreachPage />)
    await user.click(screen.getByRole('button', { name: newButtonLabel }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // The house complaint fixed here: the list must stay behind the overlay,
    // never be replaced by the create view (no more full-page swap).
    expect(screen.getByTestId('outreach-list-stub')).toBeInTheDocument()
  })

  it('Escape closes the modal and returns to the plain list', async () => {
    const user = userEvent.setup()
    render(<OutreachPage />)
    await user.click(screen.getByRole('button', { name: newButtonLabel }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('outreach-list-stub')).toBeInTheDocument()
  })
})
