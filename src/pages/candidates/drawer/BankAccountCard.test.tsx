/**
 * BANK-1 (Danny 2026-08-09, "Financieel — bankrekeningnummer en naam van
 * rekeningnummer") — seam coverage for BOTH bank accounts.
 *
 * These tests assert the REQUEST, never just that a callback fired (§13): the
 * exact PATCH body for the private account (top-level `iban` +
 * `account_holder_name`) and for the business one (nested under `freelance`),
 * that a spaced/lowercase IBAN is DISPLAYED grouped but SENT ungrouped, and that
 * the server's own 422 message reaches the user through the shared
 * extractApiError instead of a bare code.
 *
 * Contract measured live against koiosmatch-api (tenant yesway, 2026-08-09):
 *   PATCH /candidates/{id} {"iban":"NL00INGB0000000000"}
 *     → 422 {"message":"Het IBAN-controlegetal klopt niet.",
 *            "errors":{"iban":["Het IBAN-controlegetal klopt niet."]}}
 *   PATCH /candidates/{id} {"freelance":{"iban":"NL00INGB0000000000"}}
 *     → 422 … "errors":{"freelance.iban":[…]}
 *   PATCH /candidates/{id} {"iban":"NL91 ABNA 0417 1643 00"} → 200, and the
 *     detail comes back WITH the spaces — the API stores the string verbatim,
 *     which is exactly why the front-end must normalise before sending.
 * Runs WITHOUT real i18n (like its sibling suites), so `t()` stays on raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import BankAccountCard from './BankAccountCard'
import { buildCandidatePatch } from '../data/candidatesShared'
import { formatIban, normalizeIban } from '@/lib/iban'
import { monoStyle } from '@/components/ui/typography'

// FINANCIAL-GATE-1: the card is permission-gated now, so every existing test
// renders as a viewer who HAS the permission. The gate itself is proven by its
// own describe block at the bottom of this file.
const mockHasPermission = vi.fn()
// DOC-BANK-2: the slot has its own suite — a marker stub keeps this one on the card's wiring.
vi.mock('./IbanDocumentSlot', () => ({ default: ({ onLink }: { onLink: (id: string | null) => void }) => (
  <div data-testid="iban-doc-slot"><button type="button" data-testid="iban-doc-slot-link" onClick={() => onLink('stub-id')}>link</button></div>
) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: mockHasPermission }) }))
beforeEach(() => { mockHasPermission.mockImplementation(() => true) })

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { patch: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// DOC-BANK-1: stub the shared preview modal (its own pdf.js internals are out of
// scope here, mirrors SectionTabs.test.tsx) but keep the passed `doc` visible so
// a test can assert WHICH document the preview icon actually opened.
vi.mock('@/components/drawer/DocPreviewModal', () => ({
  default: ({ doc }: { doc?: { name?: string } }) => <div data-testid="preview-modal">{doc?.name}</div>,
}))
// Asserted as a REQUEST-shaped call (§13: url + name), never just "a click fired".
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useCandidateRecord } from '../hooks/useCandidateMutations'

const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// A real, mod-97-valid IBAN — the demo seed's "NL84INGB5045215549" is NOT one
// (verified: the server refuses it), so it must never be used as a fixture here.
const VALID = 'NL91ABNA0417164300'

// useCandidateRecord now reads useQueryClient() to invalidate on save
// (REFRESH-FIX-2) — the two renderHook(() => useCandidateRecord()) calls below
// need a provider.
// One client per test run, hoisted out of the wrapper body (Opus F6): a client
// constructed INSIDE the wrapper is swapped on every re-render.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const qcWrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children)

describe('lib/iban · display vs wire form', () => {
  it('formats an IBAN in readable groups of four and strips them again for the wire', () => {
    expect(formatIban(VALID)).toBe('NL91 ABNA 0417 1643 00')
    expect(normalizeIban('nl91 abna 0417 1643 00')).toBe(VALID)
    // A non-breaking space (pasted from a bank statement) is stripped too.
    expect(normalizeIban('NL91 ABNA 0417 1643 00')).toBe(VALID)
    expect(formatIban('')).toBe('')
    expect(normalizeIban(null)).toBe('')
  })
})

describe('BankAccountCard · private (salary) account', () => {
  it('shows the stored IBAN grouped in fours, in mono, with its own pencil', () => {
    render(<BankAccountCard candidateId="cand-1" value={{ iban: VALID, accountHolderName: 'Jan Jansen' }} onSave={vi.fn()} />)
    expect(screen.getByText('preferences.groupBankAccount')).toBeInTheDocument()
    const shown = screen.getByText('NL91 ABNA 0417 1643 00')
    expect(shown).toBeInTheDocument()
    expect(shown).toHaveStyle({ fontFamily: monoStyle.fontFamily })
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByTitle('edit')).toBeInTheDocument()
  })

  it('renders an honest empty state instead of a blank row', () => {
    render(<BankAccountCard candidateId="cand-1" value={{ iban: '', accountHolderName: '' }} onSave={vi.fn()} />)
    expect(screen.getAllByText('-')).toHaveLength(2)
  })

  it('sends the IBAN WITHOUT spaces and uppercased, however it was typed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<BankAccountCard candidateId="cand-1" value={{ iban: '', accountHolderName: '' }} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.type(screen.getByLabelText('preferences.iban'), 'nl91 abna 0417 1643 00')
    await user.type(screen.getByLabelText('preferences.accountHolderName'), '  Jan Jansen  ')
    await user.click(screen.getByTitle('save'))
    // The EXACT payload this card emits — the API keys, not UI keys.
    expect(onSave).toHaveBeenCalledWith({ iban: VALID, account_holder_name: 'Jan Jansen' })
  })

  it('tidies the typed IBAN into readable groups on blur (a display hint only — no mod-97 check here)', async () => {
    const user = userEvent.setup()
    render(<BankAccountCard candidateId="cand-1" value={{ iban: '', accountHolderName: '' }} onSave={vi.fn()} />)
    await user.click(screen.getByTitle('edit'))
    const input = screen.getByLabelText('preferences.iban') as HTMLInputElement
    // A check digit the server WILL reject: the front-end still only reformats,
    // it never blocks the save or claims a verdict of its own.
    await user.type(input, 'nl00ingb0000000000')
    await user.tab()
    expect(input.value).toBe('NL00 INGB 0000 0000 00')
    expect(screen.getByTitle('save')).toBeEnabled()
  })

  it('seeds the edit field from the stored value in its readable form and restores it on cancel', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<BankAccountCard candidateId="cand-1" value={{ iban: VALID, accountHolderName: 'Jan Jansen' }} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    expect((screen.getByLabelText('preferences.iban') as HTMLInputElement).value).toBe('NL91 ABNA 0417 1643 00')
    await user.clear(screen.getByLabelText('preferences.accountHolderName'))
    await user.click(screen.getByTitle('cancel'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
  })
})

describe('BANK-1 · the wire body buildCandidatePatch produces', () => {
  it('maps the private account to TOP-LEVEL iban + account_holder_name', () => {
    expect(buildCandidatePatch({ iban: VALID, accountHolderName: 'Jan Jansen' }))
      .toEqual({ iban: VALID, account_holder_name: 'Jan Jansen' })
  })

  it('clears a private account with null (never an empty string)', () => {
    expect(buildCandidatePatch({ iban: '', accountHolderName: '' }))
      .toEqual({ iban: null, account_holder_name: null })
  })

  it('maps the BUSINESS account NESTED under freelance — a separate account, never merged with the private one', () => {
    expect(buildCandidatePatch({ zzp: { iban: VALID, account_holder_name: 'Zorg B.V.' } }))
      .toEqual({ freelance: { iban: VALID, account_holder_name: 'Zorg B.V.' } })
  })
})

describe('BANK-1 · the server owns the IBAN verdict', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("PATCHes the private account to /candidates/{id} and shows the server's own 422 message", async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: {
      message: 'Het IBAN-controlegetal klopt niet.',
      errors: { iban: ['Het IBAN-controlegetal klopt niet.'] },
    } } })
    const { result } = renderHook(() => useCandidateRecord(), { wrapper: qcWrapper })
    result.current.patchCandidate('c1', { iban: 'NL00INGB0000000000' })
    expect(apiPatch).toHaveBeenCalledWith('/candidates/c1', { iban: 'NL00INGB0000000000' })
    // Readable server text, not a code and not a generic fallback (§10).
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Het IBAN-controlegetal klopt niet.'))
  })

  it("shows the server's 422 for the BUSINESS account too, whose error bag is keyed freelance.iban", async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: {
      message: 'Het IBAN-controlegetal klopt niet.',
      errors: { 'freelance.iban': ['Het IBAN-controlegetal klopt niet.'] },
    } } })
    const { result } = renderHook(() => useCandidateRecord(), { wrapper: qcWrapper })
    result.current.patchCandidate('c1', { zzp: { iban: 'NL00INGB0000000000', account_holder_name: 'Zorg B.V.' } })
    expect(apiPatch).toHaveBeenCalledWith('/candidates/c1', { freelance: { iban: 'NL00INGB0000000000', account_holder_name: 'Zorg B.V.' } })
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Het IBAN-controlegetal klopt niet.'))
  })
})

// FINANCIAL-GATE-1 (Danny 09-08). We measured that NO permission covered
// financial data, Danny chose to add one, and the backend now nulls these fields
// without it. The block therefore hides rather than showing two empty rows a
// viewer can neither explain nor fill.
describe('BankAccountCard · permission gate', () => {
  it('renders nothing without candidates.financial.view', () => {
    mockHasPermission.mockImplementation(() => false)
    const { container } = render(
      <BankAccountCard candidateId="cand-1" value={{ iban: 'NL91ABNA0417164300', accountHolderName: 'N. Blom' }} onSave={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('asks for exactly that permission, not a neighbouring one', () => {
    render(<BankAccountCard candidateId="cand-1" value={{ iban: '', accountHolderName: '' }} onSave={vi.fn()} />)
    expect(mockHasPermission).toHaveBeenCalledWith('candidates.financial.view')
  })
})

/**
 * DOC-BANK-1: the proof-of-bank-account slot — renders ONLY once the
 * `bank_document_id` was BOTH present in the payload (mapCandidate leaves it
 * `undefined` when the server's financial.view gate omitted the key entirely)
 * AND resolves to a real document in `documents`.
 */
describe('BankAccountCard · DOC-BANK-2 proof-of-bank slot', () => {
  const documents = [
    { id: 'doc1', name: 'bankafschrift.pdf', url: '/api/candidates/c1/documents/doc1/download' },
  ]
  const value = { iban: 'NL91ABNA0417164300', accountHolderName: 'Jan Jansen' }

  // The slot's own behaviour (link/preview/download/change/clear/upload) is
  // pinned in IbanDocumentSlot.test.tsx — here only the card's gate + wiring.
  it('renders no slot row when bankDocumentId is undefined (server omitted the field — gate closed)', () => {
    render(<BankAccountCard candidateId="cand-1" value={value} onSave={vi.fn()} documents={documents} />)
    expect(screen.queryByTestId('iban-doc-slot')).toBeNull()
  })

  it('mounts the slot once the field is present — even when nothing is linked yet (the link offer must exist)', () => {
    render(<BankAccountCard candidateId="cand-1" value={value} onSave={vi.fn()} bankDocumentId={null} documents={documents} />)
    expect(screen.getByTestId('iban-doc-slot')).toBeInTheDocument()
  })

  it("wires the slot's onLink straight into this card's own save shape", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<BankAccountCard candidateId="cand-1" value={value} onSave={onSave} bankDocumentId="doc1" documents={documents} />)
    await user.click(screen.getByTestId('iban-doc-slot-link'))
    expect(onSave).toHaveBeenCalledWith({ bank_document_id: 'stub-id' })
  })
})
