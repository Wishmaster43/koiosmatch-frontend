/**
 * useBackofficeCoupleBulk — the shared bulk "queue selection for backoffice
 * coupling" action (§13: asserts the real request, never only that a callback
 * fired). Covers the request shape, the plain/partial/unavailable/error outcomes,
 * and the CLAIM-1 `already_queued` third list, which must count into the summary
 * without ever reading as a failure (SHARED-UNIT-TEST-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBackofficeCoupleBulk } from './useBackofficeCoupleBulk'
import type { TFunction } from 'i18next'

const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
  isServiceUnavailable: (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 503,
}))

// A minimal translate stub that echoes the key with its interpolation params so
// assertions can read the exact values passed to i18n without a real i18next tree.
const t = ((key: string, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params ?? {})}`) as unknown as TFunction

// Builds a default fixture — named `useX` is required by the lint rule even
// though this is a plain factory, since it calls the `useBackofficeCoupleBulk` hook.
function useBuildFixture() {
  const notify = vi.fn()
  const setSelectedIds = vi.fn()
  const action = useBackofficeCoupleBulk({
    entity: 'candidates',
    selectedIds: new Set(['a', 'b']),
    setSelectedIds,
    notify,
    t,
    targetLabel: (target) => target,
  })
  return { notify, setSelectedIds, action }
}

beforeEach(() => { vi.clearAllMocks() })

describe('useBackofficeCoupleBulk · request shape', () => {
  it('POSTs /sync/{entity}/bulk with the selected ids and system, and clears the selection immediately', () => {
    mockPost.mockResolvedValue({ data: { queued: ['a', 'b'], skipped: [] } })
    const { action, setSelectedIds } = useBuildFixture()
    action('helloflex')
    expect(mockPost).toHaveBeenCalledWith('/sync/candidates/bulk', { ids: ['a', 'b'], system: 'helloflex' })
    expect(setSelectedIds).toHaveBeenCalledWith(new Set())
  })

  it('does nothing when the selection is empty', () => {
    const notify = vi.fn()
    const action = useBackofficeCoupleBulk({
      entity: 'candidates', selectedIds: new Set(), setSelectedIds: vi.fn(), notify, t,
      targetLabel: (target) => target,
    })
    action('helloflex')
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('useBackofficeCoupleBulk · plain outcomes', () => {
  it('shows a plain success toast when everything queued', async () => {
    mockPost.mockResolvedValue({ data: { queued: ['a', 'b'], skipped: [] } })
    const { action, notify } = useBuildFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('success', t('bulk.coupleQueued', { target: 'helloflex', count: 2 }))
  })

  it('shows the partial toast (warning tone by default) when some rows were skipped', async () => {
    mockPost.mockResolvedValue({ data: { queued: ['a'], skipped: ['b'] } })
    const { action, notify } = useBuildFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('warning', t('bulk.coupleQueuedPartial', { target: 'helloflex', queued: 1, total: 2, skipped: 1 }))
  })

  it('maps a 404/503 to the "unavailable" info toast, never a hard error', async () => {
    mockPost.mockRejectedValue({ response: { status: 503 } })
    const { action, notify } = useBuildFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('info', t('bulk.coupleUnavailable', undefined))
  })

  it('maps any other error to the generic mutate-error toast', async () => {
    mockPost.mockRejectedValue(new Error('boom'))
    const { action, notify } = useBuildFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('error', t('bulk.mutateError', undefined))
  })
})

describe('useBackofficeCoupleBulk · CLAIM-1 already_queued third list', () => {
  it('counts already_queued into the total and the partial summary, never as a failure', async () => {
    mockPost.mockResolvedValue({ data: { queued: ['a'], skipped: ['b'], already_queued: ['c'] } })
    const { action, notify } = useBuildFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('warning', t('bulk.coupleQueuedPartialAlreadyQueued', { target: 'helloflex', queued: 1, total: 3, already: 1, skipped: 1 }))
  })

  it('takes the already_queued branch even with zero skipped rows', async () => {
    mockPost.mockResolvedValue({ data: { queued: ['a'], skipped: [], already_queued: ['b', 'c'] } })
    const { action, notify } = useBuildFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('warning', t('bulk.coupleQueuedPartialAlreadyQueued', { target: 'helloflex', queued: 1, total: 3, already: 2, skipped: 0 }))
  })

  it('respects the partialTone override (matches uses info) for the already_queued branch too', async () => {
    mockPost.mockResolvedValue({ data: { queued: ['a'], skipped: [], already_queued: ['b'] } })
    const notify = vi.fn()
    const action = useBackofficeCoupleBulk({
      entity: 'matches', selectedIds: new Set(['a', 'b']), setSelectedIds: vi.fn(), notify, t,
      targetLabel: (target) => target, partialTone: 'info',
    })
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('info', expect.stringContaining('coupleQueuedPartialAlreadyQueued'))
  })

  it('does not take the already_queued branch when the field is absent (today\'s plain shape stays byte-identical)', async () => {
    mockPost.mockResolvedValue({ data: { queued: ['a'], skipped: ['b'] } })
    const { action, notify } = useBuildFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).not.toHaveBeenCalledWith('warning', expect.stringContaining('AlreadyQueued'))
  })

  it('uses the Reasoned variant when already_queued AND skipped are both present and reasonBreakdown resolves', async () => {
    mockPost.mockResolvedValue({ data: { queued: ['a'], skipped: ['b'], already_queued: ['c'] } })
    const notify = vi.fn()
    const reasonBreakdown = vi.fn(() => 'no HelloFlex contract type mapped')
    const action = useBackofficeCoupleBulk({
      entity: 'matches', selectedIds: new Set(['a', 'b', 'c']), setSelectedIds: vi.fn(), notify, t,
      targetLabel: (target) => target, reasonBreakdown,
    })
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(reasonBreakdown).toHaveBeenCalledWith(['b'])
    expect(notify).toHaveBeenCalledWith('warning', t('bulk.coupleQueuedPartialAlreadyQueuedReasoned', { target: 'helloflex', queued: 1, total: 3, already: 1, skipped: 1, breakdown: 'no HelloFlex contract type mapped' }))
  })
})

describe('useBackofficeCoupleBulk · buildRequest and moduleGatedTargets overrides', () => {
  // Builds a hook with a HelloFlex-only route override and module gating, like matches.
  function useGatedFixture() {
    const notify = vi.fn()
    const action = useBackofficeCoupleBulk({
      entity: 'matches', selectedIds: new Set(['a', 'b']), setSelectedIds: vi.fn(), notify, t,
      targetLabel: (target) => target,
      buildRequest: (system, ids) => system === 'helloflex' ? { url: '/matches/bulk/couple', body: { match_ids: ids, target: system } } : null,
      moduleGatedTargets: ['helloflex'],
    })
    return { notify, action }
  }

  it('posts the overridden route and body for the overridden target', () => {
    mockPost.mockResolvedValue({ data: { queued: ['a', 'b'], skipped: [] } })
    useGatedFixture().action('helloflex')
    expect(mockPost).toHaveBeenCalledWith('/matches/bulk/couple', { match_ids: ['a', 'b'], target: 'helloflex' })
  })

  it('falls back to the generic sync route when buildRequest returns null', () => {
    mockPost.mockResolvedValue({ data: { queued: ['a', 'b'], skipped: [] } })
    useGatedFixture().action('shiftmanager')
    expect(mockPost).toHaveBeenCalledWith('/sync/matches/bulk', { ids: ['a', 'b'], system: 'shiftmanager' })
  })

  it('reads a 403 on a gated target as module-off, but not on an ungated one', async () => {
    mockPost.mockRejectedValue({ response: { status: 403 } })
    const gated = useGatedFixture()
    gated.action('helloflex')
    await vi.waitFor(() => expect(gated.notify).toHaveBeenCalled())
    expect(gated.notify).toHaveBeenCalledWith('error', t('bulk.coupleModuleOff', undefined))
    const ungated = useGatedFixture()
    ungated.action('shiftmanager')
    await vi.waitFor(() => expect(ungated.notify).toHaveBeenCalled())
    expect(ungated.notify).toHaveBeenCalledWith('error', t('bulk.mutateError', undefined))
  })

  it('reads a 409 helloflex_contracts_disabled on a gated target as the contracts-off toast', async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { code: 'helloflex_contracts_disabled' } } })
    const { action, notify } = useGatedFixture()
    action('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('error', t('bulk.coupleContractsDisabled', undefined))
  })

  it('feeds a reason_code skip list to reasonBreakdown and uses the reasoned partial toast', async () => {
    const skipped = [{ id: 'b', reason: 'needs_contract_fields', reason_code: 'helloflex_start_date_missing' }]
    mockPost.mockResolvedValue({ data: { queued: ['a'], skipped } })
    const notify = vi.fn()
    const reasonBreakdown = vi.fn(() => '1 helloflex_start_date_missing')
    useBackofficeCoupleBulk({
      entity: 'matches', selectedIds: new Set(['a', 'b']), setSelectedIds: vi.fn(), notify, t,
      targetLabel: (target) => target, reasonBreakdown,
    })('helloflex')
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(reasonBreakdown).toHaveBeenCalledWith(skipped)
    expect(notify).toHaveBeenCalledWith('warning', t('bulk.coupleQueuedPartialReasoned', { target: 'helloflex', queued: 1, total: 2, skipped: 1, breakdown: '1 helloflex_start_date_missing' }))
  })
})
