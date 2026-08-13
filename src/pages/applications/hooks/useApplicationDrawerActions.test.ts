/**
 * useApplicationDrawerActions — REJECT-HONEST-1 regression coverage (audit 2026-07-25).
 * handleReject used to end in `.catch(() => {})`: a refused reject (422 on a removed
 * reason, lost permission, workflow failure) left the row AND the drawer showing
 * "Afgewezen" while nothing was rejected and no message went out. These tests assert
 * the SEAM, not a callback: the exact request body, the reconcile from the response,
 * and the revert + error toast on failure (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useApplicationDrawerActions } from './useApplicationDrawerActions'
import type { Application, ApplicationDetail } from '@/types/application'
import type { LookupItem } from '@/context/LookupsContext'
import type { Id } from '@/types/common'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn(), patch: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const t = ((k: string) => k) as unknown as import('i18next').TFunction

const FUNNEL: LookupItem[] = [
  { value: 'applied',  label: 'Gesolliciteerd', color: 'slate' },
  { value: 'rejected', label: 'Afgewezen',      color: 'red', is_rejected: true },
]

const app = (overrides: Partial<Application> = {}): Application => ({
  id: 1, candidateId: 9, candidateName: 'Test kandidaat', candidateInitials: 'TK',
  vacancyId: 1, vacancyTitle: 'Verpleegkundige', client: 'Acme', customerId: 1, referenceNumber: 'S-1',
  score: null, task: '', phaseKey: 'applied', bucket: 'active', source: '',
  owner: { id: null, name: '', initials: '', color: null },
  candidateStatusLabel: '', candidateStatusColor: '', candidateStatus: '', candidatePhase: '',
  created: '2026-07-01', isNew: false, archived: false, deletedAt: null,
  ...overrides,
} as Application)

// Recruiter list for handleOwner tests.
const USERS: Array<{ id: Id; name: string }> = [{ id: 'u2', name: 'Nieuwe Recruiter' }]

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

// Minimal ApplicationDetail fixture — mirrors VacancyTab.test.tsx's own `app` helper
// (`as unknown as ApplicationDetail`), since the full interface needs many fields no
// handler under test here actually reads.
const detail = (overrides: Partial<ApplicationDetail> = {}): ApplicationDetail =>
  ({ ...app(), customFields: {}, matchCriteria: [], matchSource: 'ai', ...overrides } as unknown as ApplicationDetail)

describe('useApplicationDrawerActions · handleReject', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends the reason id and note as the request body', async () => {
    post.mockResolvedValue({ data: { id: 1, phase_key: 'rejected' } })
    const { result } = harness([app()])
    act(() => { result.current.actions.handleReject(1, { reason_id: 'r-7', reason_label: 'Te ver reizen', note: '<p>toelichting</p>' }) })
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith('/applications/1/reject', { reason_id: 'r-7', note: '<p>toelichting</p>' })
  })

  it('keeps the rejected phase and confirms when the server accepts', async () => {
    post.mockResolvedValue({ data: { id: 1, phase_key: 'rejected' } })
    const { result } = harness([app()])
    act(() => { result.current.actions.handleReject(1, { reason_id: 'r-7', reason_label: 'Te ver reizen', note: '' }) })
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled())
    expect(result.current.applications[0].phaseKey).toBe('rejected')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the row and reports the server message when the reject FAILS', async () => {
    post.mockRejectedValue({ response: { status: 422, data: { message: 'Reden bestaat niet meer' } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.handleReject(1, { reason_id: 'gone', reason_label: 'Weg', note: '' }) })
    // Optimistic first, then the failure must put it back — never leave a fake rejection.
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.applications[0].phaseKey).toBe('applied')
    expect(result.current.applications[0].bucket).toBe('active')
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledWith('Reden bestaat niet meer')
  })
})

// V-appdetail-2: a move onto a requires_appointment phase for a row with no
// appointment planned yet warns first (never blocks) — every other move stays
// exactly as before, unintercepted.
describe('useApplicationDrawerActions · handleMove (V-appdetail-2 appointment warn)', () => {
  const FUNNEL_APPT: LookupItem[] = [
    { value: 'applied', label: 'Gesolliciteerd', color: 'slate' },
    { value: 'invited', label: 'Uitgenodigd', color: 'purple', requires_appointment: true },
  ]
  function harnessAppt(initial: Application[]) {
    return renderHook(() => {
      const [applications, setApplications] = useState<Application[]>(initial)
      const [, setTotal] = useState(initial.length)
      const actions = useApplicationDrawerActions({
        applications, wideRows: [], setApplications, setTotal,
        funnelTypes: FUNNEL_APPT, users: [], bucket: 'active',
        decorate: <T,>(a: T) => a, t,
      })
      return { applications, actions }
    })
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('holds the move as pending instead of moving immediately, and never PATCHes yet', () => {
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: true } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    expect(result.current.applications[0].phaseKey).toBe('applied') // not moved yet
    expect(apiPatch).not.toHaveBeenCalled()
    expect(result.current.actions.pendingMove).toEqual({ id: 1, phaseKey: 'invited', phaseLabel: 'Uitgenodigd' })
  })

  it('confirming the pending move proceeds with the exact same PATCH an unintercepted move would send', async () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: true } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    act(() => result.current.actions.confirmPendingMove())
    expect(result.current.applications[0].phaseKey).toBe('invited')
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { phase_key: 'invited' })
    expect(result.current.actions.pendingMove).toBeNull()
  })

  it('cancelling drops the pending move — the application stays on its current phase', () => {
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: true } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    act(() => result.current.actions.cancelPendingMove())
    expect(result.current.actions.pendingMove).toBeNull()
    expect(result.current.applications[0].phaseKey).toBe('applied')
    expect(apiPatch).not.toHaveBeenCalled()
  })

  it('a move that is NOT missing an appointment proceeds immediately, unintercepted', () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: false } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    expect(result.current.applications[0].phaseKey).toBe('invited')
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { phase_key: 'invited' })
    expect(result.current.actions.pendingMove).toBeNull()
  })
})

// OPTIMISTIC-REVERT-1 (audit 2026-07-27): handleOwner/handleAdjustScore/handleUpdateCustomFields
// used to end in a bare toast on failure, leaving the optimistic write on screen as if it had
// saved. These tests assert the SEAM (request body) and the revert of BOTH state slices.
describe('useApplicationDrawerActions · handleOwner', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends owner_id as the request body', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()], { users: USERS })
    act(() => { result.current.actions.handleOwner(1, 'u2') })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { owner_id: 'u2' })
  })

  it('keeps the new owner when the server accepts', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()], { users: USERS })
    act(() => { result.current.actions.handleOwner(1, 'u2') })
    await waitFor(() => expect(result.current.applications[0].owner.id).toBe('u2'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the owner in both the row and the open drawer, and reports the server message, when the PATCH FAILS', async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Geen rechten' } } })
    const initial = app()
    const { result } = harness([initial], { users: USERS })
    // Preload the open drawer with the SAME pre-edit owner, to prove BOTH slices revert.
    act(() => { result.current.actions.setSelected(detail({ id: 1, owner: initial.owner })) })
    act(() => { result.current.actions.handleOwner(1, 'u2') })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.applications[0].owner).toEqual(initial.owner)
    expect(result.current.actions.selected?.owner).toEqual(initial.owner)
    expect(notifyError).toHaveBeenCalledWith('Geen rechten')
  })
})

describe('useApplicationDrawerActions · handleAdjustScore', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends match_score and match_criteria as the request body', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app({ score: 40 })])
    act(() => { result.current.actions.handleAdjustScore(1, { score: 90, criteria: [] }) })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { match_score: 90, match_criteria: [] })
  })

  it('keeps the new score when the server accepts', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app({ score: 40 })])
    act(() => { result.current.actions.handleAdjustScore(1, { score: 90, criteria: [] }) })
    await waitFor(() => expect(result.current.applications[0].score).toBe(90))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the score in both the row and the open drawer, and reports the server message, when the PATCH FAILS', async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Ongeldige score' } } })
    const { result } = harness([app({ score: 40 })])
    act(() => { result.current.actions.setSelected(detail({ id: 1, score: 40 })) })
    act(() => { result.current.actions.handleAdjustScore(1, { score: 90, criteria: [] }) })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.applications[0].score).toBe(40)
    expect(result.current.actions.selected?.score).toBe(40)
    expect(notifyError).toHaveBeenCalledWith('Ongeldige score')
  })
})

describe('useApplicationDrawerActions · handleUpdateCustomFields', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('merges the patch into customFields and sends the WHOLE map as the request body', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()])
    act(() => { result.current.actions.setSelected(detail({ id: 1, customFields: { shift: 'day' } })) })
    act(() => { result.current.actions.handleUpdateCustomFields(1, { region: 'noord' }) })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { custom_fields: { shift: 'day', region: 'noord' } })
  })

  it('keeps the new custom fields when the server accepts', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()])
    act(() => { result.current.actions.setSelected(detail({ id: 1, customFields: { shift: 'day' } })) })
    act(() => { result.current.actions.handleUpdateCustomFields(1, { region: 'noord' }) })
    await waitFor(() => expect(result.current.actions.selected?.customFields).toEqual({ shift: 'day', region: 'noord' }))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it("reverts the open drawer's custom fields and reports the server message, when the PATCH FAILS", async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Veld ongeldig' } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.setSelected(detail({ id: 1, customFields: { shift: 'day' } })) })
    act(() => { result.current.actions.handleUpdateCustomFields(1, { region: 'noord' }) })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.actions.selected?.customFields).toEqual({ shift: 'day' })
    expect(notifyError).toHaveBeenCalledWith('Veld ongeldig')
  })
})

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
