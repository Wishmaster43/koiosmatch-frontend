/**
 * CustomerNotesTab · CONTACT-NOTITIES-1 + NOTES-LOC-DEPT-1 — a note can be filed
 * against one of this customer's own contacts, or (NOTES-LOC-DEPT-1) against one
 * of its locations/departments instead. Kept in its own file (real i18n, unlike
 * CustomerNotesTab.test.tsx which deliberately mocks @/lib/datetime to keep t()
 * echoing raw keys) so these assertions read the real translated copy, mirroring
 * LocationDetail.test.tsx's own convention.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CustomerNotesTab from './CustomerNotesTab'
import type { Customer, CustomerNote } from '@/types/customer'

vi.mock('@/lib/useNoteTypes', () => ({
  useNoteTypes: () => ({ types: [], writableTypes: [] }),
  // The shared NotesTab reads this directly (system-event rows) — must ride along.
  SYSTEM_NOTE_TYPES: new Set(['status_change', 'lifecycle']),
}))
vi.mock('@/lib/mocks', () => ({ isAbortError: () => false }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea
// (mirrors LocationDetail.test.tsx/DepartmentDetail.test.tsx's own convention).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})

beforeEach(() => vi.clearAllMocks())

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

// A customer carrying one of each linkable record (contact/location/department) —
// the picker's own option list at every non-default level.
const customerWithLinks = {
  id: 'cust-1', name: 'Acme Zorg',
  contacts: [{ id: 'con-1', name: 'Joost de Boer', role: 'Teamleider' }],
  locations: [{ id: 'loc-1', name: 'Hoofdlocatie' }],
  departments: [{ id: 'dep-1', name: 'Verpleging', locationName: 'Hoofdlocatie' }],
} as unknown as Customer

const note = (over: Partial<CustomerNote> = {}): CustomerNote =>
  ({
    id: 'n-1', type: '', title: '', text: 'Belafspraak gemaakt', ago: '2 dagen geleden', contactId: null, contactName: '',
    // NOTES-LOC-DEPT-1: the location/department link fields — null/empty by
    // default, exactly like contactId/contactName above (a company-level note).
    locationId: null, locationName: '', departmentId: null, departmentName: '',
    ...over,
  })

describe('CustomerNotesTab · linked-to chip', () => {
  it('renders the "linked to" chip on a note that carries a contactName', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[note({ contactId: 'con-1', contactName: 'Joost de Boer' })]}
      onAddNote={vi.fn()} c={customerWithLinks} onSave={vi.fn()} />)
    expect(screen.getByText(ct('notes.linkedTo', { name: 'Joost de Boer' }))).toBeInTheDocument()
  })

  it('renders the "linked to" chip on a note carrying a locationName, and prefers departmentName when both are set', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg"
      notes={[note({ locationId: 'loc-1', locationName: 'Hoofdlocatie' }), note({ id: 'n-2', locationId: 'loc-1', locationName: 'Hoofdlocatie', departmentId: 'dep-1', departmentName: 'Verpleging' })]}
      onAddNote={vi.fn()} c={customerWithLinks} onSave={vi.fn()} />)
    expect(screen.getByText(ct('notes.linkedTo', { name: 'Hoofdlocatie' }))).toBeInTheDocument()
    expect(screen.getByText(ct('notes.linkedTo', { name: 'Verpleging' }))).toBeInTheDocument()
  })

  it('renders no chip on a company-level note (no linked record)', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[note()]}
      onAddNote={vi.fn()} c={customerWithLinks} onSave={vi.fn()} />)
    expect(screen.queryByText(ct('notes.linkedTo', { name: 'Joost de Boer' }))).not.toBeInTheDocument()
  })
})

describe('CustomerNotesTab · "gekoppeld aan" picker (composer)', () => {
  it('offers no picker at all when the customer has nothing to link to', () => {
    const customerEmpty = { id: 'cust-1', name: 'Acme Zorg', contacts: [], locations: [], departments: [] } as unknown as Customer
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={vi.fn()} c={customerEmpty} onSave={vi.fn()} />)
    expect(screen.queryByText(ct('notes.linkContactLabel'))).not.toBeInTheDocument()
  })

  it('sends the picked contact\'s id as customer_contact_id, and nothing else, on the next note', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={onAddNote} c={customerWithLinks} onSave={vi.fn()} />)

    // The picker defaults to "Klant" (no link) — open it and pick the contact.
    // Picker lives INSIDE the composer since 05-08 — open it first.
    await user.click(screen.getByRole('button', { name: ct('notes.newNote') }))
    await user.click(screen.getByRole('button', { name: ct('notes.linkLevelOptions.customer') }))
    await user.click(screen.getByRole('button', { name: 'Joost de Boer — Teamleider' }))
    await user.click(screen.getByTitle(ct('notes.save')))

    expect(onAddNote).toHaveBeenCalledWith(expect.objectContaining({
      customer_contact_id: 'con-1', customer_location_id: undefined, customer_department_id: undefined,
    }))
  })

  it('sends the picked location\'s id as customer_location_id, and nothing else, on the next note', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={onAddNote} c={customerWithLinks} onSave={vi.fn()} />)

    // Picker lives INSIDE the composer since 05-08 — open it first.
    await user.click(screen.getByRole('button', { name: ct('notes.newNote') }))
    await user.click(screen.getByRole('button', { name: ct('notes.linkLevelOptions.customer') }))
    await user.click(screen.getByRole('button', { name: 'Hoofdlocatie' }))
    await user.click(screen.getByTitle(ct('notes.save')))

    expect(onAddNote).toHaveBeenCalledWith(expect.objectContaining({
      customer_location_id: 'loc-1', customer_contact_id: undefined, customer_department_id: undefined,
    }))
  })

  it('sends the picked department\'s id as customer_department_id, and nothing else, on the next note', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={onAddNote} c={customerWithLinks} onSave={vi.fn()} />)

    // Picker lives INSIDE the composer since 05-08 — open it first.
    await user.click(screen.getByRole('button', { name: ct('notes.newNote') }))
    await user.click(screen.getByRole('button', { name: ct('notes.linkLevelOptions.customer') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging — Hoofdlocatie' }))
    await user.click(screen.getByTitle(ct('notes.save')))

    expect(onAddNote).toHaveBeenCalledWith(expect.objectContaining({
      customer_department_id: 'dep-1', customer_contact_id: undefined, customer_location_id: undefined,
    }))
  })

  it('a note left at "Klant" (nothing picked) sends none of the three link ids', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={onAddNote} c={customerWithLinks} onSave={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: ct('notes.newNote') }))
    await user.click(screen.getByTitle(ct('notes.save')))

    expect(onAddNote).toHaveBeenCalledWith(expect.objectContaining({
      customer_contact_id: undefined, customer_location_id: undefined, customer_department_id: undefined,
    }))
  })
})
