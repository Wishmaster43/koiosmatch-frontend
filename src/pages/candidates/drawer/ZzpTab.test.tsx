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

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))

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

const notifyErrorMock = vi.fn()
vi.mock('@/lib/notify', () => ({ notifyError: (msg: string) => notifyErrorMock(msg) }))

// BUSINESS-EMAIL-DUP-1: the async probe is mocked per-test so the duplicate
// path is deterministic — its own request-shape contract is covered separately
// in useBusinessEmailDuplicateCheck.test.ts (§13).
const checkDuplicateMock = vi.fn()
vi.mock('../hooks/useBusinessEmailDuplicateCheck', () => ({
  useBusinessEmailDuplicateCheck: () => ({ checkDuplicate: (email: string) => checkDuplicateMock(email) }),
}))

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
      street: 'Kerkstraat', house_number: '12', house_number_suffix: 'a',
      postal_code: '1234 AB', city: 'Utrecht', province: 'Utrecht', country: 'NL',
    })
  })

  it('province and country are searchable pick-only dropdowns (allowCreate=false), never a plain <select>', async () => {
    const user = userEvent.setup()
    const { container } = render(<ZzpTab c={candidate()} />)
    await user.click(screen.getAllByTitle('edit')[1])
    expect(container.querySelectorAll('select')).toHaveLength(0)
    const provinceRow = screen.getByText('profile.province').parentElement as HTMLElement
    expect(within(provinceRow).getByRole('button')).toHaveTextContent('Utrecht')
    await user.click(within(provinceRow).getByRole('button'))
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
    await user.click(within(countryRow).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Belgium' }))
    // BE's own province list (mocked) has no 'Utrecht' — the cascade must clear it.
    const provinceRow = screen.getByText('profile.province').parentElement as HTMLElement
    await vi.waitFor(() => expect(within(provinceRow).getByRole('button')).not.toHaveTextContent('Utrecht'))
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
    await user.click(screen.getAllByTitle('edit')[0]) // Bedrijf
    expect(screen.getByDisplayValue('12345678')).toBeInTheDocument()
    expect(screen.getByDisplayValue('NL123456789B01')).toBeInTheDocument()
  })
})

// Task 1.1.5: format check + async on-save-only duplicate warning (never a hard block).
describe('ZzpTab · business e-mail validation + duplicate check (1.1.5)', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  const openInvoicing = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByTitle('edit')[2]) // Facturatie
  }
  const typeEmail = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
    const input = screen.getByDisplayValue('old@example.com')
    await user.clear(input)
    if (value) await user.type(input, value)
  }

  it('blocks the save and reverts the draft on an invalid format, never calling the duplicate check', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await openInvoicing(user)
    await typeEmail(user, 'not-an-email')
    await user.click(screen.getByTitle('save'))
    expect(notifyErrorMock).toHaveBeenCalledTimes(1)
    expect(checkDuplicateMock).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('never probes when the e-mail is unchanged, even on a save of the same block', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await openInvoicing(user)
    await user.click(screen.getByTitle('save')) // untouched — same value as stored
    expect(checkDuplicateMock).not.toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ business_email: 'old@example.com' }))
  })

  it('fires the duplicate check exactly once, on save, for a CHANGED e-mail — no hit, save proceeds', async () => {
    checkDuplicateMock.mockResolvedValue(null)
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await openInvoicing(user)
    await typeEmail(user, 'new@example.com')
    await user.click(screen.getByTitle('save'))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ business_email: 'new@example.com' })))
    expect(checkDuplicateMock).toHaveBeenCalledWith('new@example.com')
    expect(checkDuplicateMock).toHaveBeenCalledTimes(1)
  })

  it('warns (never hard-blocks) on a hit, and still saves once the user confirms', async () => {
    checkDuplicateMock.mockResolvedValue({ id: 'cand-2', name: 'Piet Freelancer', archived: false })
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await openInvoicing(user)
    await typeEmail(user, 'new@example.com')
    await user.click(screen.getByTitle('save'))
    // The dialog itself proves the warning fired for THIS duplicate (dup.name feeds
    // the i18n interpolation — untestable at the raw-key/no-i18n-instance level this
    // file runs at, see the file header; the message KEY is asserted instead).
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('zzp.businessEmailDuplicateBody')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'zzp.businessEmailDuplicateConfirm' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ business_email: 'new@example.com' }))
  })

  it('declining the duplicate warning never saves the changed e-mail', async () => {
    checkDuplicateMock.mockResolvedValue({ id: 'cand-2', name: 'Piet Freelancer', archived: false })
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await openInvoicing(user)
    await typeEmail(user, 'new@example.com')
    await user.click(screen.getByTitle('save'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'zzp.businessEmailDuplicateCancel' }))
    expect(onSave).not.toHaveBeenCalled()
  })
})
