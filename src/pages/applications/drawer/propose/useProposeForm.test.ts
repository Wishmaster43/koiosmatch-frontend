/**
 * useProposeForm — covers the /propose request body, the conditional phase PATCH
 * (only when the tenant setting `application_proposal.sets_phase` is on), token
 * interpolation of the tenant templates, and that a failing /propose POST
 * surfaces an error instead of a false "recorded" claim. Also proves the old
 * note-writing path is gone (never POSTs to /notes).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProposeForm } from './useProposeForm'
import type { ApplicationDetail } from '@/types/application'

// react-query needs a client in the tree (useQueryClient invalidates the
// proposals-history query on a successful record). No JSX here — this file
// stays a plain .ts (no tsx loader configured for it).
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const { notifyError, notifySuccess } = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notifyError, notifySuccess }))
vi.mock('@/lib/extractApiError', () => ({ extractApiError: (_err: unknown, fallback: string) => fallback }))

const { buildProposalCvBlob } = vi.hoisted(() => ({ buildProposalCvBlob: vi.fn(() => Promise.resolve(new Blob(['pdf']))) }))
vi.mock('@/lib/proposalCv', () => ({ buildProposalCvBlob }))

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

const app = (over: Partial<ApplicationDetail> = {}): ApplicationDetail => ({
  id: 1, candidateId: 'c1', customerId: 'k1', candidateName: 'Jan de Vries', vacancyTitle: 'Verpleegkundige',
  client: 'Zorggroep Noord', owner: { id: 'u1', name: 'Eva Bos', initials: 'EB', color: '#000' },
  contact: { id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl', phone: '' },
  coverLetter: null, bucket: 'active', archived: false, ...over,
} as unknown as ApplicationDetail)

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

  it('fills the subject/body templates with the {kandidaat} {vacature} {klant} {contact} {recruiter} tokens', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ subject_template: 'Voorstel {kandidaat} voor {vacature} bij {klant}', body_template: '<p>Beste {contact}, groet {recruiter}</p>' }) }
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    await waitFor(() => expect(result.current.subject).toBe('Voorstel Jan de Vries voor Verpleegkundige bij Zorggroep Noord'))
    expect(result.current.body).toBe('<p>Beste Piet Klaassen, groet Eva Bos</p>')
  })

  // DEFECT 2 regression: switching the recipient must re-fill the {contact}
  // token with the NEW contact's name — otherwise the recorded/copied message
  // still addresses the previous contact while submit() registers the new one.
  it('re-fills the body with the new recipient name when the recipient is switched', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ body_template: 'Beste {contact}' }) }
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [
        { id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' },
        { id: 'ct2', name: 'Marieke de Boer', email: 'marieke@zorggroep.nl' },
      ] } })
      if (url.startsWith('/candidates/')) return Promise.resolve({ data: { id: 'c1', name: 'Jan de Vries' } })
      return Promise.resolve({ data: {} })
    })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    await waitFor(() => expect(result.current.body).toContain('Piet Klaassen'))
    act(() => { result.current.setRecipientContactId('ct2') })
    await waitFor(() => expect(result.current.body).toContain('Marieke de Boer'))
    expect(result.current.body).not.toContain('Piet Klaassen')
  })

  // DEFECT 2 regression: once the recruiter has typed their own words, a later
  // recipient switch must never clobber them.
  it('does not overwrite a manual edit when the recipient is switched afterward', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ body_template: 'Beste {contact}' }) }
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [
        { id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' },
        { id: 'ct2', name: 'Marieke de Boer', email: 'marieke@zorggroep.nl' },
      ] } })
      if (url.startsWith('/candidates/')) return Promise.resolve({ data: { id: 'c1', name: 'Jan de Vries' } })
      return Promise.resolve({ data: {} })
    })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    await waitFor(() => expect(result.current.body).toContain('Piet Klaassen'))
    act(() => { result.current.setBody('My own custom message') })
    act(() => { result.current.setRecipientContactId('ct2') })
    expect(result.current.body).toBe('My own custom message')
  })

  // DEFECT 2 decision: with no recipient at all, the fill is skipped entirely —
  // a bare "Beste ," greeting is worse than a still-empty field, and submit()
  // stays disabled ('noContact') so nothing is lost by leaving it blank.
  it('leaves subject/body empty rather than a half-filled greeting when there is no recipient yet', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [] } })
      if (url.startsWith('/candidates/')) return Promise.resolve({ data: { id: 'c1', name: 'Jan de Vries' } })
      return Promise.resolve({ data: {} })
    })
    const noContact = app({ contact: null } as Partial<ApplicationDetail>)
    const { result } = renderHook(() => useProposeForm(noContact), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    expect(result.current.disabledReason).toBe('noContact')
    expect(result.current.subject).toBe('')
    expect(result.current.body).toBe('')
  })

  it('does not PATCH the phase when application_proposal.sets_phase is off', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ sets_phase: false }) }
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())
    await act(async () => { await result.current.submit() })
    expect(apiPatch).not.toHaveBeenCalled()
    expect(apiPost).toHaveBeenCalledWith('/applications/1/propose', expect.objectContaining({ contact_id: 'ct1' }))
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
    expect(apiPost).toHaveBeenCalledWith('/applications/1/propose', {
      contact_id: 'ct1',
      cv_variant: 'full',
      subject: result.current.subject,
      body: result.current.body,
    })
  })

  // Regression (25-07): the "motivatiebrief meesturen" checkbox changed nothing —
  // the /propose contract has no field for it, so ticking it was a control without
  // an effect. The letter now travels inside the recorded/copied message body.
  it('appends the motivation letter to the recorded body only when it is ticked', async () => {
    settingsFixture = {}
    const withLetter = app({ coverLetter: '<p>Mijn motivatie</p>' } as Partial<ApplicationDetail>)
    const { result } = renderHook(() => useProposeForm(withLetter), { wrapper })
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    act(() => { result.current.setConsentConfirmed(true) })
    await waitFor(() => expect(result.current.disabledReason).toBeNull())

    // The mock's call tuple is untyped — read the recorded body through one cast.
    const lastBody = () => (apiPost.mock.calls.at(-1) as unknown as [string, { body: string }])[1].body

    await act(async () => { await result.current.submit() })
    expect(lastBody()).not.toContain('Mijn motivatie')

    act(() => { result.current.setIncludeMotivation(true) })
    await act(async () => { await result.current.submit() })
    expect(lastBody()).toContain('Mijn motivatie')
  })

  // DEFECT 3 regression: the CV is recorded BEFORE it is generated/downloaded —
  // on a rejected /propose (403/422), buildProposalCvBlob must never run, so no
  // special-category PDF leaves the browser while Koios has no record of it.
  it('surfaces an error, does not claim success, and never builds the CV when the /propose POST fails', async () => {
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
    expect(buildProposalCvBlob).not.toHaveBeenCalled()
  })

  it('disables submit until a contact is present and consent is ticked', async () => {
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    expect(result.current.disabledReason).toBe('noConsent')
    act(() => { result.current.setRecipientContactId('') })
    expect(result.current.disabledReason).not.toBeNull()
  })
})
