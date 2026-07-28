/**
 * ContactsTab — column additions (Danny 28-07: "contactpersonen tabel moet meer
 * informatie bevatten ... status maar ook mobile met hyperlink en email met
 * hyperlink ... laatste contact datum en type"). Covers: the primary contact
 * renders a real TEXT chip (not just an icon, §6 — colour is never the only
 * signal); email/mobile render as real mailto:/tel: links; and the new
 * last-contact column shows a muted dash today (lastContactAt is null until
 * CustomerContactResource sends it) but renders the formatted date the moment a
 * row DOES carry one — proving the column works ahead of that backend delivery.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import ContactsTab from './ContactsTab'
import type { Contact } from '@/types/customer'

// ContactsTab itself only calls useLastContactTypes/useDateFormat (no network) —
// stub the lookup hook the same way CandidatesTable.test.tsx does for its own
// combined last-contact column, and mock the api client defensively in case a
// child (ContactDetail/AddContactPersonModal) ever mounts during a test.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/useLastContactTypes', () => ({
  useLastContactTypes: () => ({ labelOf: (v: string) => v, iconOf: () => undefined }),
}))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

// Minimal-but-type-complete Contact fixture (mirrors ContactDetail.test.tsx's
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

const noop = { onAdd: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn() }

// The column index for a header label — used to scope a cell assertion to the
// exact "Last contact" column instead of guessing which '—' on the row is which.
const columnIndex = (header: string) => {
  const headers = screen.getAllByRole('columnheader').map(th => th.textContent ?? '')
  return headers.findIndex(h => h.includes(header))
}

describe('ContactsTab · primary chip (Danny 28-07: colour alone was not enough to tell who is primary)', () => {
  it('renders the primary-contact chip TEXT on the primary contact only', () => {
    const primary = baseContact({ id: 'c1', name: 'Jan Jansen', isPrimary: true })
    const other = baseContact({ id: 'c2', name: 'Marie Bakker', isPrimary: false })
    render(<ContactsTab contacts={[primary, other]} {...noop} />)

    const primaryRow = screen.getByText('Jan Jansen').closest('tr') as HTMLElement
    const otherRow = screen.getByText('Marie Bakker').closest('tr') as HTMLElement
    expect(within(primaryRow).getByText(ct('contacts.primaryChip'))).toBeInTheDocument()
    expect(within(otherRow).queryByText(ct('contacts.primaryChip'))).not.toBeInTheDocument()
  })
})

describe('ContactsTab · email/mobile as real hyperlinks (Danny 28-07)', () => {
  it('renders the email cell as a mailto: link and the mobile cell as a tel: link', () => {
    const contact = baseContact({ email: 'jan@example.nl', mobile: '0612345678' })
    render(<ContactsTab contacts={[contact]} {...noop} />)

    const emailLink = screen.getByText('jan@example.nl').closest('a') as HTMLAnchorElement
    expect(emailLink).toHaveAttribute('href', 'mailto:jan@example.nl')
    const mobileLink = screen.getByText('0612345678').closest('a') as HTMLAnchorElement
    expect(mobileLink).toHaveAttribute('href', 'tel:0612345678')
  })
})

describe('ContactsTab · last-contact column (Danny 28-07, always null until the backend field ships)', () => {
  it('renders a muted dash when lastContactAt is null', () => {
    const contact = baseContact({ name: 'Jan Jansen', lastContactAt: null })
    render(<ContactsTab contacts={[contact]} {...noop} />)

    const idx = columnIndex(ct('contacts.col.lastContact'))
    const row = screen.getByText('Jan Jansen').closest('tr') as HTMLElement
    expect(within(row).getAllByRole('cell')[idx]).toHaveTextContent('—')
  })

  it('renders the formatted date once a row carries a lastContactAt — proves the column works ahead of the backend delivery', () => {
    const iso = '2026-07-20T09:00:00.000Z'
    // Mirrors formatDate's default options (lib/datetime.ts): DD-MM-YYYY, nl-NL.
    const expected = new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const contact = baseContact({ name: 'Jan Jansen', lastContactAt: iso, lastContactType: 'phone' })
    render(<ContactsTab contacts={[contact]} {...noop} />)

    const idx = columnIndex(ct('contacts.col.lastContact'))
    const row = screen.getByText('Jan Jansen').closest('tr') as HTMLElement
    expect(within(row).getAllByRole('cell')[idx]).toHaveTextContent(expected)
  })
})
