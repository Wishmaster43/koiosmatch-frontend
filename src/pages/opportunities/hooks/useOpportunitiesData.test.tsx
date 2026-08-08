/**
 * useOpportunitiesData — regression test for ARCHIVE-1 (2026-07-18): now that
 * OpportunityResource serializes archived/deleted_at and the controller's
 * include_archived flag is real, the hook must (a) only send ?include_archived=1
 * when asked and (b) actually refetch — not silently reuse the cached page —
 * when the flag flips (the query key carries it), so the toggle never looks
 * broken (mirrors the fake-toggle bug this sweep fixed).
 *
 * Also covers the optimistic-update bug class (measured audit 2026-07-27, see the
 * handleMove describe block below): a rejected board move used to only toast, with
 * no revert, leaving the card sitting in the new column as if the server had
 * accepted it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOpportunitiesData, OPPORTUNITIES_MAX_PER_PAGE } from './useOpportunitiesData'

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const DEFAULT_STAGE_COLOR = '#9CA3AF'
vi.mock('@/lib/useOpportunityStages', () => ({ useOpportunityStages: vi.fn() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

import api from '@/lib/api'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { notifyError } from '@/lib/notify'
const mockedGet = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)
const mockedStages = vi.mocked(useOpportunityStages)

// react-query needs a client in the tree; retry:false keeps failed-fetch tests fast.
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Default (empty) stage lookup for every test; the handleMove suite below
// overrides it with real stage/id pairs so the PATCH branch (`if (s?.id)`) fires.
beforeEach(() => {
  mockedStages.mockReturnValue({ stages: [], stageMeta: () => ({ value: '', label: '', color: DEFAULT_STAGE_COLOR }) })
})

// Each test's own react-query cache is fresh, but the mocked api.get call log
// is module-level — reset it so `.mock.calls.find` never picks up a PRIOR test's call.
afterEach(() => vi.clearAllMocks())

describe('useOpportunitiesData · ARCHIVE-1', () => {
  it('fetches the default (active-only) list with no include_archived param', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    // Fixed 2026-08-05 (audit: "rows per page niet overal toegepast") — every
    // request now carries page/per_page (fetch-all loop, see the hook's header
    // comment): the OLD unpaginated call silently truncated to the backend's
    // default 25. `include_archived` still stays absent by default.
    expect(oppCall?.[1]?.params).toEqual({ per_page: OPPORTUNITIES_MAX_PER_PAGE, page: 1 })
  })

  it('sends include_archived: 1 (numeric, not a JS boolean) when the toggle is on', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toEqual({ include_archived: 1, per_page: OPPORTUNITIES_MAX_PER_PAGE, page: 1 })
  })

  it('maps archived + deleted_at rows through so the table can chip them', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/opportunities') {
        return Promise.resolve({ data: { data: [
          { id: 'o1', title: 'Deal A', archived: true, deleted_at: '2026-07-10T00:00:00Z' },
        ] } })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    const { result } = renderHook(() => useOpportunitiesData(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows[0]).toMatchObject({ archived: true, archivedAt: '2026-07-10T00:00:00Z' })
  })
})

// VESTIGING-2: explicit branch filter (inherited from the customer) — sent as
// server-side ?branch_id[]=, a narrowing only. Off (empty) by default so a
// caller that doesn't pass branchIds keeps the pre-VESTIGING-2 request shape.
describe('useOpportunitiesData · branch filter (VESTIGING-2)', () => {
  it('sends no branch_id when no branch is picked (default second argument)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toEqual({ per_page: OPPORTUNITIES_MAX_PER_PAGE, page: 1 })
  })

  it('sends branch_id as an array of the picked ids', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(false, ['b1', 'b2']), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toEqual({ branch_id: ['b1', 'b2'], per_page: OPPORTUNITIES_MAX_PER_PAGE, page: 1 })
  })

  it('combines include_archived and branch_id when both are active', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(true, ['b1']), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toEqual({ include_archived: 1, branch_id: ['b1'], per_page: OPPORTUNITIES_MAX_PER_PAGE, page: 1 })
  })
})

/**
 * NUMMER-1 — typing a reference number (KA-00042) must reach the server as an exact
 * `?ref=` lookup instead of staying a client-side text filter over the loaded page.
 * These assert the REQUEST (route + params): OpportunityQuery returns early on `ref`,
 * so a dropped param silently degrades to "search whatever happens to be loaded".
 */
describe('useOpportunitiesData · reference-number lookup (NUMMER-1)', () => {
  it('sends no ref by default — the plain list request carries no ref key', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect((oppCall?.[1]?.params as Record<string, unknown>)?.ref).toBeUndefined()
  })

  it('sends ?ref= when the search box holds a reference number', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(false, [], 'KA-00042'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toEqual({ ref: 'KA-00042' })
  })

  it('combines ref with include_archived so an archived deal is findable by its number', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunitiesData(true, [], 'KA-00042'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const oppCall = mockedGet.mock.calls.find(c => c[0] === '/opportunities')
    expect(oppCall?.[1]?.params).toEqual({ include_archived: 1, ref: 'KA-00042' })
  })

  it('refetches instead of reusing the cached page when the reference query changes', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result, rerender } = renderHook(
      ({ ref }: { ref: string | null }) => useOpportunitiesData(false, [], ref),
      { wrapper, initialProps: { ref: null as string | null } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ ref: 'KA-00042' })
    await waitFor(() => expect(
      mockedGet.mock.calls.some(c => (c[1] as { params?: Record<string, unknown> })?.params?.ref === 'KA-00042'),
    ).toBe(true))
  })

  it('maps the reference number through so the table column can render it', async () => {
    mockedGet.mockImplementation((url: string) => url === '/opportunities'
      ? Promise.resolve({ data: { data: [{ id: 'o1', title: 'Deal A', reference_number: 'KA-00042' }] } })
      : Promise.resolve({ data: { data: [] } }))
    const { result } = renderHook(() => useOpportunitiesData(false, [], 'KA-00042'), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.rows[0].referenceNumber).toBe('KA-00042')
  })
})

describe('useOpportunitiesData · tags PATCH (audit finding: tags never persisted)', () => {
  it('sends { tags } in the PATCH body when the drawer edits tags', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'o1', title: 'Deal A', tags: ['foo'] }] } })
    mockedPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Mirrors OpportunityDrawer's setTagsAndSave: onUpdate(id, { tags: next }).
    result.current.updateOpportunity('o1', { tags: ['foo', 'bar'] })

    await waitFor(() => expect(mockedPatch).toHaveBeenCalled())
    expect(mockedPatch).toHaveBeenCalledWith('/opportunities/o1', { tags: ['foo', 'bar'] })
  })
})

describe('useOpportunitiesData · description PATCH (OPP-DESCRIPTION-1)', () => {
  it('sends { description } in the PATCH body when the drawer\'s Kanstekst block saves', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'o1', title: 'Deal A', description: null }] } })
    mockedPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Mirrors OpportunityDescriptionBlock's onSave: onUpdate(id, { description: html }).
    result.current.updateOpportunity('o1', { description: '<p>Kanstekst</p>' })

    await waitFor(() => expect(mockedPatch).toHaveBeenCalled())
    expect(mockedPatch).toHaveBeenCalledWith('/opportunities/o1', { description: '<p>Kanstekst</p>' })
  })

  it('sends { description: null } when the block is cleared back to empty', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'o1', title: 'Deal A', description: '<p>Was here</p>' }] } })
    mockedPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    result.current.updateOpportunity('o1', { description: null })

    await waitFor(() => expect(mockedPatch).toHaveBeenCalled())
    expect(mockedPatch).toHaveBeenCalledWith('/opportunities/o1', { description: null })
  })
})

// Regression coverage for the optimistic-update bug class (measured audit
// 2026-07-27): handleMove used to `.catch(() => notifyError(...))` with no revert,
// so a rejected board move (a backend stage-transition guard) left the card sitting
// in the new column as if the server had accepted it. Real stage/id pairs are wired
// in via mockedStages so the PATCH branch (`if (s?.id)`) actually fires.
describe('useOpportunitiesData · handleMove (board drag revert-on-failure)', () => {
  const wireStages = () => mockedStages.mockReturnValue({
    stages: [{ value: 'lead', label: 'Lead', color: DEFAULT_STAGE_COLOR, id: 's1' }, { value: 'won', label: 'Won', color: DEFAULT_STAGE_COLOR, id: 's2' }],
    stageMeta: (v?: string | null) => (v === 'won'
      ? { value: 'won', label: 'Won', color: DEFAULT_STAGE_COLOR }
      : { value: 'lead', label: 'Lead', color: DEFAULT_STAGE_COLOR }),
  })

  it('PATCHes the target stage id and keeps the new stage when the server accepts', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'o1', title: 'Deal A', stage: { value: 'lead', label: 'Lead', color: DEFAULT_STAGE_COLOR } }] } })
    mockedPatch.mockResolvedValue({})
    wireStages()
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleMove('o1', 'won') })
    expect(mockedPatch).toHaveBeenCalledWith('/opportunities/o1', { opportunity_stage_id: 's2' })
    await waitFor(() => expect(result.current.rows[0].stageValue).toBe('won'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts ONLY the stage fields and reports the server message when the PATCH fails', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'o1', title: 'Deal A', stage: { value: 'lead', label: 'Lead', color: DEFAULT_STAGE_COLOR } }] } })
    mockedPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Fase mag niet worden overgeslagen' } } })
    wireStages()
    const { result } = renderHook(() => useOpportunitiesData(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    // React Query's notifyManager batches cache notifications onto a microtask, so
    // the optimistic frame and its immediate revert (the mock rejects right away)
    // aren't reliably observable as two separate synchronous snapshots here — assert
    // the settled end-state instead: reverted stage, untouched title, server message.
    act(() => { result.current.handleMove('o1', 'won') })
    await waitFor(() => expect(result.current.rows[0].stageValue).toBe('lead')) // reverted
    expect(result.current.rows[0].title).toBe('Deal A') // untouched field survives the revert
    expect(notifyError).toHaveBeenCalledWith('Fase mag niet worden overgeslagen')
  })
})
