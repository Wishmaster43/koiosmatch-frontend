/**
 * LocationDetail · title-row status badge (Danny 28-07: "Status van locatie moet
 * hier!!") — status moved OUT of the Algemeen field table into a read-only
 * TitleBadge next to the location name (§3A(c)), with its own pencil → picker →
 * save/cancel cycle so changing it is still possible. Assert the onSave PATCH
 * shape (§13), never only that a callback fired.
 *
 * EditableFieldTable pulls in `@/lib/datetime`, which side-effect-imports the
 * real i18n instance — so (like AddCustomerModal.test.tsx) this file resolves
 * assertions through the ACTIVE locale's own copy instead of guessing/hardcoding
 * a language.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import LocationDetail from './LocationDetail'
import type { Location } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// useCustomFields hits the API in an effect — stub it so the Extra sub-tab stays
// hidden (no custom fields defined) and no network call happens under test.
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], allFields: [], loading: false, invalidate: () => {} }),
}))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

// Hex values here are DATA — fixture colours for a tenant lookup, not UI styling.
const statuses: LookupOption[] = [
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-active', label: 'Actief', color: '#22C55E', id: 'status-active' },
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-inactive', label: 'Inactief', color: '#9CA3AF', id: 'status-inactive' },
]

const location = (overrides: Partial<Location> = {}): Location => ({
  id: 'loc-1', helloflexLink: null, shiftmanagerLink: null, name: 'Hoofdlocatie',
  street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', state: '', country: '',
  cocNumber: '', vatNumber: '', contactName: '', phone: '', email: '', isHeadquarter: false,
  costCenter: '', billingEmail: '', address: '', departments: [], contacts: [],
  statusId: 'status-active', status: 'active', statusLabel: 'Actief',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  statusColor: '#22C55E',
  customFields: {},
  ...overrides,
} as Location)

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', locations: [], departments: [], contacts: [],
  statuses, departmentStatuses: [] as LookupOption[], contactStatuses: [] as LookupOption[],
  onDelete: vi.fn(), onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), close: vi.fn(),
}

describe('LocationDetail · title-row status badge', () => {
  it('renders the status as a read-only badge next to the name, not a field-table row', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // The badge shows the resolved label.
    expect(screen.getByText('Actief')).toBeInTheDocument()
    // The pencil to change it sits right there in the title row.
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('renders no badge (but still an edit affordance) when the location carries no status yet', () => {
    render(<LocationDetail location={location({ statusId: null, status: '', statusLabel: '', statusColor: '' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('pencil reveals a picker seeded with the current status; picking another value + save PATCHes statusId', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    // Seeded with the current value — the trigger shows "Actief" (closed dropdown, one match).
    await user.click(screen.getByRole('button', { name: 'Actief' }))
    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    await user.click(screen.getByRole('button', { name: cm('save') }))

    expect(onSave).toHaveBeenCalledWith('loc-1', { statusId: 'status-inactive' })
    // Back to read-only badge display — the local edit state must have closed.
    expect(screen.queryByRole('button', { name: cm('save') })).not.toBeInTheDocument()
  })

  it('cancel discards the draft without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    await user.click(screen.getByRole('button', { name: cm('cancel') }))

    expect(onSave).not.toHaveBeenCalled()
    // The badge is back.
    expect(screen.getByText('Actief')).toBeInTheDocument()
  })

  it('the Algemeen field table no longer has its own status row (moved to the title)', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // Only ONE "Actief" on screen — the title badge — not a second one inside a field row.
    expect(screen.getAllByText('Actief')).toHaveLength(1)
  })
})
