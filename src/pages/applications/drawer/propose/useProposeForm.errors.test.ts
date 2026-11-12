/** useProposeForm error and CV suites: conflicts, refusals, CV build failures. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProposeForm } from './useProposeForm'
import { PROPOSAL_CV_MAX_BYTES } from './proposeRequest'
import { app } from './useProposeForm.testKit'

// react-query needs a client in the tree (useQueryClient invalidates the
// proposals-history query on a successful record). No JSX here — this file
// stays a plain .ts (no tsx loader configured for it).
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

// The candidates-namespace t is distinguishable so the CV render can be pinned to it.
vi.mock('react-i18next', () => ({ useTranslation: (ns?: string | string[]) => ({ t: ns === 'candidates' ? (k: string) => `candidates:${k}` : (k: string) => k }) }))

const { notifyError, notifySuccess } = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notifyError, notifySuccess }))

const { buildProposalCvBlob } = vi.hoisted(() => ({ buildProposalCvBlob: vi.fn(() => Promise.resolve(new Blob(['pdf']))) }))
const { triggerBlobDownload } = vi.hoisted(() => ({ triggerBlobDownload: vi.fn() }))
vi.mock('@/lib/downloadBlob', () => ({ triggerBlobDownload }))
vi.mock('@/lib/proposalCv', async () => {
  const actual = await vi.importActual<typeof import('@/lib/proposalCv')>('@/lib/proposalCv')
  return { ...actual, buildProposalCvBlob }
})

vi.mock('@/lib/useCvSettings', () => ({ useCvSettings: () => ({ settings: {} }) }))
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))
vi.mock('@/pages/candidates/data/mapCandidate', () => ({ mapCandidate: (raw: unknown) => raw }))

// Tenant lookups: one funnel stage flagged is_proposal (PROPOSE-FLAG-EXPOSE-1 —
// once the API exposes the flag, this is exactly how it resolves).
const { funnelTypes } = vi.hoisted(() => ({
  funnelTypes: [
    { value: 'applied', label: 'Applied' },
    { value: 'proposal', label: 'Proposal', is_proposal: true },
  ],
}))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ funnelTypes }) }))

// Tenant users — mutable per test via `usersFixture` (VOORSTEL-AFZENDER-FE-1).
const usersFixture: Array<{ id: string; name: string }> = []
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: usersFixture }) }))

// Tenant settings — mutable per test via `settingsFixture`.
let settingsFixture: Record<string, unknown> = {}
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => settingsFixture,
  // Mirrors the real getJsonSetting: parse a stored JSON string, fall back on absence.
  getJsonSetting: (values: Record<string, unknown>, key: string, fallback: unknown) => {
    const raw = values[key]
    if (raw == null) return fallback
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return fallback }
  },
  // Mirrors the real getStringSetting: return string value or fallback.
  getStringSetting: (values: Record<string, unknown>, key: string, fallback: string | null = null): string | null => {
    const raw = values[key]
    if (raw == null) return fallback
    return typeof raw === 'string' ? raw : fallback
  },
}))

const { apiGet, apiPost, apiPatch } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(() => Promise.resolve({ data: {} })),
  apiPatch: vi.fn(() => Promise.resolve({ data: {} })),
}))
vi.mock('@/lib/api', () => ({
  default: { get: apiGet, post: apiPost, patch: apiPatch },
  unwrap: (res: { data?: unknown }) => res?.data,
}))

const formOf = (n = -1) => (apiPost.mock.calls.at(n) as unknown as [string, FormData])[1]

describe('useProposeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsFixture = {}
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [{ id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' }] } })
      if (url.startsWith('/candidates/')) return Promise.resolve({ data: { id: 'c1', name: 'Jan de Vries' } })
      return Promise.resolve({ data: {} })
    })
    // jsdom has no real blob-URL support — stub it deterministically (mirrors
    // DocumentsSection.test.tsx's precedent for the same download pattern).
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:cv'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  // CLAIM-1 (03-10): a 409 duplicate-propose sets `conflict` instead of a toast,
  // and the modal stays open (submit returns false, nothing claims success).
  it('sets conflict on a 409 proposal_in_flight, never a toast', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 409, data: { code: 'proposal_in_flight', proposal_id: 'p1' } } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.submit() })
    expect(ok).toBe(false)
    expect(notifyError).not.toHaveBeenCalled()
    expect(result.current.conflict).toEqual({ code: 'proposal_in_flight', proposalId: 'p1', sentAt: undefined })
  })

  // forceSend re-submits with force:true in the body and a NEW Idempotency-Key.
  it('forceSend re-POSTs with force:true and a fresh Idempotency-Key', async () => {
    apiPost
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'proposal_recently_sent', proposal_id: 'p1', sent_at: '2026-10-01T10:00:00Z' } } })
      .mockResolvedValueOnce({ data: { id: 9 } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(result.current.conflict?.code).toBe('proposal_recently_sent')

    await act(async () => { await result.current.forceSend() })
    expect(apiPost).toHaveBeenLastCalledWith(
      '/applications/1/propose',
      expect.any(FormData),
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
    )
    expect(formOf().get('force')).toBe('1')
    const [firstKey, lastKey] = apiPost.mock.calls.map(c => (c as unknown as [string, unknown, { headers?: Record<string, string> }])[2]?.headers?.['Idempotency-Key'])
    expect(lastKey).not.toBe(firstKey)
    expect(result.current.conflict).toBeNull()
  })

  // An uncoded rejection with a server sentence shows that sentence (the shared apiErrorMessage chain).
  it('shows the server sentence on an uncoded 422', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Server says no.' } } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(notifyError).toHaveBeenCalledWith('Server says no.')
  })

  // Any other 409/4xx code keeps today's generic toast — the conflict callout
  // is reserved for the two documented codes only.
  it('falls back to the generic toast on a 409 with an unknown code', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 409, data: { code: 'something_else' } } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
    expect(result.current.conflict).toBeNull()
  })

  // The send refuses a suppressed recipient with a 422 code; the toast is the translated copy.
  it('shows the translated notice on a 422 recipient_suppressed', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 422, data: { code: 'recipient_suppressed', message: 'Recipient is suppressed' } } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(apiPost).toHaveBeenLastCalledWith(`/applications/${app().id}/propose`, expect.anything(), expect.anything())
    expect(notifyError).toHaveBeenCalledWith('errors.recipientSuppressed')
  })

  // Y-002: the CV is rendered first; a render failure refuses with no request at all.
  it('sends no request and shows the translated refusal when the CV cannot be built', async () => {
    buildProposalCvBlob.mockRejectedValueOnce(new Error('render'))
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.submit() })
    expect(ok).toBe(false)
    expect(apiPost).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledWith('propose.cvBuildFailed')
  })

  // Y-002: an oversized CV is refused before any request, with the shared too-large copy.
  it('sends no request and shows the too-large copy when the CV exceeds the cap', async () => {
    buildProposalCvBlob.mockResolvedValueOnce(new Blob([new Uint8Array(PROPOSAL_CV_MAX_BYTES + 1)]))
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.submit() })
    expect(ok).toBe(false)
    expect(apiPost).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledWith('common:upload.tooLargeMax')
  })

  // Y-002: a field-keyed 422 on cv_pdf goes through the shared apiErrorMessage chain.
  it('shows the server sentence for a 422 on cv_pdf and downloads nothing', async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'The cv pdf must be a PDF.', errors: { cv_pdf: ['The cv pdf must be a PDF.'] } } } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(notifyError).toHaveBeenCalledWith('The cv pdf must be a PDF.')
    expect(triggerBlobDownload).not.toHaveBeenCalled()
  })

  // Y-002: success reuses the SAME rendered blob for the download (one render only).
  it('downloads the same blob it uploaded after a successful record', async () => {
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(buildProposalCvBlob).toHaveBeenCalledTimes(1)
    // The CV renders with the candidates-namespace t: cv.* labels live there only (12-11).
    const cvArgs = (buildProposalCvBlob.mock.calls as unknown as Array<[{ t: (k: string) => string }]>)[0][0]
    expect(cvArgs.t('cv.contact')).toBe('candidates:cv.contact')
    const blob = await buildProposalCvBlob.mock.results[0].value
    expect(triggerBlobDownload).toHaveBeenCalledTimes(1)
    expect(triggerBlobDownload).toHaveBeenCalledWith(blob, 'CV - Jan de Vries.pdf')
  })
})
