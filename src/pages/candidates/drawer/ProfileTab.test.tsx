import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileTab from './ProfileTab'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.reject({ response: { status: 404 } })) } }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
vi.mock('@/lib/useNationalities', () => ({ useNationalities: () => ({ nationalities: ['Nederlands', 'Belgisch'] }) }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Utrecht', 'Zuid-Holland'] }) }))
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => null }))
vi.mock('@/components/ui/SafeHtml', () => ({ default: () => null }))

// Danny 28-07 split: the old single pencil flipped ~15 fields at once ("ruk om
// te onderhouden"). ProfileTab is now a thin container over three sub-tabs
// (Personal/Address/Contact), each with its own pencil — mirrors the
// PreferencesZzpTabs sub-tab pattern already used elsewhere in this drawer.
describe('ProfileTab · thin container over Personal/Address/Contact sub-tabs', () => {
  const candidate = {
    id: 1, gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Utrecht',
    street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: '', postalCode: '1234 AB', city: 'Utrecht',
    province: 'Utrecht', country: 'NL', email: 'a@b.nl', phone: '', mobile: '', linkedin: '',
    summary: '', phase: 'candidate',
  } as unknown as Candidate

  it('renders the three sub-tabs, defaulting to Persoonlijk', () => {
    render(<ProfileTab c={candidate} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs).toEqual(['Persoonlijk', 'Adres', 'Contact'])
    expect(screen.getByRole('tab', { name: 'Persoonlijk' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Geslacht')).toBeInTheDocument()
    expect(screen.queryByText('Straat')).toBeNull()
    expect(screen.queryByText('E-mailadres')).toBeNull()
  })

  it('Adres shows only the address fields and hides Persoonlijk/Contact', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getByRole('tab', { name: 'Adres' }))
    expect(screen.getByText('Kerkstraat 12, 1234 AB Utrecht')).toBeInTheDocument()
    expect(screen.queryByText('Geslacht')).toBeNull()
    expect(screen.queryByText('E-mailadres')).toBeNull()
  })

  it('Contact shows only the contact fields and hides Persoonlijk/Adres', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getByRole('tab', { name: 'Contact' }))
    expect(screen.getByText('E-mailadres')).toBeInTheDocument()
    expect(screen.queryByText('Geslacht')).toBeNull()
    expect(screen.queryByText('Straat')).toBeNull()
  })

  it('editing Persoonlijk does not open a pencil on Adres/Contact — each sub-tab keeps its own edit state', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    // Two pencils exist at rest: the active sub-tab's (index 0, DOM order) + the
    // profile-text block's own (index 1) — click only the sub-tab's.
    await user.click(screen.getAllByTitle('Bewerken')[0])
    expect(screen.getByTitle('Opslaan')).toBeInTheDocument()
    // Only the summary's pencil remains while Persoonlijk is mid-edit.
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(1)
    await user.click(screen.getByRole('tab', { name: 'Adres' }))
    // Adres mounts fresh — its OWN pencil, not a leftover Save/Cancel from Persoonlijk.
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(2)
    expect(screen.queryByTitle('Opslaan')).toBeNull()
  })

  it('the profile-text block keeps its own separate pencil, untouched by the field sub-tabs', () => {
    render(<ProfileTab c={{ ...candidate, summary: '<p>Hello</p>' } as unknown as Candidate} />)
    expect(screen.getByText('Profieltekst')).toBeInTheDocument()
    // Two pencils are visible at once: Persoonlijk's (active sub-tab) + the summary's own.
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(2)
  })

  it('calls onEditSave with only the edited sub-tab\'s fields when Personal saves', async () => {
    const user = userEvent.setup()
    const onEditSave = vi.fn()
    render(<ProfileTab c={candidate} onEditSave={onEditSave} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEditSave).toHaveBeenCalledWith({ gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Utrecht' })
  })
})
