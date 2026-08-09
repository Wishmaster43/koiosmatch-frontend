/**
 * PreferencesTab — sub-tab regression tests (Danny kandidaten-ronde-2, punten D/E).
 * ZzpTab's own tests moved to ZzpTab.test.tsx alongside its new file (05-08 split).
 * The underlying EditableFieldTable pulls in useDateFormat for its 'date' field
 * type, which transitively initialises real i18n — stub it so `t()` stays on raw
 * keys, like EditableFieldTable.test.tsx and every other test in this repo that
 * doesn't deliberately opt into real i18n.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreferencesTab } from './PreferencesZzpTabs'
import { buildCandidatePatch } from '../data/candidatesShared'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ candidateTypes: [], statusMeta: () => ({ label: '', color: '#000' }) }),
}))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [], allowFreeEntry: true }) }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: [] }) }))
vi.mock('@/lib/useDriverLicenses', () => ({ useDriverLicenses: () => ({ licenses: [] }) }))
// NOODCONTACT-SPLIT-1: EmergencyContactCard's relation dropdown now fetches its
// own lookup — mocked for isolation, mirrors the other lookup hooks above.
vi.mock('@/lib/useEmergencyContactRelations', () => ({ useEmergencyContactRelations: () => ({ emergencyContactRelations: [] }) }))

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

  // PREF-PENCIL-SPLIT-1 (05-08): Financieel holds distinct sections — each gets
  // its own card + pencil, so editing one must never flip another into edit mode
  // (same regression class as VAC-DETAILS-SPLIT-1 / ZzpTab's own
  // Bedrijf/Adres/Facturatie split, see ZzpTab.test.tsx). BANK-1 (09-08) added
  // Bankrekening as the THIRD card here, hence three pencils instead of two.
  it('Financieel shows Loonheffing, Bankrekening and Gewenst tarief as separately-editable cards', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupFinancial' }))
    expect(screen.getByText('preferences.groupBankAccount')).toBeInTheDocument()
    expect(screen.getByText('preferences.groupDesiredRate')).toBeInTheDocument()
    expect(screen.getAllByTitle('edit')).toHaveLength(3)
    // Editing Loonheffing leaves the other two read-only (two pencils left).
    await user.click(screen.getAllByTitle('edit')[0])
    expect(screen.getByTitle('save')).toBeInTheDocument()
    expect(screen.getAllByTitle('edit')).toHaveLength(2)
    expect(screen.getByText('preferences.desiredRateMin')).toBeInTheDocument()
  })

  // BANK-1 (Danny 2026-08-09): the PRIVATE salary account lives on this sub-tab,
  // reading from the ROOT candidate fields (never the preferences blob) and
  // emitting the API keys the drawer lifts back out to root — see
  // BankAccountCard.test.tsx for the wire-body assertions.
  it('Financieel renders the private bank account from the ROOT candidate fields, grouped in fours', async () => {
    const user = userEvent.setup()
    const c = { ...candidate(), iban: 'NL91ABNA0417164300', accountHolderName: 'Jan Jansen' } as Candidate
    render(<PreferencesTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupFinancial' }))
    expect(screen.getByText('NL91 ABNA 0417 1643 00')).toBeInTheDocument()
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
  })

  it('Financieel saves the bank account with the API keys only (never wrapped in a preferences key here)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const c = { ...candidate(), iban: 'NL91ABNA0417164300', accountHolderName: 'Jan Jansen' } as Candidate
    render(<PreferencesTab c={c} onSave={onSave} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupFinancial' }))
    await user.click(screen.getAllByTitle('edit')[1]) // Bankrekening
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith({ iban: 'NL91ABNA0417164300', account_holder_name: 'Jan Jansen' })
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

  // Job "noodcontact-opzeg" + KAND-OPZEGTERMIJN-2 (Danny punt 9): Overig now holds
  // Noodcontact and Opmerkingen — Opzegtermijn moved out to Beschikbaarheid.
  it('Overig shows Noodcontact and Opmerkingen as their own cards, each with its own pencil', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupOther' }))
    expect(screen.getByText('preferences.groupEmergencyContact')).toBeInTheDocument()
    expect(screen.getByText('preferences.emergencyContactName')).toBeInTheDocument()
    expect(screen.getByText('preferences.emergencyContactPhone')).toBeInTheDocument()
    // Noodcontact · Opmerkingen — two cards, two own pencils.
    expect(screen.getAllByTitle('edit')).toHaveLength(2)
  })

  it('Noodcontact save flows through the tab onSave with the split emergency-contact API keys', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<PreferencesTab c={candidate()} onSave={onSave} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupOther' }))
    await user.click(screen.getAllByTitle('edit')[0]) // Noodcontact
    await user.click(screen.getByTitle('save'))
    // NOODCONTACT-SPLIT-1: split name/phone/mobile + relation-by-id (never a
    // label) — '' -> null for the nullable relation FK (mirrors COUNTRY-1).
    expect(onSave).toHaveBeenCalledWith({
      emergency_contact_first_name: '',
      emergency_contact_middle_name: '',
      emergency_contact_last_name: '',
      emergency_contact_phone: '',
      emergency_contact_mobile: '',
      emergency_contact_relation_id: null,
    })
  })
})

/**
 * KAND-OPZEGTERMIJN-2 (Danny 2026-08-08, punt 9) — the notice period belongs to
 * availability: it now sits in the Beschikbaarheid card directly under "Inzetbaar
 * vanaf", saves in that section's payload, and a derived-date hint offers (never
 * imposes) today + X weeks when no availability date is recorded yet.
 *
 * The clock is frozen so the derived date is deterministic; only Date is faked so
 * userEvent's own timers keep running.
 */
describe('PreferencesTab · Opzegtermijn ↔ Inzetbaar vanaf (Danny punt 9)', () => {
  const prefCandidate = (preferences: Record<string, unknown>): Candidate => ({
    id: 1, candidateTypes: [], preferences, zzp: {}, archived: false, status: 'available',
  } as unknown as Candidate)

  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 7, 9, 12, 0, 0)) })
  afterEach(() => { vi.useRealTimers() })

  it('renders Opzegtermijn inside Beschikbaarheid, directly after Inzetbaar vanaf, and no longer under Overig', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PreferencesTab c={prefCandidate({})} />)
    expect(screen.getByText('preferences.noticePeriodWeeks')).toBeInTheDocument()
    // Adjacency is the point of the move — assert the DOM order of the two labels.
    const labels = screen.getAllByText(/^preferences\./).map(el => el.textContent)
    expect(labels.indexOf('preferences.noticePeriodWeeks')).toBe(labels.indexOf('preferences.availableFrom') + 1)
    // The old standalone Opzegtermijn card is gone from Overig.
    await user.click(screen.getByRole('tab', { name: 'preferences.groupOther' }))
    expect(screen.queryByText('preferences.noticePeriodWeeks')).toBeNull()
    expect(screen.queryByText('preferences.groupNoticePeriod')).toBeNull()
  })

  it('the Beschikbaarheid save sends notice_period_weeks together with available_from — and only this section keys', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSave = vi.fn()
    render(<PreferencesTab c={prefCandidate({ available_from: '2026-10-01', hours_per_week: 16, preferred_days: ['thu'], sector_pref: ['IT'] })} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    // Two number inputs in this card: [0] Opzegtermijn, [1] Uren per week.
    await user.type(screen.getAllByRole('spinbutton')[0], '4')
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      available_from: '2026-10-01',
      notice_period_weeks: 4,
      hours_per_week: 16,
      preferred_days: ['thu'],
      sector_pref: ['IT'],
    })
  })

  it('clearing the notice period sends null (never an empty string)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSave = vi.fn()
    render(<PreferencesTab c={prefCandidate({ notice_period_weeks: 4 })} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.clear(screen.getAllByRole('spinbutton')[0])
    await user.click(screen.getByTitle('save'))
    expect((onSave.mock.calls[0][0] as Record<string, unknown>).notice_period_weeks).toBeNull()
  })

  it('shows the derived-date hint when a notice period is set but no availability date is', () => {
    render(<PreferencesTab c={prefCandidate({ notice_period_weeks: 4 })} onSave={vi.fn()} />)
    expect(screen.getByText('preferences.noticePeriodDerivedHint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'preferences.noticePeriodApply' })).toBeInTheDocument()
  })

  it('never argues with a date the recruiter already entered — no hint when available_from is filled', () => {
    render(<PreferencesTab c={prefCandidate({ notice_period_weeks: 4, available_from: '2026-12-01' })} onSave={vi.fn()} />)
    expect(screen.queryByText('preferences.noticePeriodDerivedHint')).toBeNull()
  })

  it('shows no hint without a notice period', () => {
    render(<PreferencesTab c={prefCandidate({})} onSave={vi.fn()} />)
    expect(screen.queryByText('preferences.noticePeriodDerivedHint')).toBeNull()
  })

  // The take-over is an explicit acceptance of a proposal: exactly ONE field is
  // persisted, and it is today + 4 weeks (09-08-2026 → 06-09-2026).
  it('taking over the derived date PATCHes only available_from with today + X weeks', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSave = vi.fn()
    render(<PreferencesTab c={prefCandidate({ notice_period_weeks: 4 })} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'preferences.noticePeriodApply' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ available_from: '2026-09-06' })
  })

  // A take-over landing behind an OPEN draft would be wiped by that draft's save,
  // so the button is withheld while the card is being edited (the hint itself stays).
  it('withholds the take-over button while the Beschikbaarheid card is in edit mode', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PreferencesTab c={prefCandidate({ notice_period_weeks: 4 })} onSave={vi.fn()} />)
    await user.click(screen.getByTitle('edit'))
    expect(screen.getByText('preferences.noticePeriodDerivedHint')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'preferences.noticePeriodApply' })).toBeNull()
  })

  // §13 seam proof: what the section emits must survive the drawer's merge and the
  // UI-patch → API-body mapping as the exact preferences blob measured live against
  // PATCH /candidates/{id} (2026-08-08: both keys accepted and persisted, HTTP 200).
  it('the emitted payload maps to the measured PATCH body (preferences blob with both keys)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onSave = vi.fn()
    const existing = { available_from: '2026-10-01', hours_per_week: 16, preferred_days: ['thu'], sector_pref: ['IT'], remarks: 'keep me' }
    render(<PreferencesTab c={prefCandidate(existing)} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.type(screen.getAllByRole('spinbutton')[0], '4')
    await user.click(screen.getByTitle('save'))
    // CandidateDrawer merges the section payload onto the existing blob, then
    // buildCandidatePatch turns the UI patch into the wire body.
    const prefs = onSave.mock.calls[0][0] as Record<string, unknown>
    const body = buildCandidatePatch({ preferences: { ...existing, ...prefs } })
    expect(body).toEqual({
      preferences: {
        available_from: '2026-10-01',
        notice_period_weeks: 4,
        hours_per_week: 16,
        preferred_days: ['thu'],
        sector_pref: ['IT'],
        remarks: 'keep me',
      },
    })
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
