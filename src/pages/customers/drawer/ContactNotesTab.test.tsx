/**
 * ContactNotesTab — CONTACT-NOTITIES-2. Three behaviours: (1) the create path
 * presets customer_contact_id and validates against the entity='contact' type
 * vocabulary; (2) the list is filtered client-side to only THIS contact's notes
 * (no dedicated scoped endpoint exists, see the hook's own docblock); (3) an
 * empty result renders the calm shared empty state, never a blank screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import i18n from '@/i18n'
import ContactNotesTab from './ContactNotesTab'

// Contact-entity note types, distinct from the customer-level ones (NOTE-TYPES-3-GAP-1).
// Capture the entity argument: the acceptance criterion is that this tab asks
// for the CONTACT vocabulary, and an argument-blind mock cannot prove that.
const noteTypesArg = vi.fn()
vi.mock('@/lib/useNoteTypes', () => ({
  useNoteTypes: (entity?: string) => {
    noteTypesArg(entity)
    return { types: [{ value: 'call', label: 'Call' }], writableTypes: [{ value: 'call', label: 'Call' }] }
  },
  SYSTEM_NOTE_TYPES: new Set(['status_change', 'lifecycle']),
}))
vi.mock('@/lib/mocks', () => ({ isAbortError: () => false }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea
// (mirrors CustomerNotesTab.contactLink.test.tsx's own convention).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

const mockGet = vi.fn()
const mockPost = vi.fn().mockResolvedValue({ data: {} })
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})

beforeEach(() => { mockGet.mockReset(); mockPost.mockClear(); mockPost.mockResolvedValue({ data: {} }) })

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

const queryWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

// Raw API rows — customer_contact_id is the field CustomerNoteResource.php:31
// puts on the wire; mixes a note about THIS contact with one about another
// contact and one company-level note, to prove the client-side filter.
const rows = [
  { id: 'n-1', type: 'call', title: '', text: 'Belafspraak met Jan', created_at: '2026-08-20T10:00:00Z', customer_contact_id: 'c1', contact_name: 'Jan Jansen' },
  { id: 'n-2', type: 'call', title: '', text: 'Notitie over een andere contactpersoon', created_at: '2026-08-20T10:00:00Z', customer_contact_id: 'c2', contact_name: 'Piet Pietersen' },
  { id: 'n-3', type: '', title: '', text: 'Algemene klantnotitie', created_at: '2026-08-20T10:00:00Z', customer_contact_id: null, contact_name: '' },
]

describe('ContactNotesTab · list filters to this contact only', () => {
  it('reads the customer-wide notes route and shows only the note linked to this contact', async () => {
    mockGet.mockResolvedValue({ data: { data: rows } })
    render(<ContactNotesTab contactId="c1" customerId="cust-1" />, { wrapper: queryWrapper })

    // rollup=1: a note that ALSO carries a location/department link must reach
    // this tab (the server filters it out without the param — Opus wave-B1).
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/customers/cust-1/notes',
      expect.objectContaining({ params: { rollup: 1 } })))
    expect(await screen.findByText('Belafspraak met Jan')).toBeInTheDocument()
    expect(screen.queryByText('Notitie over een andere contactpersoon')).not.toBeInTheDocument()
    expect(screen.queryByText('Algemene klantnotitie')).not.toBeInTheDocument()
  })

  // DATUM-1 + attribution (naronde): the mapper now carries created_at and
  // author, so the shared NotesTab formats the house date and prints the REAL
  // author instead of raw ISO text and the viewer's own avatar.
  it('renders the house-formatted date and the note author, never raw ISO', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      { id: 'n-9', type: 'call', title: 'Met auteur', text: 'x', created_at: '2026-08-20T10:00:00Z',
        customer_contact_id: 'c1', contact_name: 'Jan', author: 'Jan Jansen', author_id: 'u-2' },
    ] } })
    render(<ContactNotesTab contactId="c1" customerId="cust-1" />, { wrapper: queryWrapper })
    expect(await screen.findByText('Met auteur')).toBeInTheDocument()
    expect(screen.getByText(/Jan Jansen/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-20T10:00:00Z/)).not.toBeInTheDocument()
    expect(screen.getByText(/20-08-2026/)).toBeInTheDocument()
  })
})

describe('ContactNotesTab · empty state', () => {
  it('renders the calm shared empty state when this contact has no notes', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<ContactNotesTab contactId="c1" customerId="cust-1" />, { wrapper: queryWrapper })

    expect(await screen.findByText(ct('notes.notesEmpty'))).toBeInTheDocument()
  })
})

describe('ContactNotesTab · create path (CONTACT-NOTITIES-2)', () => {
  it('presets customer_contact_id and sends a contact-entity type on the new note', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    const user = userEvent.setup()
    render(<ContactNotesTab contactId="c1" customerId="cust-1" />, { wrapper: queryWrapper })
    await screen.findByText(ct('notes.notesEmpty'))

    await user.click(screen.getByRole('button', { name: ct('notes.newNote') }))
    await user.type(screen.getByTestId('rte'), 'Nieuwe notitie')
    await user.click(screen.getByTitle(ct('notes.save')))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/notes', expect.objectContaining({
      customer_contact_id: 'c1', type: 'call', text: 'Nieuwe notitie',
    })))
    // The vocabulary really is the CONTACT entity's own (NOTE-TYPES-3).
    expect(noteTypesArg).toHaveBeenCalledWith('contact')
  })
})
