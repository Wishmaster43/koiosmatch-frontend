/** ZzpTab · bank accounts, identifier hints and VIES check (split from ZzpTab.test.tsx; raw-key i18n, no real init). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZzpTab } from './PreferencesZzpTabs'
import type { Candidate } from '@/types/candidate'

// FINANCIAL-GATE-1: the bank-account rows are permission-gated now, so this
// suite renders as a viewer who HAS candidates.financial.view. The gate itself
// is proven in BankAccountCard.test.tsx.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, formatTime: (v: string) => v, locale: 'nl-NL' }) }))

// COUNTRIES-LOOKUP-1 (task point 2): the tenant operating-country whitelist,
// deliberately distinct from lib/countries' full ISO list.
vi.mock('@/lib/useCountriesLookup', () => ({
  useCountriesLookup: () => ({ options: [{ value: 'NL', label: 'Netherlands' }, { value: 'BE', label: 'Belgium' }], loading: false }),
}))
// Deterministic display name, independent of the test environment's ICU data.
vi.mock('@/lib/countries', () => ({ getCountryName: (code: string) => (code ? `${code}-name` : '') }))
// Province list CASCADES on country — BE deliberately does NOT offer 'Utrecht',
// so switching NL -> BE must clear a previously-picked NL province (task point 2).
vi.mock('@/hooks/useProvinces', () => ({
  useProvinces: (country: string) => ({ provinces: country === 'BE' ? ['Antwerpen'] : ['Utrecht', 'Zuid-Holland'] }),
}))

const apiPostMock = vi.fn()
vi.mock('@/lib/api', async (orig) => {
  const actual = await orig<typeof import('@/lib/api')>()
  return { ...actual, default: Object.assign(actual.default, { post: (...a: unknown[]) => apiPostMock(...a) }) }
})

const notifyErrorMock = vi.fn()
vi.mock('@/lib/notify', () => ({ notifyError: (msg: string) => notifyErrorMock(msg) }))

// BUSINESS-EMAIL-DUP-1: the async probe is mocked per-test so the duplicate
// path is deterministic — its own request-shape contract is covered separately
// in useBusinessEmailDuplicateCheck.test.ts (§13).
const checkDuplicateMock = vi.fn()
vi.mock('../hooks/useBusinessEmailDuplicateCheck', () => ({
  useBusinessEmailDuplicateCheck: () => ({ checkDuplicate: (email: string) => checkDuplicateMock(email) }),
}))

// CREDITOR-AUTO-1: the numbering-entities lookup (real "on auto" signal) and the
// full-record re-fetch (adopts a BE-assigned creditor number) are both mocked
// per-test so the gating + re-read behaviour is deterministic.
const numberingEntitiesMock = vi.fn()
vi.mock('@/lib/useNumberingEntities', () => ({
  useNumberingEntities: () => numberingEntitiesMock(),
}))
const fetchDetailMock = vi.fn()
vi.mock('../hooks/useCandidateMutations', () => ({
  useCandidateRecord: () => ({ fetchDetail: (id: string) => fetchDetailMock(id), patchCandidate: vi.fn() }),
}))
// Default: no `zzp_creditor` numbering entity yet (today's live backend reality,
// see the ZzpTab.tsx file header) — a test that needs the locked-row branch
// overrides this with its own mockReturnValue.
beforeEach(() => {
  numberingEntitiesMock.mockReset()
  numberingEntitiesMock.mockReturnValue({ entities: [{ key: 'candidate', prefix: 'K', pad: 5, start: 1, label: 'Kandidaat' }], loading: false })
  fetchDetailMock.mockReset()
})

const candidate = (zzp: Record<string, unknown> = {}): Candidate => ({
  id: 'cand-1', candidateTypes: [], preferences: {}, archived: false, status: 'available',
  zzp: {
    company_name: 'Freelance BV', kvk_number: '12345678', vat_number: 'NL123456789B01', kor: false,
    street: 'Kerkstraat', house_number: '12', house_number_suffix: 'a', postal_code: '1234 AB', city: 'Utrecht',
    province: 'Utrecht', country: 'NL',
    creditor_number: 'CR-1', business_email: 'old@example.com', iban: 'NL91ABNA0417164300',
    ...zzp,
  },
} as unknown as Candidate)

// BANK-1 (Danny 2026-08-09, point 2): the BUSINESS account gets its tenaamstelling
// next to the IBAN that was already there. Both fields ride in the SAME Facturatie
// save — one row added, nothing moved. The IBAN's display grouping is a view
// concern only: what leaves this tab is the ungrouped wire form, because the API
// stores the string verbatim (measured 2026-08-09 — see BankAccountCard.test.tsx).
describe('ZzpTab · BANK-1 business account (IBAN + tenaamstelling)', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  const openInvoicing = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByTitle('edit')[2]) // Facturatie
  }

  it('shows the tenaamstelling row inside Facturatie, next to the IBAN', () => {
    render(<ZzpTab c={candidate({ account_holder_name: 'Zorg B.V.' })} />)
    expect(screen.getByText('zzp.iban')).toBeInTheDocument()
    expect(screen.getByText('zzp.accountHolderName')).toBeInTheDocument()
    expect(screen.getByText('Zorg B.V.')).toBeInTheDocument()
  })

  it('renders the stored IBAN in readable groups of four', () => {
    render(<ZzpTab c={candidate()} />) // fixture stores NL91ABNA0417164300
    expect(screen.getByText('NL91 ABNA 0417 1643 00')).toBeInTheDocument()
  })

  it('sends iban WITHOUT spaces and account_holder_name trimmed, in the same Facturatie save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate({ iban: '', account_holder_name: '' })} onSave={onSave} />)
    await openInvoicing(user)
    const ibanRow = screen.getByText('zzp.iban').parentElement as HTMLElement
    const holderRow = screen.getByText('zzp.accountHolderName').parentElement as HTMLElement
    await user.type(within(ibanRow).getByRole('textbox'), 'nl91 abna 0417 1643 00')
    await user.type(within(holderRow).getByRole('textbox'), '  Zorg B.V. ')
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      iban: 'NL91ABNA0417164300', account_holder_name: 'Zorg B.V.',
    }))
  })

  it('clears both fields with empty strings (the API turns them into NULL, measured)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate({ account_holder_name: 'Zorg B.V.' })} onSave={onSave} />)
    await openInvoicing(user)
    await user.clear(within(screen.getByText('zzp.iban').parentElement as HTMLElement).getByRole('textbox'))
    await user.clear(within(screen.getByText('zzp.accountHolderName').parentElement as HTMLElement).getByRole('textbox'))
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ iban: '', account_holder_name: '' }))
  })
})

// BANK-1 regression: the two accounts must never bleed into each other. This tab
// used to fall back to a top-level `iban` on the record ("legacy flat field") —
// harmless while nothing set it, a data leak the moment BANK-1 made that field
// the candidate's PRIVATE salary account.
describe('ZzpTab · BANK-1 never falls back to the private salary account', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  it('shows an empty business IBAN even when the candidate has a private one', () => {
    const c = { ...candidate({ iban: '', account_holder_name: '' }), iban: 'NL91ABNA0417164300', accountHolderName: 'Jan Jansen' } as unknown as Candidate
    render(<ZzpTab c={c} />)
    expect(screen.queryByText('NL91 ABNA 0417 1643 00')).toBeNull()
    expect(screen.queryByText('Jan Jansen')).toBeNull()
  })

  it('never writes the private account into freelance on a Facturatie save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const c = { ...candidate({ iban: '', account_holder_name: '' }), iban: 'NL91ABNA0417164300', accountHolderName: 'Jan Jansen' } as unknown as Candidate
    render(<ZzpTab c={c} onSave={onSave} />)
    await user.click(screen.getAllByTitle('edit')[2]) // Facturatie
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ iban: '', account_holder_name: '' }))
  })
})

// LANE-I2-1: backend now sends advisory-only hints per KvK/VAT identifier.
// The FE displays these under the fields but never blocks saving (hints are
// informational only).
describe('ZzpTab · LANE-I2-1 freelance identifier hints', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  it('shows no hint when status is "empty"', () => {
    render(<ZzpTab c={candidate({
      kvk_number_hint: { status: 'empty', country_code: null, example: null },
      vat_number_hint: { status: 'empty', country_code: null, example: null },
    })} />)
    // The component should not render any hint div (raw-key mode: no hints rendered)
    expect(screen.queryByText('zzp.hintExample')).toBeNull()
    expect(screen.queryByText('zzp.hintInvalid')).toBeNull()
    expect(screen.queryByText('zzp.hintUnverifiable')).toBeNull()
  })

  it('shows no hint when status is "valid"', () => {
    render(<ZzpTab c={candidate({
      kvk_number_hint: { status: 'valid', country_code: 'NL', example: '12345678' },
      vat_number_hint: { status: 'valid', country_code: 'NL', example: 'NL123456789B01' },
    })} />)
    expect(screen.queryByText('zzp.hintInvalid')).toBeNull()
    expect(screen.queryByText('zzp.hintUnverifiable')).toBeNull()
  })

  it('shows an "invalid" hint with the example when status is "invalid"', () => {
    const { container } = render(<ZzpTab c={candidate({
      kvk_number_hint: { status: 'invalid', country_code: 'NL', example: '12345678' },
    })} />)
    // The hint text should be rendered with the i18n key and example
    const html = container.innerHTML
    // In raw-key mode, we look for the key and the example value
    expect(html).toMatch(/12345678/)
  })

  it('shows an "unverifiable" hint in muted color and italic when status is "unverifiable"', () => {
    render(<ZzpTab c={candidate({
      vat_number_hint: { status: 'unverifiable', country_code: null, example: null },
    })} />)
    const hint = screen.getByText('zzp.hintUnverifiable')
    expect(hint).toHaveInlineStyle({ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' })
  })

  it('never blocks saving despite an "invalid" hint', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate({
      kvk_number_hint: { status: 'invalid', country_code: 'NL', example: '12345678' },
    })} onSave={onSave} />)
    // Even with an invalid hint shown, saving must work
    await user.click(screen.getAllByTitle('edit')[2]) // Financieel
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalled()
  })

  it('PATCH body carries a non-Dutch VAT unchanged (backend now accepts any text)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate({
      vat_number: 'BE0123456789',
      vat_number_hint: { status: 'valid', country_code: 'BE', example: 'BE0123456789' },
    })} onSave={onSave} />)
    await user.click(screen.getAllByTitle('edit')[2])
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ vat_number: 'BE0123456789' }))
  })
})

describe('ZzpTab · VIES check', () => {
  beforeEach(() => { apiPostMock.mockReset(); notifyErrorMock.mockReset() })

  it('disables the button when no VAT number is stored', () => {
    render(<ZzpTab c={candidate({ vat_number: '' })} />)
    expect(screen.getByRole('button', { name: 'zzp.viesCheck' })).toBeDisabled()
  })

  it('posts to the verify-vat route and shows the valid verdict with its date', async () => {
    apiPostMock.mockResolvedValue({ data: { data: { verdict: 'valid', vat_verified_at: '2026-10-21T10:00:00Z' } } })
    render(<ZzpTab c={candidate()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'zzp.viesCheck' }))
    expect(apiPostMock).toHaveBeenCalledTimes(1)
    expect(apiPostMock.mock.calls[0][0]).toBe('/candidates/cand-1/freelance/verify-vat')
    expect(await screen.findByText('zzp.viesValid')).toBeInTheDocument()
  })

  it('shows the unknown verdict when VIES was unreachable', async () => {
    apiPostMock.mockResolvedValue({ data: { data: { verdict: 'unknown', vat_verified_at: null } } })
    render(<ZzpTab c={candidate()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'zzp.viesCheck' }))
    expect(await screen.findByText('zzp.viesUnknown')).toBeInTheDocument()
  })

  it('shows the stored verdict from the record and no line when absent', () => {
    const { unmount } = render(<ZzpTab c={candidate({ vat_verified_valid: false, vat_verified_at: '2026-10-21T10:00:00Z' })} />)
    expect(screen.getByText('zzp.viesInvalid')).toBeInTheDocument()
    unmount()
    render(<ZzpTab c={candidate()} />)
    expect(screen.queryByText('zzp.viesInvalid')).toBeNull()
  })

  it('reports a failed request through notifyError with the fallback text', async () => {
    apiPostMock.mockRejectedValue(new Error('Network Error'))
    render(<ZzpTab c={candidate()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'zzp.viesCheck' }))
    await vi.waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith('zzp.viesFailed'))
  })

  it('renders no verdict for a never-checked record (valid:null, no stamp)', () => {
    render(<ZzpTab c={candidate({ vat_verified_valid: null, vat_verified_at: null })} />)
    expect(screen.queryByText('zzp.viesUnknown')).toBeNull()
    expect(screen.queryByText('zzp.viesValid')).toBeNull()
    expect(screen.queryByText('zzp.viesInvalid')).toBeNull()
  })

  it('renders the unknown verdict for a stamped record with valid:null (VIES timeout)', () => {
    render(<ZzpTab c={candidate({ vat_verified_valid: null, vat_verified_at: '2026-10-21T10:00:00Z' })} />)
    expect(screen.getByText('zzp.viesUnknown')).toBeInTheDocument()
  })

  it('shows the translated text, not the Dutch server sentence, on a 422 no-VAT refusal', async () => {
    apiPostMock.mockRejectedValue({ response: { status: 422, data: { message: 'Geen BTW-nummer geregistreerd.' } } })
    render(<ZzpTab c={candidate()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'zzp.viesCheck' }))
    await vi.waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith('zzp.viesFailed'))
    expect(apiPostMock.mock.calls[0][0]).toBe('/candidates/cand-1/freelance/verify-vat')
  })

  it('maps the vat_number_missing code to zzp.vatMissing on the verify-vat POST', async () => {
    apiPostMock.mockRejectedValue({ response: { status: 422, data: { code: 'vat_number_missing', message: 'Geen BTW-nummer geregistreerd.' } } })
    render(<ZzpTab c={candidate()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'zzp.viesCheck' }))
    await vi.waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith('zzp.vatMissing'))
    expect(apiPostMock.mock.calls[0][0]).toBe('/candidates/cand-1/freelance/verify-vat')
  })

  it('drops the local verdict when the drawer switches to another candidate', async () => {
    apiPostMock.mockResolvedValue({ data: { data: { verdict: 'valid', vat_verified_at: null } } })
    const { rerender } = render(<ZzpTab c={candidate()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'zzp.viesCheck' }))
    expect(await screen.findByText('zzp.viesValidNoDate')).toBeInTheDocument()
    rerender(<ZzpTab c={{ ...candidate(), id: 'cand-2' }} />)
    expect(screen.queryByText('zzp.viesValidNoDate')).toBeNull()
    expect(screen.queryByText('zzp.viesValid')).toBeNull()
  })
})
