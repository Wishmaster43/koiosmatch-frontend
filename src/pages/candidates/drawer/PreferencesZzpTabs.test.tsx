/**
 * PreferencesTab / ZzpTab — sub-tab regression tests (Danny kandidaten-ronde-2,
 * punten D/E). Both tabs' underlying EditableFieldTable pulls in useDateFormat
 * for its 'date' field type, which transitively initialises real i18n — stub it
 * so `t()` stays on raw keys, like EditableFieldTable.test.tsx and every other
 * test in this repo that doesn't deliberately opt into real i18n.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreferencesTab, ZzpTab } from './PreferencesZzpTabs'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ candidateTypes: [], statusMeta: () => ({ label: '', color: '#000' }) }),
}))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [], allowFreeEntry: true }) }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: [] }) }))
vi.mock('@/lib/useDriverLicenses', () => ({ useDriverLicenses: () => ({ licenses: [] }) }))

const candidate = (): Candidate => ({
  id: 1, candidateTypes: [], preferences: {}, zzp: {}, archived: false, status: 'available',
} as unknown as Candidate)

describe('PreferencesTab · sub-tabs (kandidaten-ronde-2, punt D)', () => {
  it('renders the four sub-tabs in the named (non-alphabetical) order, defaulting to Beschikbaarheid', () => {
    render(<PreferencesTab c={candidate()} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs).toEqual(['preferences.groupAvailability', 'preferences.groupTravel', 'preferences.groupFinancial', 'preferences.groupOther'])
    expect(screen.getByRole('tab', { name: 'preferences.groupAvailability' })).toHaveAttribute('aria-selected', 'true')
    // An availability-only field is visible by default; a travel-only field isn't.
    expect(screen.getByText('preferences.days')).toBeInTheDocument()
    expect(screen.queryByText('preferences.ownTransport')).toBeNull()
  })

  // Addendum 4: Beschikbaarheid's own group-card title ("Beschikbaarheid") would
  // just repeat the sub-tab bar right above it — it must not render twice.
  it('does not repeat the Beschikbaarheid label as an in-content group heading', () => {
    render(<PreferencesTab c={candidate()} />)
    expect(screen.getAllByText('preferences.groupAvailability')).toHaveLength(1) // the sub-tab button only
  })

  it('Reizen shows the travel fields (eigen vervoer, rijbewijs, reisafstand) and hides Beschikbaarheid, with no repeated Reizen heading', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupTravel' }))
    expect(screen.getByText('preferences.ownTransport')).toBeInTheDocument()
    expect(screen.getByText('preferences.license')).toBeInTheDocument()
    expect(screen.getByText('preferences.maxDistance')).toBeInTheDocument()
    expect(screen.queryByText('preferences.days')).toBeNull()
    expect(screen.getAllByText('preferences.groupTravel')).toHaveLength(1) // the sub-tab button only
  })

  // PREF-PENCIL-SPLIT-1 (05-08): the Reizen save must PATCH only its own keys —
  // never Beschikbaarheid's (available_from/hours_per_week/…), even though the
  // table's internal draft still carries the complete preferences object.
  it('Reizen save sends ONLY the travel keys', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<PreferencesTab c={candidate()} onSave={onSave} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupTravel' }))
    await user.click(screen.getByTitle('edit'))
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    const body = onSave.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(
      ['license_categories', 'max_travel_km', 'max_travel_min', 'own_transport'].sort(),
    )
  })

  // EDIT-STATE-LEAK (Danny 05-08: "beschikbaarheid wijzig → Reizen ook wijzigbaar"):
  // the sub-tab tables share one React slot, so a non-unique key let the internal
  // editing state survive a tab switch. Guards the section-unique keys.
  it('a pencil opened on Beschikbaarheid does NOT leave Reizen in edit mode after a tab switch', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} onSave={vi.fn()} />)
    await user.click(screen.getByTitle('edit'))
    expect(screen.getByTitle('save')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'preferences.groupTravel' }))
    expect(screen.queryByTitle('save')).toBeNull()
    expect(screen.getByTitle('edit')).toBeInTheDocument()
  })

  // Punt D update: Financieel took over Loonheffing (was under Overig) and keeps
  // its OWN "Loonheffing" group-card heading — a genuine sub-section, distinct
  // from the "Financieel" sub-tab label, so it's allowed to stay.
  it('Financieel shows the Loonheffing fields under their own (non-duplicate) group heading', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupFinancial' }))
    expect(screen.getByText('preferences.wageTax')).toBeInTheDocument()
    expect(screen.getByText('preferences.wageTaxFrom')).toBeInTheDocument()
    expect(screen.getByText('preferences.groupPayroll')).toBeInTheDocument()
    // Opmerkingen (Overig) isn't part of Financieel.
    expect(screen.queryByText('preferences.remarks')).toBeNull()
  })

  // PREF-PENCIL-SPLIT-1 (05-08): Financieel holds TWO distinct sections
  // (Loonheffing, Gewenst tarief) — each now gets its own card + pencil, so
  // editing one must never flip the other into edit mode (same regression class
  // as VAC-DETAILS-SPLIT-1 / the ZzpTab split above).
  it('Financieel shows Loonheffing and Gewenst tarief as two separately-editable cards', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupFinancial' }))
    expect(screen.getByText('preferences.groupDesiredRate')).toBeInTheDocument()
    expect(screen.getAllByTitle('edit')).toHaveLength(2)
    // Editing Loonheffing leaves Gewenst tarief read-only (one pencil left).
    await user.click(screen.getAllByTitle('edit')[0])
    expect(screen.getByTitle('save')).toBeInTheDocument()
    expect(screen.getAllByTitle('edit')).toHaveLength(1)
    expect(screen.getByText('preferences.desiredRateMin')).toBeInTheDocument()
  })

  // Overig now holds ONLY Opmerkingen (Loonheffing moved to Financieel) — its
  // single remaining group shares its own label with the sub-tab, so addendum 4
  // strips that heading too (one calm, un-headed card).
  it('Overig now holds only Opmerkingen, with no repeated Overig heading', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupOther' }))
    expect(screen.getByText('preferences.remarks')).toBeInTheDocument()
    expect(screen.queryByText('preferences.wageTax')).toBeNull()
    expect(screen.getAllByText('preferences.groupOther')).toHaveLength(1) // the sub-tab button only
  })
})

// "Potlood op de statuswissel" (Danny 2026-07-20, job A): the status banner gets
// an edit pencil that reopens the prefilled status modal — only when the host
// (CandidateDrawer) passes onEditStatus; additive prop, zero behaviour change
// for a candidate whose statusWindow banner isn't showing at all.
describe('PreferencesTab · status edit pencil (Danny 2026-07-20)', () => {
  const sickCandidate = (): Candidate => ({
    id: 1, candidateTypes: [], preferences: {}, zzp: {}, archived: false,
    status: 'sick', statusChangedAt: '2026-07-01T00:00:00.000Z', statusReturnDate: '2026-08-01T00:00:00.000Z',
  } as unknown as Candidate)

  it('shows the pencil next to the status banner when onEditStatus is passed', () => {
    render(<PreferencesTab c={sickCandidate()} onEditStatus={vi.fn()} />)
    expect(screen.getByTitle('drawer.editStatusReason')).toBeInTheDocument()
  })

  it('calls onEditStatus when the pencil is clicked', async () => {
    const user = userEvent.setup()
    const onEditStatus = vi.fn()
    render(<PreferencesTab c={sickCandidate()} onEditStatus={onEditStatus} />)
    await user.click(screen.getByTitle('drawer.editStatusReason'))
    expect(onEditStatus).toHaveBeenCalledTimes(1)
  })

  it('renders no pencil when onEditStatus is not passed (additive prop)', () => {
    render(<PreferencesTab c={sickCandidate()} />)
    expect(screen.queryByTitle('drawer.editStatusReason')).toBeNull()
  })
})

// Danny 28-07: ZZP is ONE tab again — no sub-tab strip. Three blocks (Bedrijf ·
// Adres · Facturatie), each with its own pencil and its own title ABOVE its card,
// mirroring what the Profiel tab now does. Only the "one pencil flips everything"
// behaviour was the complaint; the layout itself stays put.
describe('ZzpTab · one tab, a pencil per block', () => {
  it('shows all three blocks at once, with no sub-tab strip', () => {
    render(<ZzpTab c={candidate()} />)
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    // Bedrijf, Adres and Facturatie fields are all on screen together.
    expect(screen.getByText('zzp.companyName')).toBeInTheDocument()
    expect(screen.getByText('zzp.street')).toBeInTheDocument()
    expect(screen.getByText('zzp.creditor')).toBeInTheDocument()
  })

  it('titles each block once, outside its card, with its own pencil', () => {
    render(<ZzpTab c={candidate()} />)
    for (const title of ['zzp.groupCompany', 'zzp.groupAddress', 'zzp.groupInvoicing']) {
      // Exactly one heading per block — no in-card repeat of the same word.
      expect(screen.getAllByText(title)).toHaveLength(1)
    }
    expect(screen.getAllByTitle('edit')).toHaveLength(3)
  })

  it('editing one block leaves the other two read-only', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    await user.click(screen.getAllByTitle('edit')[0])
    expect(screen.getByTitle('save')).toBeInTheDocument()
    expect(screen.getAllByTitle('edit')).toHaveLength(2)
  })

  it('saving a block still sends the full ZZP payload, unchanged', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ZzpTab c={candidate()} onSave={onSave} />)
    await user.click(screen.getAllByTitle('edit')[2])   // Facturatie
    await user.click(screen.getByTitle('save'))
    // The request shape is the same one the single table produced before the split.
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      company_name: expect.anything(), street: expect.anything(), iban: expect.anything(),
    }))
  })
})
