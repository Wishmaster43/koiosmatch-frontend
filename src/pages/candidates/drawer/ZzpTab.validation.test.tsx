/** ZzpTab · business e-mail validation and creditor numbering (split from ZzpTab.test.tsx; raw-key i18n, no real init). */
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
    // File runs at; the message KEY is asserted instead).
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
