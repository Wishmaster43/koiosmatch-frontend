import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (this tab has no datetime import to trigger it transitively, unlike
// Personal) — explicit side-effect import so t() resolves real Dutch text, like
// the rest of this drawer's tests (never raw keys).
import '@/i18n'
import ProfileAddressTab from './ProfileAddressTab'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'

vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Utrecht', 'Zuid-Holland'] }) }))
// Required-fields lookup mocked directly (own hook, own test) — no need to touch
// the underlying settings/api plumbing that hook already covers separately.
vi.mock('./useProfileRequiredKeys', () => ({ useProfileRequiredKeys: vi.fn(() => []) }))

// Danny 28-07 split: the old combined ProfileTab flipped ~15 fields per pencil.
// Address now owns straat/huisnummer/toevoeging/postcode/plaats/provincie/land
// — the composed one-line-read + expand-on-edit behaviour must be preserved
// exactly (mirrors the shared EditableFieldTable `type: 'address'` row).
describe('ProfileAddressTab · own fields, composed line, own request shape', () => {
  // Reset to "nothing required" before every test — a test that overrides this
  // (the required-fields case below) must not leak into the others, since the
  // component re-renders (and re-invokes the hook) on every click.
  beforeEach(() => { vi.mocked(useProfileRequiredKeys).mockReturnValue([]) })

  const candidate = {
    id: 1, street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: 'a',
    postalCode: '1234 AB', city: 'Utrecht', province: 'Utrecht', country: 'NL', phase: 'candidate',
  } as unknown as Candidate

  it('read mode composes street+no+suffix and postcode+city into one comma line', () => {
    render(<ProfileAddressTab c={candidate} />)
    expect(screen.getByText('Kerkstraat 12-a, 1234 AB Utrecht')).toBeInTheDocument()
    // The structured child fields aren't separately visible in read mode.
    expect(screen.queryByText('Huisnummer')).toBeNull()
  })

  it('editing expands the composed line into its structured fields, plus province/country stay their own rows', async () => {
    const user = userEvent.setup()
    render(<ProfileAddressTab c={candidate} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByText('Straat')).toBeInTheDocument()
    expect(screen.getByText('Huisnummer')).toBeInTheDocument()
    expect(screen.getByText('Toevoeging')).toBeInTheDocument()
    expect(screen.getByText('Postcode')).toBeInTheDocument()
    expect(screen.getByText('Plaats')).toBeInTheDocument()
    expect(screen.getByText('Provincie')).toBeInTheDocument()
    expect(screen.getByText('Land')).toBeInTheDocument()
    // The composed read-only line is gone while editing.
    expect(screen.queryByText('Kerkstraat 12-a, 1234 AB Utrecht')).toBeNull()
  })

  it('the pencil flips only this tab into edit mode', async () => {
    const user = userEvent.setup()
    render(<ProfileAddressTab c={candidate} />)
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(1)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByTitle('Opslaan')).toBeInTheDocument()
    expect(screen.queryByTitle('Bewerken')).toBeNull()
  })

  it('sends the full address field set on save (assert the REQUEST body)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ProfileAddressTab c={candidate} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const cityRow = screen.getByText('Plaats').parentElement as HTMLElement
    const cityInput = within(cityRow).getByRole('textbox') as HTMLInputElement
    await user.clear(cityInput)
    await user.type(cityInput, 'Amersfoort')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: 'a',
      postalCode: '1234 AB', city: 'Amersfoort', province: 'Utrecht', country: 'NL',
    })
  })

  it('clears province when the picked country no longer offers it (cascade)', async () => {
    const user = userEvent.setup()
    render(<ProfileAddressTab c={candidate} />)
    await user.click(screen.getByTitle('Bewerken'))
    const provinceRow = screen.getByText('Provincie').parentElement as HTMLElement
    expect(within(provinceRow).getByRole('button')).toHaveTextContent('Utrecht')
  })

  it('blocks save and flags street/postcode/city when the tenant requires them', async () => {
    vi.mocked(useProfileRequiredKeys).mockReturnValue(['street', 'postal_code', 'city'])
    const user = userEvent.setup()
    const empty = { id: 2, street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '', country: '', phase: 'candidate' } as unknown as Candidate
    const onSave = vi.fn()
    render(<ProfileAddressTab c={empty} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getAllByText('Verplicht veld').length).toBe(3)
  })

  it('province picker is searchable and pick-only (allowCreate=false)', async () => {
    const user = userEvent.setup()
    const { container } = render(<ProfileAddressTab c={{ ...candidate, province: '' } as unknown as Candidate} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(container.querySelectorAll('select')).toHaveLength(0)
    const provinceRow = screen.getByText('Provincie').parentElement as HTMLElement
    await user.click(within(provinceRow).getByRole('button'))
    await user.type(screen.getByPlaceholderText('Selecteer'), 'Utr')
    expect(screen.getByRole('button', { name: 'Utrecht' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zuid-Holland' })).toBeNull()
  })
})
