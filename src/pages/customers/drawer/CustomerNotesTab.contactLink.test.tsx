/**
 * CustomerNotesTab · CONTACT-NOTITIES-1 (Danny quick win) — a note can be filed
 * against one of this customer's own contacts. Kept in its own file (real i18n,
 * unlike CustomerNotesTab.test.tsx which deliberately mocks @/lib/datetime to
 * keep t() echoing raw keys) so these assertions read the real translated copy,
 * mirroring LocationDetail.test.tsx's own convention.
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

// Minimal customer carrying one contact (the picker's own option list).
const customerWithContact = {
  id: 'cust-1', name: 'Acme Zorg',
  contacts: [{ id: 'con-1', name: 'Joost de Boer', role: 'Teamleider' }],
} as unknown as Customer

const note = (over: Partial<CustomerNote> = {}): CustomerNote =>
  ({ id: 'n-1', type: '', title: '', text: 'Belafspraak gemaakt', ago: '2 dagen geleden', contactId: null, contactName: '', ...over })

describe('CustomerNotesTab · linked-contact chip', () => {
  it('renders the "linked to" chip on a note that carries a contactName', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[note({ contactId: 'con-1', contactName: 'Joost de Boer' })]}
      onAddNote={vi.fn()} c={customerWithContact} onSave={vi.fn()} />)
    expect(screen.getByText(ct('notes.linkedTo', { name: 'Joost de Boer' }))).toBeInTheDocument()
  })

  it('renders no chip on a company-level note (no linked contact)', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[note()]}
      onAddNote={vi.fn()} c={customerWithContact} onSave={vi.fn()} />)
    expect(screen.queryByText(ct('notes.linkedTo', { name: 'Joost de Boer' }))).not.toBeInTheDocument()
  })
})

describe('CustomerNotesTab · contact picker (composer)', () => {
  it('offers no picker at all when the customer has no contacts', () => {
    const customerNoContacts = { id: 'cust-1', name: 'Acme Zorg', contacts: [] } as unknown as Customer
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={vi.fn()} c={customerNoContacts} onSave={vi.fn()} />)
    expect(screen.queryByText(ct('notes.linkContactLabel'))).not.toBeInTheDocument()
  })

  it('sends the picked contact\'s id as customer_contact_id on the next note', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={onAddNote} c={customerWithContact} onSave={vi.fn()} />)

    // Pick the contact via the new picker (defaults to "no contact").
    await user.click(screen.getByRole('button', { name: ct('notes.linkContactNone') }))
    await user.click(screen.getByRole('button', { name: 'Joost de Boer — Teamleider' }))

    // Compose and save through the shared composer.
    await user.click(screen.getByRole('button', { name: ct('notes.newNote') }))
    await user.click(screen.getByTitle(ct('notes.save')))

    expect(onAddNote).toHaveBeenCalledWith(expect.objectContaining({ customer_contact_id: 'con-1' }))
  })

  it('a note left unlinked (nothing picked) sends no customer_contact_id', async () => {
    const user = userEvent.setup()
    const onAddNote = vi.fn()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]}
      onAddNote={onAddNote} c={customerWithContact} onSave={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: ct('notes.newNote') }))
    await user.click(screen.getByTitle(ct('notes.save')))

    expect(onAddNote).toHaveBeenCalledWith(expect.objectContaining({ customer_contact_id: undefined }))
  })
})
