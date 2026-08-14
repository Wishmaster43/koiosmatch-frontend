/**
 * DetailsLocationTab · V9 (VACATURES-100) regression guard: address fields
 * mirror the candidate ProfileAddressTab canon exactly — read mode composes
 * ONE line (street+no-suffix, postcode+city), edit mode shows FIVE separate
 * labelled rows (street / houseNumber / houseNumberSuffix / postalCode /
 * city), never a houseNumber+suffix pair squeezed onto one row. Province/
 * country stay searchable pick-only dropdowns resolving to a display name.
 *
 * Real i18n IS live here (unlike DetailsTab.test.tsx's mocked-hook siblings):
 * this component imports `composeAddress` from the real hook module, which
 * transitively pulls in `lib/datetime` → `src/i18n`, so `t()` resolves to
 * the actual NL strings (fallback locale) instead of echoing raw keys.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DetailsLocationTab from './DetailsLocationTab'
import type { VacancyDetail } from '@/types/vacancy'
import type { LocationSection } from '../hooks/useVacancyDetailsForm'

// Deterministic stand-in for the real ISO-3166 + Intl.DisplayNames lookup — the
// real function is exercised by countries.test.ts, not here.
vi.mock('@/lib/countries', () => ({
  getCountryOptions: () => [{ value: 'NL', label: 'Netherlands' }],
  getCountryName: (code: string) => (code === 'NL' ? 'Netherlands' : code),
}))

const vacancy = {
  id: 'v1', street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: 'a',
  postalCode: '1234 AB', city: 'Utrecht', province: 'Utrecht', country: 'NL', location: '',
} as unknown as VacancyDetail

// One section's mock shape (mirrors DetailsTab.test.tsx's baseSection convention) —
// this sub-tab only ever reads/calls its OWN `location` section.
const makeLocation = (overrides: Partial<LocationSection> = {}): LocationSection => ({
  editing: false, setEditing: vi.fn(),
  form: { street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: 'a', postalCode: '1234 AB', city: 'Utrecht', province: 'Utrecht', country: 'NL' },
  setF: vi.fn(), save: vi.fn(), cancel: vi.fn(), provinces: ['Utrecht'],
  // VAC-VESTIGING-1: the bureau branch id/setter/options — defaults mirror the
  // other sections' empty state (nothing picked, one option available).
  branchId: '', setBranchId: vi.fn(), branchOptions: [{ value: 'branch-1', label: 'Hoofdkantoor Assen' }],
  ...overrides,
})

describe('DetailsLocationTab · address canon (V9)', () => {
  it('read mode composes street+no+suffix and postcode+city into one line', () => {
    render(<DetailsLocationTab vacancy={vacancy} location={makeLocation()} />)
    expect(screen.getByText('Kerkstraat 12-a, 1234 AB Utrecht')).toBeInTheDocument()
    // The loose per-field labels never show in read mode — only the composed line.
    expect(screen.queryByText('Straat')).not.toBeInTheDocument()
  })

  it('edit mode shows FIVE separate address rows, never a paired houseNumber+suffix row', () => {
    render(<DetailsLocationTab vacancy={vacancy} location={makeLocation({ editing: true })} />)
    expect(screen.getByText('Straat')).toBeInTheDocument()
    expect(screen.getByText('Huisnummer')).toBeInTheDocument()
    expect(screen.getByText('Toevoeging')).toBeInTheDocument()
    expect(screen.getByText('Postcode')).toBeInTheDocument()
    expect(screen.getByText('Plaats')).toBeInTheDocument()
    // The OLD combined "Huisnummer / Toevoeging" label must be gone.
    expect(screen.queryByText('Huisnummer / Toevoeging')).not.toBeInTheDocument()
    expect(screen.queryByText(/\/ Toevoeging/)).not.toBeInTheDocument()
  })

  it('province/country resolve to their display name in read mode (searchable pick-only in edit mode)', () => {
    render(<DetailsLocationTab vacancy={vacancy} location={makeLocation()} />)
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
    expect(screen.getByText('Netherlands')).toBeInTheDocument()
  })

  it('falls back to a dash when province/country are unset', () => {
    const empty = { ...vacancy, province: '', country: '' } as VacancyDetail
    render(<DetailsLocationTab vacancy={empty} location={makeLocation()} />)
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2)
  })
})

// VAC-VESTIGING-1: the vacancy's own bureau branch (vestiging) round-trips
// through mapVacancy.ts and is now a real editable picker (was read-only).
describe('DetailsLocationTab · bureau branch / vestiging (VAC-VESTIGING-1)', () => {
  it('renders the resolved branch name in read mode', () => {
    // A name distinct from the fixture's own province ('Utrecht') so this
    // assertion can't accidentally match that unrelated row instead.
    const withBranch = { ...vacancy, branchName: 'Hoofdkantoor Assen' } as VacancyDetail
    render(<DetailsLocationTab vacancy={withBranch} location={makeLocation()} />)
    expect(screen.getByText('Hoofdkantoor Assen')).toBeInTheDocument()
  })

  it('falls back to a dash when no branch was ever picked', () => {
    const noBranch = { ...vacancy, branchName: '' } as VacancyDetail
    render(<DetailsLocationTab vacancy={noBranch} location={makeLocation()} />)
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1)
  })

  it('edit mode offers a searchable branch picker seeded with the tenant\'s branches', () => {
    render(<DetailsLocationTab vacancy={vacancy} location={makeLocation({ editing: true, branchId: 'branch-1' })} />)
    expect(screen.getByText('Hoofdkantoor Assen')).toBeInTheDocument()
  })

  it('picking a branch calls setBranchId with the picked id', async () => {
    const setBranchId = vi.fn()
    const { default: userEvent } = await import('@testing-library/user-event')
    render(<DetailsLocationTab vacancy={vacancy} location={makeLocation({ editing: true, setBranchId })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Selecteer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Hoofdkantoor Assen' }))
    expect(setBranchId).toHaveBeenCalledWith('branch-1')
  })
})
