/** useProposeForm template suites: token interpolation, recipient switching, candidate short name. */
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

  // Contacts exist but none is chosen yet: the reason asks for a pick, it never claims there are no contacts.
  it('reports pickRecipient (not noContact) when the customer has contacts but no recipient is chosen', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [{ id: 'ct9', name: 'Piet Klaassen', email: 'piet@example.nl' }] } })
      if (url.startsWith('/candidates/')) return Promise.resolve({ data: { id: 'c1', name: 'Jan de Vries' } })
      return Promise.resolve({ data: {} })
    })
    const noContact = app({ contact: null } as Partial<ApplicationDetail>)
    const { result } = renderHook(() => useProposeForm(noContact), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    await waitFor(() => expect(result.current.candidateLoading).toBe(false))
    expect(result.current.disabledReason).toBe('pickRecipient')
  })

  // Fills all known tokens (English and legacy Dutch aliases) and leaves unknown
  // tokens + {link} untouched. The backend fills {link} on send.
  it('fills English tokens and legacy Dutch aliases, leaves {link} untouched', async () => {
    settingsFixture = { company_name: 'Tech Solutions B.V.', application_proposal: JSON.stringify({ body_template: '{candidate} / {kandidaat} / {agency} / {bureau} / {link}' }) }
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    expect(result.current.body).toBe('Jan de Vries / Jan de Vries / Tech Solutions B.V. / Tech Solutions B.V. / {link}')
  })

  // Default subject must render with the English tokens ({candidate} {vacancy}),
  // not Dutch aliases. The mock t() returns the key itself, so when English tokens
  // are filled, the subject contains the filled values not the token placeholders.
  it('renders the default subject with English tokens', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ subject_template: 'Candidate {candidate} proposed for {vacancy}' }) }
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    // Verify English tokens are filled (not left as {candidate}/{vacancy})
    expect(result.current.subject).toContain('Jan de Vries')
    expect(result.current.subject).toContain('Verpleegkundige')
    // Ensure tokens are replaced, not left as placeholders
    expect(result.current.subject).not.toContain('{candidate}')
    expect(result.current.subject).not.toContain('{vacancy}')
  })

  // Agency token reads the tenant's company_name setting, falls back to empty.
  it('fills {agency} from the company_name setting, defaults to empty', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ body_template: 'Agency: {agency}' }) }
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    expect(result.current.body).toBe('Agency: ')

    // Now re-render with the setting present
    settingsFixture = { company_name: 'My Company GmbH', application_proposal: JSON.stringify({ body_template: 'Agency: {agency}' }) }
    const { result: result2 } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result2.current.contactsLoading).toBe(false))
    expect(result2.current.body).toBe('Agency: My Company GmbH')
  })

  // Regression: {candidate_short} is filled client-side like the BE shortName (first name + last initial).
  it('fills {candidate_short} as "Sanne D." and leaves no raw token behind', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ subject_template: 'Voorstel {candidate_short}' }) }
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [{ id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' }] } })
      if (url.startsWith('/candidates/')) return Promise.resolve({ data: { id: 'c1', firstname: 'Sanne', lastname: 'de Vries' } })
      return Promise.resolve({ data: {} })
    })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.subject).toContain('Sanne D.'))
    expect(result.current.subject).not.toContain('{candidate_short}')
  })

  // T-005: nothing is filled (no blank "Kandidaat  voorgesteld") until the candidate record has arrived.
  it('keeps subject and body empty while the candidate GET is pending, then fills "Sanne D."', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ subject_template: 'Kandidaat {candidate_short} voorgesteld', body_template: 'Over {candidate_short}' }) }
    let resolveCandidate: (v: unknown) => void = () => {}
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [{ id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' }] } })
      if (url.startsWith('/candidates/')) return new Promise(r => { resolveCandidate = r })
      return Promise.resolve({ data: {} })
    })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    expect(result.current.subject).toBe('')
    expect(result.current.body).toBe('')
    expect(result.current.subject).not.toContain('Kandidaat  voorgesteld')
    await act(async () => { resolveCandidate({ data: { id: 'c1', firstname: 'Sanne', lastname: 'de Vries' } }) })
    await waitFor(() => expect(result.current.subject).toBe('Kandidaat Sanne D. voorgesteld'))
  })

  // T-005: a manual edit made before the candidate arrives is kept, and never carries a blank name.
  it('keeps a body typed before the candidate resolves', async () => {
    settingsFixture = { application_proposal: JSON.stringify({ body_template: 'Over {candidate_short}' }) }
    let resolveCandidate: (v: unknown) => void = () => {}
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/customers/')) return Promise.resolve({ data: { contacts: [{ id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' }] } })
      if (url.startsWith('/candidates/')) return new Promise(r => { resolveCandidate = r })
      return Promise.resolve({ data: {} })
    })
    const { result } = renderHook(() => useProposeForm(app()), { wrapper })
    await waitFor(() => expect(result.current.contactsLoading).toBe(false))
    act(() => { result.current.setBody('mine') })
    await act(async () => { resolveCandidate({ data: { id: 'c1', firstname: 'Sanne', lastname: 'de Vries' } }) })
    expect(result.current.body).toBe('mine')
  })
})
