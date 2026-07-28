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

// Danny 28-07: the old single pencil flipped ~15 fields at once ("ruk om te
// onderhouden"), so the edit state was split PER CARD. A sub-tab strip was tried
// first and rejected the same day — this drawer is the house blueprint (§3A), its
// layout stays one tab; only the "whole form opens at once" behaviour is gone.
// These tests pin exactly that: three cards visible together, three independent
// pencils, and a fourth for the profile text.
describe('ProfileTab · one tab, one pencil per card', () => {
  const candidate = {
    id: 1, gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Utrecht',
    street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: '', postalCode: '1234 AB', city: 'Utrecht',
    province: 'Utrecht', country: 'NL', email: 'a@b.nl', phone: '', mobile: '', linkedin: '',
    summary: '', phase: 'candidate',
  } as unknown as Candidate

  it('shows all three field cards at once — no sub-tab strip', () => {
    render(<ProfileTab c={candidate} />)
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByText('Geslacht')).toBeInTheDocument()
    expect(screen.getByText('Kerkstraat 12, 1234 AB Utrecht')).toBeInTheDocument()
    expect(screen.getByText('E-mailadres')).toBeInTheDocument()
  })

  it('gives each card its own pencil, plus one for the profile text', () => {
    render(<ProfileTab c={{ ...candidate, summary: '<p>Hello</p>' } as unknown as Candidate} />)
    expect(screen.getByText('Profieltekst')).toBeInTheDocument()
    // Persoonlijk + Adres + Contact + de profieltekst.
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(4)
  })

  it('editing one card leaves the others read-only — the whole form no longer opens', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    // One card is in edit mode; the other two cards + the profile text still show a pencil.
    expect(screen.getByTitle('Opslaan')).toBeInTheDocument()
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(3)
  })

  it('keeps another card\'s draft intact while a second card is edited', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    // Open Persoonlijk, then open Adres too: both stay mounted, so neither loses its
    // in-progress state (the rejected sub-tab version discarded it on switch).
    await user.click(screen.getAllByTitle('Bewerken')[0])
    await user.click(screen.getAllByTitle('Bewerken')[0])
    expect(screen.getAllByTitle('Opslaan')).toHaveLength(2)
  })

  it('saves only the edited card\'s own fields', async () => {
    const user = userEvent.setup()
    const onEditSave = vi.fn()
    render(<ProfileTab c={candidate} onEditSave={onEditSave} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEditSave).toHaveBeenCalledWith({ gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Utrecht' })
  })
})
