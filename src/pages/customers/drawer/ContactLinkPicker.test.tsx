/**
 * ContactLinkPicker — covers the "Koppelen" popup upgrade (Danny 28-07: wider
 * panel + per-contact CURRENT links). Focus of these tests: the singular-id
 * fallback resolver (the measured regression that matters — mirrors
 * ContactsTab.tsx's docblock, since the plural locations[]/departments[] arrays
 * come back empty for every seeded contact today), the "not linked yet" empty
 * state, client-side search, and the actual onPick call.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ContactLinkPicker from './ContactLinkPicker'
import type { Contact } from '@/types/customer'

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]

// Minimal-but-type-complete Contact fixture (mirrors ContactsTab.test.tsx's
// baseContact) — only the fields each test cares about vary.
const baseContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c1', helloflexLink: null, shiftmanagerLink: null,
  firstName: 'Jan', middleName: '', lastName: 'Jansen', name: 'Jan Jansen',
  role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '',
  lastContactAt: null, lastContactType: null, customFields: {},
  ...overrides,
})

const noop = { onPick: vi.fn(), onClose: vi.fn() }

describe('ContactLinkPicker · singular-id fallback (measured, mirrors ContactsTab.tsx)', () => {
  it('resolves a contact whose only link is the SINGULAR locationId as a location chip', () => {
    // locations[] left empty on purpose — the plural array is empty for every
    // seeded contact today; the picker must resolve locationId against the
    // customer-wide `locations` prop instead of showing no chip at all.
    const contact = baseContact({ id: 'c1', name: 'Marie Bakker', locationId: 'loc-1' })
    render(<ContactLinkPicker candidates={[contact]} locations={locations} departments={[]} {...noop} />)

    expect(screen.getByText(ct('locations.detail.pickContactLinks'))).toBeInTheDocument()
    expect(screen.getByText('Locatie Noord')).toBeInTheDocument()
  })

  it('renders the "not linked yet" caption for a contact with no links at all', () => {
    const contact = baseContact({ id: 'c2', name: 'Piet Peters' })
    render(<ContactLinkPicker candidates={[contact]} locations={locations} departments={[]} {...noop} />)

    expect(screen.getByText(ct('locations.detail.pickContactNoLinks'))).toBeInTheDocument()
    expect(screen.queryByText(ct('locations.detail.pickContactLinks'))).not.toBeInTheDocument()
  })
})

describe('ContactLinkPicker · search', () => {
  it('narrows the list on a match, and shows the no-results text when nothing matches', async () => {
    const user = userEvent.setup()
    const a = baseContact({ id: 'c1', name: 'Marie Bakker' })
    const b = baseContact({ id: 'c2', name: 'Piet Peters' })
    render(<ContactLinkPicker candidates={[a, b]} locations={locations} departments={[]} {...noop} />)

    const search = screen.getByPlaceholderText(ct('locations.detail.pickContactSearch'))
    await user.type(search, 'Marie')
    expect(screen.getByText('Marie Bakker')).toBeInTheDocument()
    expect(screen.queryByText('Piet Peters')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'nobody-matches-this')
    expect(screen.getByText(cm('noResults'))).toBeInTheDocument()
  })
})

describe('ContactLinkPicker · pick', () => {
  it('clicking a row calls onPick with that contact id', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const contact = baseContact({ id: 'c3', name: 'Sanne de Vries' })
    render(<ContactLinkPicker candidates={[contact]} locations={locations} departments={[]} onPick={onPick} onClose={vi.fn()} />)

    await user.click(screen.getByText('Sanne de Vries'))
    expect(onPick).toHaveBeenCalledWith('c3')
  })
})
