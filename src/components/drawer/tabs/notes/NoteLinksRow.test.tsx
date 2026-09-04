/**
 * NoteLinksRow — NOTITIE-DOORLINK-1 write side: chip rendering (incl. the
 * `label: null` restricted case), the ✕ gate (manual AND manageable only), the
 * add flow's exact POST, and remove's exact DELETE + chip drop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
// Real i18n instance (§10 test convention) — none of this component's own deps
// happen to import '@/lib/datetime' (the usual transitive trigger), so without
// this the NL copy under test would never actually resolve.
import '@/i18n'
import api from '@/lib/api'
import NoteLinksRow from './NoteLinksRow'
import type { NoteLinkItem } from './noteLinksApi'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const page = (rows: unknown[]) => ({ data: { data: rows } }) as never

beforeEach(() => vi.clearAllMocks())

describe('NoteLinksRow', () => {
  it('renders nothing when there are no links and the reader may not manage this note', () => {
    const { container } = render(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a chip per seeded link as "type · label"', () => {
    const links: NoteLinkItem[] = [
      { id: 'l1', linkable_type: 'customer', linkable_id: 'cu1', label: 'Acme B.V.', is_manual: true },
    ]
    render(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} initialLinks={links} />)
    expect(screen.getByText('Klant · Acme B.V.')).toBeInTheDocument()
  })

  it('a null label (no view rights on the principal) renders the neutral restricted text', () => {
    const links: NoteLinkItem[] = [
      { id: 'l1', linkable_type: 'location', linkable_id: 'lo1', label: null, is_manual: false },
    ]
    render(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} initialLinks={links} />)
    expect(screen.getByText('Locatie · Geen inzage')).toBeInTheDocument()
  })

  it('shows the unlink control only when the link is manual AND the reader may manage this note', () => {
    const links: NoteLinkItem[] = [
      { id: 'manual', linkable_type: 'customer', linkable_id: 'cu1', label: 'Manual', is_manual: true },
      { id: 'auto', linkable_type: 'customer', linkable_id: 'cu2', label: 'Auto', is_manual: false },
    ]
    // Manageable reader: the manual link gets an unlink control, the derived one does not.
    const { rerender } = render(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage initialLinks={links} />)
    expect(screen.getAllByRole('button', { name: 'Ontkoppelen' })).toHaveLength(1)
    // Not manageable: even the manual link's control disappears.
    rerender(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} initialLinks={links} />)
    expect(screen.queryByRole('button', { name: 'Ontkoppelen' })).not.toBeInTheDocument()
  })

  it('add flow: picking a candidate POSTs the exact body and renders the returned chip', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([{ id: 'ca1', first_name: 'Ahmed', last_name: 'Bakker' }]))
    const created: NoteLinkItem = { id: 'l9', linkable_type: 'candidate', linkable_id: 'ca1', label: 'Ahmed Bakker', is_manual: true }
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: created } } as never)

    render(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage />)
    fireEvent.click(screen.getByRole('button', { name: 'Koppelen' }))
    // Default principal type is 'candidate' — open the entity search and pick the result.
    fireEvent.click(screen.getByRole('button', { name: 'Zoek record…' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ahmed Bakker' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Ahmed Bakker' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/candidates/c1/notes/n1/links', { linkable_type: 'candidate', linkable_id: 'ca1' },
    ))
    await waitFor(() => expect(screen.getByText('Kandidaat · Ahmed Bakker')).toBeInTheDocument())
    // The picker closes back to the add button once the link lands.
    expect(screen.getByRole('button', { name: 'Koppelen' })).toBeInTheDocument()
  })

  // K-225 H2: the note read endpoint now carries `links`, so a refetch (e.g. after
  // an unrelated edit) hands this row a FRESH initialLinks payload — it must reseed.
  it('reseeds from a fresh initialLinks payload (e.g. after a refetch) when its content changes', () => {
    const first: NoteLinkItem[] = [
      { id: 'l1', linkable_type: 'customer', linkable_id: 'cu1', label: 'Acme B.V.', is_manual: true },
    ]
    const { rerender } = render(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} initialLinks={first} />)
    expect(screen.getByText('Klant · Acme B.V.')).toBeInTheDocument()

    const second: NoteLinkItem[] = [
      { id: 'l2', linkable_type: 'customer', linkable_id: 'cu2', label: 'Globex N.V.', is_manual: true },
    ]
    rerender(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} initialLinks={second} />)
    expect(screen.queryByText('Klant · Acme B.V.')).not.toBeInTheDocument()
    expect(screen.getByText('Klant · Globex N.V.')).toBeInTheDocument()
  })

  it('does not reseed on an identity-only change — a new array with the SAME rows leaves the chips as they are', () => {
    const links: NoteLinkItem[] = [
      { id: 'l1', linkable_type: 'customer', linkable_id: 'cu1', label: 'Acme B.V.', is_manual: true },
    ]
    const { rerender } = render(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} initialLinks={links} />)
    expect(screen.getByText('Klant · Acme B.V.')).toBeInTheDocument()
    // A brand-new array instance carrying the identical row — must not disappear/duplicate.
    rerender(<NoteLinksRow mode="edit" host="candidates" hostId="c1" noteId="n1" canManage={false} initialLinks={[...links]} />)
    expect(screen.getAllByText('Klant · Acme B.V.')).toHaveLength(1)
  })

  it('remove flow: clicking unlink DELETEs the exact route and drops the chip', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: null } as never)
    const links: NoteLinkItem[] = [
      { id: 'l1', linkable_type: 'customer', linkable_id: 'cu1', label: 'Acme B.V.', is_manual: true },
    ]
    render(<NoteLinksRow mode="edit" host="customers" hostId="cu9" noteId="n7" canManage initialLinks={links} />)
    expect(screen.getByText('Klant · Acme B.V.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ontkoppelen' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/customers/cu9/notes/n7/links/l1'))
    await waitFor(() => expect(screen.queryByText('Klant · Acme B.V.')).not.toBeInTheDocument())
  })
})

// KOPPELEN-IN-POPOUT-1 (Danny 05-09): a note ROW never carries a link control; it only shows chips.
describe('NoteLinksRow · display mode (the note row)', () => {
  it('renders the chips but no Koppelen or Ontkoppelen control, even for a manageable note', () => {
    render(<NoteLinksRow host="candidates" hostId="c1" noteId="n1" canManage
      initialLinks={[{ id: 'l1', linkable_type: 'customer', linkable_id: 'k1', label: 'Bol', is_manual: true }]} />)
    expect(screen.getByText(/Bol/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Koppelen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ontkoppelen' })).not.toBeInTheDocument()
  })

  it('renders nothing at all without links in display mode', () => {
    const { container } = render(<NoteLinksRow host="candidates" hostId="c1" noteId="n1" canManage initialLinks={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

