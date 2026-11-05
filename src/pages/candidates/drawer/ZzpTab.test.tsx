/**
 * ZzpTab — regression tests (Danny 05-08 points 1.1.1-1.1.5). Runs WITHOUT real
 * i18n (like its sibling PreferencesTab suite) — `t()` stays on raw keys, so
 * ZzpAddressCard's OWN `useTranslation('common')` + bare-key convention (see its
 * file header) is asserted here too: titles/placeholders resolve to plain
 * 'edit'/'save'/'select', never the cross-namespace 'common:edit' literal a
 * profileFieldShared-style call would produce in this same fallback mode.
 */
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

describe('ZzpTab · three blocks, own pencils', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  it('shows a pencil for Bedrijf, Adres and Facturatie, with no sub-tab strip', () => {
    render(<ZzpTab c={candidate()} />)
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getAllByTitle('edit')).toHaveLength(3)
  })

  it('editing one block leaves the other two read-only', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    await user.click(screen.getAllByTitle('edit')[0])
    expect(screen.getByTitle('save')).toBeInTheDocument()
    expect(screen.getAllByTitle('edit')).toHaveLength(2)
  })
})

// Task 1.1.1/1.1.2: street/number/suffix/postcode/city collapse into ONE composed
// line; province + land stay their own rows below it.
describe('ZzpTab · Adres composite (1.1.1/1.1.2)', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  it('read mode composes street+no+suffix and postcode+city into one line, with province/land as their own rows', () => {
    render(<ZzpTab c={candidate()} />)
    expect(screen.getByText('Kerkstraat 12-a, 1234 AB Utrecht')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
    expect(screen.getByText('NL-name')).toBeInTheDocument()
  })

  it('editing expands the composed line into loose fields', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    await user.click(screen.getAllByTitle('edit')[1]) // Adres
    expect(screen.getByDisplayValue('Kerkstraat')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()
    expect(screen.getByDisplayValue('a')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1234 AB')).toBeInTheDocument()
    // The composed read-only line is gone while editing.
    expect(screen.queryByText('Kerkstraat 12-a, 1234 AB Utrecht')).toBeNull()
  })

  it('saves the composite as loose API keys, plus province/country', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await user.click(screen.getAllByTitle('edit')[1])
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith({
      street: 'Kerkstraat', house_number: '12', house_number_suffix: 'a', address_line_2: '',
      postcode: '1234 AB', city: 'Utrecht', province: 'Utrecht', country: 'NL',
    })
  })

  it('province and country are searchable pick-only dropdowns (allowCreate=false), never a plain <select>', async () => {
    const user = userEvent.setup()
    const { container } = render(<ZzpTab c={candidate()} />)
    await user.click(screen.getAllByTitle('edit')[1])
    expect(container.querySelectorAll('select')).toHaveLength(0)
    const provinceRow = screen.getByText('profile.province').parentElement as HTMLElement
    // DROPDOWN-CLEAR-1: filter to the trigger button (has aria-haspopup), not the clear X.
    const provinceButtons = within(provinceRow).getAllByRole('button')
    const provinceTrigger = provinceButtons.find(btn => btn.hasAttribute('aria-haspopup'))!
    expect(provinceTrigger).toHaveTextContent('Utrecht')
    await user.click(provinceTrigger)
    // Search for the CURRENT value on purpose (mirrors ProfileAddressTab's own test):
    // the trigger button keeps showing the picked value regardless of the query
    // (so BOTH the trigger and the still-matching option render as 'Utrecht' —
    // hence getAllByRole below), while the non-matching option ('Zuid-Holland')
    // disappears from the filtered list entirely.
    await user.type(screen.getByPlaceholderText('select'), 'Utr')
    expect(screen.getAllByRole('button', { name: 'Utrecht' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Zuid-Holland' })).toBeNull()
  })

  it('clears a now-invalid province the moment country changes (mirrors AddLocationModal PROVINCIE-1)', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    await user.click(screen.getAllByTitle('edit')[1])
    const countryRow = screen.getByText('zzp.country').parentElement as HTMLElement
    // DROPDOWN-CLEAR-1: filter to the trigger button (has aria-haspopup), not the clear X.
    const countryButtons = within(countryRow).getAllByRole('button')
    const countryTrigger = countryButtons.find(btn => btn.hasAttribute('aria-haspopup'))!
    await user.click(countryTrigger)
    await user.click(screen.getByRole('button', { name: 'Belgium' }))
    // BE's own province list (mocked) has no 'Utrecht' — the cascade must clear it.
    const provinceRow = screen.getByText('profile.province').parentElement as HTMLElement
    const provinceButtons = within(provinceRow).getAllByRole('button')
    const provinceTrigger = provinceButtons.find(btn => btn.hasAttribute('aria-haspopup'))!
    await vi.waitFor(() => expect(provinceTrigger).not.toHaveTextContent('Utrecht'))
  })
})

// Task 1.1.2/1.1.3: KVK/BTW render as real hyperlinks in read mode (edit stays plain).
describe('ZzpTab · KVK/BTW as hyperlinks (1.1.2/1.1.3)', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  it('KVK links to the CoC register and VAT links to VIES', () => {
    render(<ZzpTab c={candidate()} />)
    const kvkLink = screen.getByRole('link', { name: '12345678' })
    expect(kvkLink).toHaveAttribute('href', expect.stringContaining('kvk.nl'))
    const vatLink = screen.getByRole('link', { name: 'NL123456789B01' })
    expect(vatLink).toHaveAttribute('href', expect.stringContaining('vies'))
  })

  it('edit mode still shows KVK/VAT as plain inputs', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    // 69-17: KVK/BTW moved from Bedrijf into the Financieel card (was Facturatie).
    await user.click(screen.getAllByTitle('edit')[2]) // Financieel
    expect(screen.getByDisplayValue('12345678')).toBeInTheDocument()
    expect(screen.getByDisplayValue('NL123456789B01')).toBeInTheDocument()
  })
})

// 69-17: KVK/BTW(/KOR) moved from the Bedrijf card into the Financieel card
// (renamed from Facturatie) — same fields, same edit behaviour, new home.
describe('ZzpTab · KVK/BTW/KOR live under Financieel (69-17)', () => {
  it('the Bedrijf card only edits the company name — no KVK/VAT there', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    await user.click(screen.getAllByTitle('edit')[0]) // Bedrijf
    expect(screen.queryByDisplayValue('12345678')).toBeNull()
    expect(screen.queryByDisplayValue('NL123456789B01')).toBeNull()
  })

  it('saving KVK/BTW/KOR from the Financieel card sends the same API keys as before', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await user.click(screen.getAllByTitle('edit')[2]) // Financieel
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      kvk_number: '12345678', vat_number: 'NL123456789B01', kor: false,
    }))
  })
})
