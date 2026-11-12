/** useProposeForm submit suites: phase PATCH, /propose request body, sender, share link. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProposeForm } from './useProposeForm'
import { app } from './useProposeForm.testKit'
import type { ApplicationDetail } from '@/types/application'

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
let usersFixture: Array<{ id: string; name: string }> = []
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

  it('does not PATCH the phase when application_proposal.sets_phase is off', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ sets_phase: false }) }
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(apiPatch).not.toHaveBeenCalled()
    expect(apiPost).toHaveBeenCalledWith('/applications/1/propose', expect.any(FormData), expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(formOf().get('contact_id')).toBe('ct1')
    expect(formOf().get('cv_pdf')).toBeInstanceOf(File)
    expect(apiPost).not.toHaveBeenCalledWith('/applications/1/notes', expect.anything())
  })

  it('PATCHes phase_key to the is_proposal-flagged stage when the setting is on', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ sets_phase: true }) }
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { phase_key: 'proposal' })
  })

  it('POSTs the recipient contact id and the picked cv variant to /propose', async () => {
    settingsFixture = {}
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true); result.current.setCvVariant('full') })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(apiPost).toHaveBeenCalledWith('/applications/1/propose', expect.any(FormData), expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    const form = formOf()
    expect(form.get('contact_id')).toBe('ct1')
    expect(form.get('cv_variant')).toBe('full')
    expect(form.get('subject')).toBe(result.current.subject)
    expect(form.get('body')).toBe(result.current.body)
    expect(form.get('send')).toBe('1')
    expect(form.has('sender_user_id')).toBe(false)
  })

  // VOORSTEL-AFZENDER-FE-1: the picked sender travels as sender_user_id; the tenant
  // default preselects it; the {recruiter} token renders the SENDER's name.
  it('POSTs the picked sender as sender_user_id', async () => {
    settingsFixture = {}
    usersFixture = [{ id: 'u2', name: 'Sara Demo' }]
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true); result.current.setSenderUserId('u2') })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(apiPost).toHaveBeenCalledWith('/applications/1/propose', expect.any(FormData), expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(formOf().get('sender_user_id')).toBe('u2')
  })

  it('preselects the tenant default sender and renders it in the {recruiter} token', async () => {
    settingsFixture = { proposal_default_sender_user_id: 'u2', application_proposal: JSON.stringify({ body_template: 'Groet, {recruiter}' }) }
    usersFixture = [{ id: 'u2', name: 'Sara Demo' }]
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    await waitFor(() => expect(result.current.senderUserId).toBe('u2'))
    await waitFor(() => expect(result.current.body).toContain('Sara Demo'))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(apiPost).toHaveBeenCalledWith('/applications/1/propose', expect.any(FormData), expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(formOf().get('sender_user_id')).toBe('u2')
  })

  it('keeps an explicit pick when the settings re-fetch would otherwise reapply the default', async () => {
    settingsFixture = { proposal_default_sender_user_id: 'u2' }
    usersFixture = [{ id: 'u2', name: 'Sara Demo' }, { id: 'u3', name: 'Tim Mulder' }]
    const { result, rerender } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.senderUserId).toBe('u2'))
    act(() => { result.current.setSenderUserId('u3') })
    settingsFixture = { proposal_default_sender_user_id: 'u2' }
    rerender()
    expect(result.current.senderUserId).toBe('u3')
  })

  // K-248 PROPOSE-SEND-1: `send` defaults to true and follows the sendEmail
  // toggle — false records the proposal + share link only, no mail.
  it('POSTs send:true by default and send:false once the toggle is switched off', async () => {
    settingsFixture = {}
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    expect(result.current.sendEmail).toBe(true)

    await act(async () => { await result.current.submit() })
    expect(formOf().get('send')).toBe('1')

    act(() => { result.current.setSendEmail(false) })
    await act(async () => { await result.current.submit() })
    expect(formOf().get('send')).toBe('0')
  })

  // 5f = C: the cover letter never travels in the proposal message, only the CV attachment.
  it('never puts the candidate cover letter in the recorded body', async () => {
    settingsFixture = {}
    const withLetter = app({ coverLetter: '<p>Mijn motivatie</p>' } as Partial<ApplicationDetail>)
    const { result } = renderHook(() => useProposeForm(withLetter), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())

    // The mock's call tuple is untyped — read the recorded body through one cast.
    const lastBody = () => String(formOf().get('body'))

    await act(async () => { await result.current.submit() })
    expect(lastBody()).not.toContain('Mijn motivatie')
  })

  // DEFECT 3 regression: the CV is only DOWNLOADED after the record succeeded —
  // on a rejected /propose no special-category PDF is saved while Koios has no record.
  it('surfaces an error, does not claim success, and never downloads the CV when the /propose POST fails', async () => {
    apiPost.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.submit() })
    expect(ok).toBe(false)
    expect(notifyError).toHaveBeenCalled()
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(triggerBlobDownload).not.toHaveBeenCalled()
  })

  // V-appdetail-5: the response's own share_url is captured into state so the
  // modal can hand it straight to the recruiter, never logged (§8).
  it('captures the response share_url into state on a successful record', async () => {
    apiPost.mockResolvedValueOnce({ data: { id: 9, share_url: 'https://app.example/p/abc123' } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())

    expect(result.current.shareUrl).toBeNull()
    await act(async () => { await result.current.submit() })
    expect(result.current.shareUrl).toBe('https://app.example/p/abc123')
  })

  it('copyShareLink copies the captured share_url and never the raw response object', async () => {
    apiPost.mockResolvedValueOnce({ data: { id: 9, share_url: 'https://app.example/p/abc123' } })
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })

    await act(async () => { await result.current.copyShareLink() })
    expect(writeText).toHaveBeenCalledWith('https://app.example/p/abc123')
    expect(result.current.shareLinkCopied).toBe(true)
  })

  it('disables submit until a contact is present and consent is ticked', async () => {
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    expect(result.current.disabledReason).toBe('noConsent')
    act(() => { result.current.setRecipientContactId('') })
    expect(result.current.disabledReason).not.toBeNull()
  })
})
