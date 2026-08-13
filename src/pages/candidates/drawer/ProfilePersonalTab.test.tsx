import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n so t() resolves real Dutch text, like the rest of this drawer's tests.
import i18n from '@/i18n'
import ProfilePersonalTab from './ProfilePersonalTab'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'

// This project ships no @types/node; process.env.TZ is a genuine Node global at
// test runtime (Vitest runs under Node) — this is a minimal local type shim for it.
declare const process: { env: Record<string, string | undefined> }

vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
// LOOKUP-ICON-1: `flags` (name → emoji) rides alongside `nationalities` now — an
// empty map here exercises the "no flag" fallback path (plain name, no icon).
vi.mock('@/lib/useNationalities', () => ({ useNationalities: () => ({ nationalities: ['Nederlands', 'Belgisch'], flags: { Nederlands: '🇳🇱' } }) }))
// Required-fields lookup mocked directly (own hook, own test) — no need to touch
// the underlying settings/api plumbing that hook already covers separately.
vi.mock('./useProfileRequiredKeys', () => ({ useProfileRequiredKeys: vi.fn(() => []) }))

// Resolved through i18n itself, not hardcoded: used only to prove the label is
// now ABSENT from this tab (Bron moved to the read-only CandidateOriginCard).
const SOURCE_LABEL = i18n.t('candidates:profile.source')

// Danny 28-07 split: the old combined ProfileTab flipped ~15 fields per pencil.
// Personal owns exactly gender/nationality/dob/placeOfBirth. `source` briefly
// sat here too and moved out again (Danny 09-08, "ik mis de bron"): buried
// between gender/nationality/birthdate it read as a property of the PERSON,
// while it describes the DOSSIER. It now lives, read-only, alongside its own
// created-by/created-on stamps in CandidateOriginCard ("Herkomst") — one block,
// mounted after this tab's cards, not a field on this component at all anymore.
describe('ProfilePersonalTab · own fields, own pencil, own request shape', () => {
  // Reset to "nothing required" before every test — a test that overrides this
  // (the required-fields case below) must not leak into the others, since the
  // component re-renders (and re-invokes the hook) on every click.
  beforeEach(() => { vi.mocked(useProfileRequiredKeys).mockReturnValue([]) })

  const candidate = { id: 1, gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Utrecht', phase: 'candidate' } as unknown as Candidate

  it('renders exactly its own four fields, no bron and nothing from Address/Contact', () => {
    render(<ProfilePersonalTab c={candidate} />)
    expect(screen.getByText('Geslacht')).toBeInTheDocument()
    expect(screen.getByText('Nationaliteit')).toBeInTheDocument()
    expect(screen.getByText('Geboortedatum')).toBeInTheDocument()
    expect(screen.getByText('Geboorteplaats')).toBeInTheDocument()
    // Bron is gone from this tab entirely — it lives in CandidateOriginCard now.
    expect(screen.queryByText(SOURCE_LABEL)).toBeNull()
    expect(screen.queryByText('Straat')).toBeNull()
    expect(screen.queryByText('E-mailadres')).toBeNull()
  })

  it('the pencil flips only this tab into edit mode (save/cancel replace it)', async () => {
    const user = userEvent.setup()
    render(<ProfilePersonalTab c={candidate} />)
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(1)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByTitle('Opslaan')).toBeInTheDocument()
    expect(screen.getByTitle('Annuleren')).toBeInTheDocument()
    expect(screen.queryByTitle('Bewerken')).toBeNull()
  })

  it('sends the full personal field set on save (assert the REQUEST body)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ProfilePersonalTab c={candidate} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const placeRow = screen.getByText('Geboorteplaats').parentElement as HTMLElement
    const placeInput = within(placeRow).getByRole('textbox') as HTMLInputElement
    await user.clear(placeInput)
    await user.type(placeInput, 'Amsterdam')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledTimes(1)
    // No `source` key: this tab no longer owns that field, so its payload
    // must not carry it (a stray key here would silently resurrect the bug).
    expect(onSave).toHaveBeenCalledWith({ gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Amsterdam' })
  })

  it('cancel restores the original values without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ProfilePersonalTab c={candidate} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const placeRow = screen.getByText('Geboorteplaats').parentElement as HTMLElement
    const placeInput = within(placeRow).getByRole('textbox') as HTMLInputElement
    await user.clear(placeInput)
    await user.type(placeInput, 'Rotterdam')
    await user.click(screen.getByTitle('Annuleren'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })

  it('blocks save and flags gender/dob when the tenant requires them', async () => {
    vi.mocked(useProfileRequiredKeys).mockReturnValue(['gender', 'date_of_birth'])
    const user = userEvent.setup()
    const empty = { id: 2, gender: '', nationality: '', dob: '', placeOfBirth: '', phase: 'candidate' } as unknown as Candidate
    const onSave = vi.fn()
    render(<ProfilePersonalTab c={empty} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getAllByText('Verplicht veld').length).toBeGreaterThanOrEqual(1)
  })

  it('searchable dropdowns are pick-only (allowCreate=false) — no plain <select>, no create-on-type', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProfilePersonalTab c={{ ...candidate, gender: '', nationality: '' } as unknown as Candidate} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(container.querySelectorAll('select')).toHaveLength(0)
    const natField = screen.getByText('Nationaliteit').parentElement as HTMLElement
    await user.click(within(natField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('Selecteer'), 'Belg')
    expect(screen.getByRole('button', { name: 'Belgisch' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nederlands' })).toBeNull()
  })
})

// Regression guard (Danny 09-08, UTC-date-shift fix): the dob field is a DatePicker
// wired straight to toLocalIsoDate — prove the SENT value is the picked local day,
// not one rolled back by a UTC conversion. A wrong birthdate means a wrong age.
describe('ProfilePersonalTab · dob field sends the LOCAL calendar day, never UTC-shifted', () => {
  const originalTz = process.env.TZ
  beforeEach(() => {
    vi.mocked(useProfileRequiredKeys).mockReturnValue([])
    // Explicit TZ so this proves something on any machine, not just one that
    // happens to run in UTC (where old-buggy and fixed code would coincide).
    process.env.TZ = 'Europe/Amsterdam'
    // Freeze "now" just after local midnight (CET, winter) — the exact window where
    // `.toISOString().slice(0, 10)` used to roll the picked day back by one (measured
    // 09-08: picking 15 Jan 2026 saved as "2026-01-14"). Only Date is faked, so
    // userEvent's own internal timers keep ticking normally.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 15, 0, 30, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
    process.env.TZ = originalTz
  })

  it('sends dob "2026-01-15" when the today cell is picked, not "2026-01-14"', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    // Empty dob so the calendar opens on the CURRENT month (frozen "today") instead
    // of navigating away to a stored birth year.
    const noDob = { id: 3, gender: 'male', nationality: 'Nederlands', dob: '', placeOfBirth: '', phase: 'candidate' } as unknown as Candidate
    render(<ProfilePersonalTab c={noDob} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const dobRow = screen.getByText('Geboortedatum').parentElement as HTMLElement
    await user.click(within(dobRow).getByRole('textbox'))
    // The calendar renders into the shared datepicker-portal, outside this row.
    const todayCell = document.querySelector('.react-datepicker__day--today') as HTMLElement
    expect(todayCell).toBeTruthy()
    await user.click(todayCell)
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dob: '2026-01-15' }))
  })
})
