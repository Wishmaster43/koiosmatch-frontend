/** useApplicationDrawerActions · detail selection, source and restore handlers (split from useApplicationDrawerActions.test.ts; fixtures in useApplicationDrawerActions.testKit.ts). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useApplicationDrawerActions } from './useApplicationDrawerActions'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { FUNNEL, app, detail, t } from './useApplicationDrawerActions.testKit'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn(), patch: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

// Harness with real state so the optimistic update → reconcile/revert is observable.
// `opts.users` is only needed by the handleOwner tests; every other suite keeps the
// original empty default so existing behaviour stays unchanged.
function harness(initial: Application[], opts: { users?: Array<{ id: Id; name: string }> } = {}) {
  return renderHook(() => {
    const [applications, setApplications] = useState<Application[]>(initial)
    const [, setTotal] = useState(initial.length)
    const actions = useApplicationDrawerActions({
      applications, wideRows: [], setApplications, setTotal,
      funnelTypes: FUNNEL, users: opts.users ?? [], bucket: 'active',
      decorate: <T,>(a: T) => a, t,
    })
    return { applications, actions }
  })
}

/**
 * MOTIVATIE-ZICHTBAAR-1 — the seam that actually carries the motivation letter.
 * ApplicationListResource omits `cover_letter` entirely, so the row the table already
 * holds can NEVER supply it: the drawer's own detail GET is the only delivery path.
 * These assert the request itself (route + params) and that the response's field lands
 * on the open drawer — not merely that some handler ran.
 */
describe('useApplicationDrawerActions · selectApplication (motivation delivery)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GETs /applications/{id} with include_archived=1 and lands cover_letter on the drawer', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 1, cover_letter: '<p>Waarom ik solliciteer</p>' } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.selectApplication(app()) })
    // include_archived=1 is load-bearing: show() 404s on a soft-deleted row without it,
    // so an archived application would lose its motivation (and its whole detail).
    expect(apiGet).toHaveBeenCalledWith('/applications/1', { params: { include_archived: 1 } })
    await waitFor(() => expect(result.current.actions.selected?.coverLetter).toBe('<p>Waarom ik solliciteer</p>'))
  })

  it('leaves coverLetter null when the detail response carries no cover_letter', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 1 } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.selectApplication(app()) })
    // Wait for the MAPPED detail (customFields only exists after mapApplicationDetail),
    // not the light row selectApplication shows synchronously first.
    await waitFor(() => expect(result.current.actions.selected?.customFields).toEqual({}))
    expect(result.current.actions.selected?.coverLetter).toBeNull()
  })
})

/**
 * INTERVIEW-CONSENT-PERSIST-1 — the AVG evidence seam, end to end. The mapper test
 * proves raw→model and the tab test proves model→render, but nothing asserted the
 * REQUEST in between: that opening a drawer really GETs the detail route (the only
 * resource carrying this field — the list resource omits it) and that the timestamp
 * survives unwrap+map onto the model the tab reads.
 */
describe('useApplicationDrawerActions · selectApplication (INTERVIEW-CONSENT-PERSIST-1)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GETs the detail route and carries interview_consent_given_at onto the drawer model', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 1, interview_consent_given_at: '2026-07-20T10:00:00+00:00' } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.selectApplication(app({ id: 1 })) })
    await waitFor(() => expect(result.current.actions.selected?.interviewConsentGivenAt).toBe('2026-07-20T10:00:00+00:00'))
    // The exact seam: method, route and params (include_archived so an archived row resolves too).
    expect(apiGet).toHaveBeenCalledWith('/applications/1', { params: { include_archived: 1 } })
  })

  it('leaves the model null when the detail response omits the field (the non-careersite norm)', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 1 } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.selectApplication(app({ id: 1 })) })
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    await waitFor(() => expect(result.current.actions.selected?.interviewConsentGivenAt).toBeNull())
  })
})

// S7: Bron (source) editable picker — the seam for KEY-ADOPTION source_key.
describe('useApplicationDrawerActions · handleUpdateSource', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends source and source_key as the request body (KEY-ADOPTION)', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app({ source: 'Manual' })])
    act(() => { result.current.actions.handleUpdateSource(1, 'LinkedIn', 'linkedin') })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { source: 'LinkedIn', source_key: 'linkedin' })
  })

  it('keeps the new source when the server accepts', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app({ source: 'Manual' })])
    act(() => { result.current.actions.handleUpdateSource(1, 'LinkedIn', 'linkedin') })
    await waitFor(() => expect(result.current.applications[0].source).toBe('LinkedIn'))
    expect(result.current.applications[0].sourceKey).toBe('linkedin')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the source in both the row and the open drawer when the PATCH FAILS', async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Bron ongeldig' } } })
    const initial = app({ source: 'Manual', sourceKey: null })
    const { result } = harness([initial])
    // Preload the open drawer with the SAME pre-edit source, to prove BOTH slices revert.
    act(() => { result.current.actions.setSelected(detail({ id: 1, source: initial.source, sourceKey: initial.sourceKey })) })
    act(() => { result.current.actions.handleUpdateSource(1, 'LinkedIn', 'linkedin') })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.applications[0].source).toBe('Manual')
    expect(result.current.applications[0].sourceKey).toBeNull()
    expect(result.current.actions.selected?.source).toBe('Manual')
    expect(result.current.actions.selected?.sourceKey).toBeNull()
  })
})

// IDEMP-KEY-BODYLESS-1: handleRestore's POST has no body, so a sibling-tab/retry
// double click must still carry a per-click Idempotency-Key for the server to dedupe on.
describe('useApplicationDrawerActions · handleRestore', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('POSTs restore with a fresh Idempotency-Key header', async () => {
    post.mockResolvedValue({ data: {} })
    const { result } = harness([app({ archived: true })])
    act(() => { result.current.actions.handleRestore(1) })
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith('/applications/1/restore', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
  })
})
