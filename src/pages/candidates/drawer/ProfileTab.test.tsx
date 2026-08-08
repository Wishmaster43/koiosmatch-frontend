import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileTab from './ProfileTab'
import { useWorkPermitVisibility } from './useWorkPermitVisibility'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/api', () => ({
  getActiveTenantId: () => 'demo', default: { get: vi.fn(() => Promise.reject({ response: { status: 404 } })) } }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
vi.mock('@/lib/useNationalities', () => ({ useNationalities: () => ({ nationalities: ['Nederlands', 'Belgisch'] }) }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Utrecht', 'Zuid-Holland'] }) }))
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => null }))
vi.mock('@/components/ui/SafeHtml', () => ({ default: () => null }))
// DANNY-PUNT-1: own hook, own tests (workPermitVisibility.test.ts) — mocked here
// so ProfileTab's tests don't depend on its network call. Default hidden (false)
// keeps the pre-existing "4 pencils" assertions unchanged; individual tests below
// flip it to exercise the WorkPermitBlock card.
vi.mock('./useWorkPermitVisibility', () => ({ useWorkPermitVisibility: vi.fn(() => false) }))

// Danny 28-07: the old single pencil flipped ~15 fields at once ("ruk om te
// onderhouden"), so the edit state was split PER CARD. A sub-tab strip was tried
// first and rejected the same day — this drawer is the house blueprint (§3A), its
// layout stays one tab; only the "whole form opens at once" behaviour is gone.
// These tests pin exactly that: three cards visible together, three independent
// pencils, and a fourth for the profile text.
describe('ProfileTab · one tab, one pencil per card', () => {
  // Reset to EU (hidden work-permit card) before every test — a test overriding
  // this (the non-EU case below) must not leak into the others.
  beforeEach(() => { vi.mocked(useWorkPermitVisibility).mockReturnValue(false) })

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
    // One card is in edit mode; the other cards + the profile text still show a pencil.
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

  // Danny 09-08: the separate Herkomst card is GONE. Bron survives as one editable
  // row on the Persoonlijk card; the created-on/by STAMPS moved to the drawer footer
  // (CandidateDrawerFooter) and must not reappear on this tab — one place per value
  // (§11). Asserted on VALUES, not labels, so it survives a label rewording.
  it('keeps bron on the tab but no longer repeats the creation stamps', () => {
    render(<ProfileTab c={{ ...candidate, source: 'werkzoeken', createdBy: { id: 7, name: 'Laura Yesway' }, created: '2025-10-29T16:03:57+00:00' } as unknown as Candidate} />)
    expect(screen.getByText('werkzoeken')).toBeInTheDocument()
    expect(screen.queryByText('Laura Yesway')).toBeNull()
    expect(screen.queryByText('29-10-2025')).toBeNull()
  })

  it('saves only the edited card\'s own fields', async () => {
    const user = userEvent.setup()
    const onEditSave = vi.fn()
    render(<ProfileTab c={candidate} onEditSave={onEditSave} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEditSave).toHaveBeenCalledWith({ gender: 'male', nationality: 'Nederlands', dob: '1990-01-01', placeOfBirth: 'Utrecht', source: '' })
  })
})

// DANNY-PUNT-1: the WorkPermitBlock card is hidden only when it is empty AND the
// nationality provably matches the company's own country (useWorkPermitVisibility).
describe('ProfileTab · WorkPermitBlock (KAND-WERKVERGUNNING-2)', () => {
  const candidate = {
    id: 1, gender: 'male', nationality: 'Marokkaans', dob: '1990-01-01', placeOfBirth: 'Utrecht',
    street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: '', postalCode: '1234 AB', city: 'Utrecht',
    province: 'Utrecht', country: 'NL', email: 'a@b.nl', phone: '', mobile: '', linkedin: '',
    summary: '', phase: 'candidate',
  } as unknown as Candidate

  it('stays hidden when the rule says so — no extra pencil, no work-permit fields', () => {
    render(<ProfileTab c={candidate} />)
    // Persoonlijk + Adres + Contact + de profieltekst.
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(4)
    expect(screen.queryByText('Werkvergunning')).toBeNull()
  })

  it('shows an extra card when the rule says the permit question is relevant', () => {
    vi.mocked(useWorkPermitVisibility).mockReturnValue(true)
    render(<ProfileTab c={candidate} />)
    expect(screen.getByText('Werkvergunning')).toBeInTheDocument()
    // Persoonlijk + Werkvergunning + Adres + Contact + de profieltekst.
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(5)
  })

  it('saves only the work-permit card\'s own fields (assert the REQUEST body)', async () => {
    vi.mocked(useWorkPermitVisibility).mockReturnValue(true)
    const user = userEvent.setup()
    const onEditSave = vi.fn()
    render(<ProfileTab c={candidate} onEditSave={onEditSave} />)
    // Persoonlijk · Werkvergunning · Adres · Contact · profieltekst — Werkvergunning is 2nd.
    await user.click(screen.getAllByTitle('Bewerken')[1])
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEditSave).toHaveBeenCalledWith({ workPermitType: '', workPermitValidUntil: '' })
  })
})
