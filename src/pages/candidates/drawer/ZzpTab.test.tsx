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

// CREDITOR-AUTO-1 (job fe-creditor-auto): the FE cannot confirm the tenant's
// numbering state today (no `zzp_creditor` entity in the live numbering-entities
// response, see the ZzpTab.tsx file header) — this asserts BOTH branches so the
// day the backend adds that entity, the locked-row branch is already proven.
describe('ZzpTab · CREDITOR-AUTO-1 numbering gate', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  it('keeps the creditor field editable, with a muted auto-assign hint, when it is empty and no zzp_creditor numbering entity exists', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate({ creditor_number: '' })} />)
    expect(screen.getByText('zzp.creditorAutoHint')).toBeInTheDocument()
    // No locked-row note in this branch.
    expect(screen.queryByText('zzp.creditorAutoLocked')).toBeNull()
    await user.click(screen.getAllByTitle('edit')[2]) // Facturatie
    const crediteurRow = screen.getByText('zzp.creditor').parentElement as HTMLElement
    expect(within(crediteurRow).getByRole('textbox')).toBeInTheDocument()
  })

  it('hides the auto-assign hint once a creditor number is already stored', () => {
    render(<ZzpTab c={candidate()} />) // default fixture: creditor_number 'CR-1'
    expect(screen.queryByText('zzp.creditorAutoHint')).toBeNull()
  })

  it('renders the creditor number as a locked, read-only row once the numbering-entities lookup reports zzp_creditor', async () => {
    numberingEntitiesMock.mockReturnValue({ entities: [{ key: 'zzp_creditor', prefix: 'CR', pad: 5, start: 1, label: 'Crediteur' }], loading: false })
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    expect(screen.queryByText('zzp.creditorAutoHint')).toBeNull()
    expect(screen.getByText('zzp.creditorAutoLocked')).toBeInTheDocument()
    expect(screen.getByText('CR-1')).toBeInTheDocument()
    // Editing Facturatie must NOT offer an input for it — only e-mail/IBAN do.
    await user.click(screen.getAllByTitle('edit')[2])
    expect(screen.queryByDisplayValue('CR-1')).toBeNull()
    expect(screen.getByDisplayValue('old@example.com')).toBeInTheDocument()
  })
})

// CREDITOR-AUTO-1: the backend auto-assigns a BLANK creditor number on save (its
// own numbering sequence) — the optimistic onSave above only echoes back what was
// typed, so this tab must re-read the record itself to pick up the real number.
describe('ZzpTab · CREDITOR-AUTO-1 re-reads a blank creditor number after save', () => {
  beforeEach(() => { checkDuplicateMock.mockReset(); notifyErrorMock.mockReset() })

  const openInvoicing = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByTitle('edit')[2]) // Facturatie
  }

  it('re-fetches the record and adopts the BE-assigned number when the field was saved blank', async () => {
    fetchDetailMock.mockResolvedValue(candidate({ creditor_number: 'CR-99' }))
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate({ creditor_number: '' })} onSave={onSave} />)
    await openInvoicing(user)
    await user.click(screen.getByTitle('save')) // saved blank — nothing typed
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ creditor_number: '' }))
    await vi.waitFor(() => expect(fetchDetailMock).toHaveBeenCalledWith('cand-1'))
    await vi.waitFor(() => expect(screen.getByText('CR-99')).toBeInTheDocument())
  })

  it('never re-fetches when a creditor number was already present at save time', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />) // default fixture: creditor_number 'CR-1'
    await openInvoicing(user)
    await user.click(screen.getByTitle('save'))
    expect(fetchDetailMock).not.toHaveBeenCalled()
  })
})

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
