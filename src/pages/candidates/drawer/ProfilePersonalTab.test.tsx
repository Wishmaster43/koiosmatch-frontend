import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n so t() resolves real Dutch text, like the rest of this drawer's tests.
import '@/i18n'
import ProfilePersonalTab from './ProfilePersonalTab'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
vi.mock('@/lib/useNationalities', () => ({ useNationalities: () => ({ nationalities: ['Nederlands', 'Belgisch'] }) }))
// Required-fields lookup mocked directly (own hook, own test) — no need to touch
// the underlying settings/api plumbing that hook already covers separately.
vi.mock('./useProfileRequiredKeys', () => ({ useProfileRequiredKeys: vi.fn(() => []) }))

// Danny 28-07 split: the old combined ProfileTab flipped ~15 fields per pencil.
// Personal now owns exactly gender/nationality/dob/placeOfBirth — its own
// pencil, its own request shape.
describe('ProfilePersonalTab · own fields, own pencil, own request shape', () => {
  // Reset to "nothing required" before every test — a test that overrides this
  // (the required-fields case below) must not leak into the others, since the
  // component re-renders (and re-invokes the hook) on every click.
  beforeEach(() => { vi.mocked(useProfileRequiredKeys).mockReturnValue([]) })

  const candidate = { id: 1, gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Utrecht', phase: 'candidate' } as unknown as Candidate

  it('renders exactly its own four fields, nothing from Address/Contact', () => {
    render(<ProfilePersonalTab c={candidate} />)
    expect(screen.getByText('Geslacht')).toBeInTheDocument()
    expect(screen.getByText('Nationaliteit')).toBeInTheDocument()
    expect(screen.getByText('Geboortedatum')).toBeInTheDocument()
    expect(screen.getByText('Geboorteplaats')).toBeInTheDocument()
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
