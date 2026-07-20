import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileTab, { waDigits } from './ProfileTab'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.reject({ response: { status: 404 } })) } }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
vi.mock('@/lib/useNationalities', () => ({ useNationalities: () => ({ nationalities: ['Nederlands', 'Belgisch'] }) }))
vi.mock('../hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Utrecht', 'Zuid-Holland'] }) }))
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => null }))
vi.mock('@/components/ui/SafeHtml', () => ({ default: () => null }))

// Job 29 (2026-07-16): the wa.me link needs bare E.164 digits — covers the two
// phone shapes seen in the candidate dataset (with/without the +31 country code)
// plus the "too short to be real" guard that keeps a corrupted value from
// rendering a dead WhatsApp link.
describe('waDigits', () => {
  it('keeps an already-international number as-is (just strips formatting)', () => {
    expect(waDigits('+31 6 78308059')).toBe('31678308059')
  })

  it('turns a Dutch national leading 0 into the 31 country code', () => {
    expect(waDigits('06 78308059')).toBe('31678308059')
  })

  it('returns empty for a value too short to be a real MSISDN', () => {
    expect(waDigits('0612')).toBe('')
    expect(waDigits('-')).toBe('')
  })
})

// BE 2026-07-20: phone (landline) and mobile are now independent fields, each
// with exactly ONE fixed shortcut icon — mobile → WhatsApp (wa.me), landline →
// dial (tel:). No more tenant-configurable phone_click_action ambiguity.
describe('ProfileTab · mobile/phone split render (2026-07-20)', () => {
  const candidate = { id: 1, phone: '0301234567', mobile: '0612345678' } as unknown as Candidate

  it('renders the mobile value with only a WhatsApp shortcut (wa.me)', () => {
    render(<ProfileTab c={candidate} />)
    const wa = screen.getByTitle('Open in WhatsApp')
    expect(wa.getAttribute('href')).toBe('https://wa.me/31612345678')
    // The landline never gets a WhatsApp icon (only one "Open in WhatsApp" title on the page).
    expect(screen.getAllByTitle('Open in WhatsApp')).toHaveLength(1)
  })

  it('renders the landline value with only a call shortcut (tel:), no WhatsApp icon', () => {
    render(<ProfileTab c={candidate} />)
    const call = screen.getByTitle('Bellen')
    expect(call.getAttribute('href')).toBe('tel:0301234567')
    expect(screen.getAllByTitle('Bellen')).toHaveLength(1)
  })

  it('hides the WhatsApp icon for a mobile value too short to be a real MSISDN', () => {
    const c = { id: 1, phone: '', mobile: '0612' } as unknown as Candidate
    render(<ProfileTab c={c} />)
    expect(screen.queryByTitle('Open in WhatsApp')).toBeNull()
  })
})

// Kandidaten-ronde-2, punt A: Geslacht/Nationaliteit/Provincie become searchable
// (type-to-filter) dropdowns instead of a plain native <select>.
describe('ProfileTab · searchable dropdowns (kandidaten-ronde-2, punt A)', () => {
  const candidate = { id: 1, gender: '', nationality: '', province: '' } as unknown as Candidate

  it('renders no plain <select> for gender/nationality/province once editing starts', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProfileTab c={candidate} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })

  it('typing in the nationality picker filters down to the matching option only', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    const natField = screen.getByText('Nationaliteit').parentElement as HTMLElement
    await user.click(within(natField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('Selecteer'), 'Belg')
    expect(screen.getByRole('button', { name: 'Belgisch' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nederlands' })).toBeNull()
  })

  it('typing in the province picker filters down to the matching option only', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    const provField = screen.getByText('Provincie').parentElement as HTMLElement
    await user.click(within(provField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('Selecteer'), 'Utr')
    expect(screen.getByRole('button', { name: 'Utrecht' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zuid-Holland' })).toBeNull()
  })

  it('is pick-only (allowCreate=false) — typing an unknown value never offers to create it', async () => {
    const user = userEvent.setup()
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getAllByTitle('Bewerken')[0])
    const genderField = screen.getByText('Geslacht').parentElement as HTMLElement
    await user.click(within(genderField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('Selecteer'), 'NoSuchGenderXYZ')
    expect(screen.queryByText(/NoSuchGenderXYZ/)).toBeNull()
  })
})
