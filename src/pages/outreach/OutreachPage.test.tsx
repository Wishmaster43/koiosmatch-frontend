/**
 * OutreachPage · + Bellijst wiring (Danny 27-07: "+ Bellijst is geen
 * popup???"). The create flow used to swap the whole page for an inline
 * view; it must now open OutreachCreate as an overlay MODAL while the list
 * stays mounted behind it. Heavy/presentational children (insights row,
 * table, board, bulk bar, drawer) are stubbed — this test only covers the
 * page's open/close wiring. The modal's own submit/validation/payload
 * behaviour is covered separately in OutreachCreate.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import OutreachPage from './OutreachPage'
import type { Campaign } from './hooks/useOutreachCampaigns'

const CAMPAIGNS: Campaign[] = [{ id: 'c1', name: 'Bellijst A', channel: 'call', status: 'active', targets_count: 3 }]
// Real OutreachCampaignResource shape (verified against the backend, 2026-08-13):
// the source talent pool arrives as a flat `pool_name` string, never a nested
// pool/from_pool/target_group object — the target-group filter must read exactly
// that field, not the tolerant guesswork it used to fall back on.
const CAMPAIGNS_WITH_POOL: Campaign[] = [{ id: 'c1', name: 'Bellijst A', channel: 'call', status: 'active', targets_count: 3, pool_name: 'Pool A' }]
// The real (now-unmocked) PaginationBar footer pulls the shared i18n singleton into
// this test's module graph, so `t()` resolves real strings everywhere in the page
// (it used to fall back to the raw key before PaginationBar existed on this page) —
// look the button name up for real, mirrors OpportunitiesPage.test.tsx's `cm` helper.
const newButtonLabel = i18n.t('new', { ns: 'outreach' })

// Auth/permissions — archive/restore both allowed so the toolbar renders in full.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
// The campaign list hook is network-backed — mocked directly (page wiring only).
// `currentCampaigns` is mutable so individual tests can swap in a row shape
// (e.g. one carrying `pool_name`) without a second module-scope mock.
let currentCampaigns: Campaign[] = CAMPAIGNS
vi.mock('./hooks/useOutreachCampaigns', () => ({
  useOutreachCampaigns: () => ({ campaigns: currentCampaigns, loading: false, error: false, reload: vi.fn(), add: vi.fn(), patch: vi.fn(), drop: vi.fn() }),
  OUTREACH_MAX_PER_PAGE: 200,
}))
// Right panel — captures registerFilters so the derived filter-group config
// (target-group options in particular) can be asserted directly.
const registerFilters = vi.fn()
// OUTREACH-WISKNOP: reportPageFilter is the shared ClearFiltersButton's own
// dependency (feeds the topbar filter dot) — must exist on the stub or its
// unconditional useEffect throws.
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters, unregisterFilters: vi.fn(), reportPageFilter: vi.fn() }) }))
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

beforeEach(() => { currentCampaigns = CAMPAIGNS; registerFilters.mockClear() })

describe('OutreachPage · target-group filter reads the real pool_name field', () => {
  it('derives the target-group option straight from pool_name, not a guessed shape', () => {
    currentCampaigns = CAMPAIGNS_WITH_POOL
    render(<OutreachPage />)
    const lastCall = registerFilters.mock.calls.at(-1) as [string, Array<{ key: string; options: Array<{ value: string; label: string }> }>]
    const groups = lastCall[1]
    const targetGroup = groups.find(g => g.key === 'targetGroup')
    expect(targetGroup?.options).toEqual([{ value: 'Pool A', label: 'Pool A', count: 1 }])
  })

  it('omits the target-group filter entirely when no row carries pool_name', () => {
    render(<OutreachPage />)
    const lastCall = registerFilters.mock.calls.at(-1) as [string, Array<{ key: string }>]
    expect(lastCall[1].find(g => g.key === 'targetGroup')).toBeUndefined()
  })
})

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

// OUTREACH-WISKNOP: the shared ClearFiltersButton — hidden on the default view,
// appears once a filter narrows it, and its click resets every dimension this
// page owns (mirrors ApplicationsPage's anyFilterActive/clearAllFilters parity).
describe('OutreachPage · clear-filters parity (OUTREACH-WISKNOP)', () => {
  const clearLabel = i18n.t('clearFilters', { ns: 'common' })

  it('is hidden on the default (unfiltered) view', () => {
    render(<OutreachPage />)
    expect(screen.queryByRole('button', { name: clearLabel })).not.toBeInTheDocument()
  })

  it('appears once the archived filter narrows the view, and clearing it resets that filter', async () => {
    const user = userEvent.setup()
    render(<OutreachPage />)
    const archivedGroup = (registerFilters.mock.calls.at(-1)?.[1] as Array<{ key: string; onToggle: (v: string) => void }>)
      .find(g => g.key === 'archived')!
    act(() => archivedGroup.onToggle('archived'))

    const clearBtn = await screen.findByRole('button', { name: clearLabel })
    await user.click(clearBtn)

    const lastArchivedGroup = (registerFilters.mock.calls.at(-1)?.[1] as Array<{ key: string; selected: string[] }>)
      .find(g => g.key === 'archived')!
    expect(lastArchivedGroup.selected).toEqual([])
    expect(screen.queryByRole('button', { name: clearLabel })).not.toBeInTheDocument()
  })
})
