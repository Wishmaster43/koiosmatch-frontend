/**
 * LinkedNotesTab — K-288: the toolbar is NotesTab's own header (search box +
 * one shared `DrawerFilterMenu`, Danny 04-09 "zoekbalk en filter in huisstijl!")
 * — both narrow the already-loaded feed CLIENT-SIDE (search on body/source
 * label/author, source-type via the filter panel's single-select row, "Alleen
 * directe notities" via its new toggle row). The per-row action cluster is
 * gated on `can_manage` (never guessed from the author) — pencil opens the
 * inline editor and calls `patchLinkedNote` on save, pop-out opens the note's
 * own second-screen window, and a masked row never grows a pencil.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LinkedNotesTab from './LinkedNotesTab'
import type { NoteFeedItem, UseNoteFeedResult } from '@/hooks/useNoteFeed'

// vi.mock factories are hoisted above const declarations, so every spy a
// factory closes over must be created via vi.hoisted (mirrors NotesTab.test.tsx).
const { useNoteFeedMock, openEntityMock, patchLinkedNoteMock } = vi.hoisted(() => ({
  useNoteFeedMock: vi.fn(), openEntityMock: vi.fn(), patchLinkedNoteMock: vi.fn(),
}))

// useNoteFeed itself is mocked here (its own request/pagination contract is
// pinned in useNoteFeed.test.ts) — this file only proves LinkedNotesTab wires
// the filter value through and renders the action cluster correctly.
vi.mock('@/hooks/useNoteFeed', () => ({ useNoteFeed: (...args: unknown[]) => useNoteFeedMock(...args) }))

// Stable note-type lookup stub (mirrors NoteFeedList.test.tsx).
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [{ value: 'general', label: 'Algemeen', color: 'var(--color-secondary)' }] }) }))

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock }) }))

// Tiptap is out of scope here (mirrors NoteComposer.test.tsx's own convention)
// — a plain textarea stands in so the inline editor's value/onChange wiring is assertable.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rte-body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

// Only patchLinkedNote is stubbed — linkedNotePopoutUrl/openLinkedNotePopout stay
// real so the pop-out test proves the REAL chain down to window.open.
vi.mock('./linkedNoteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./linkedNoteApi')>()
  return { ...actual, patchLinkedNote: (...args: unknown[]) => patchLinkedNoteMock(...args) }
})

const reloadMock = vi.fn()
const loadMoreMock = vi.fn()

// One feed item — override per test (source/can_manage/body_masked/...).
const feedItem = (over: Partial<NoteFeedItem> = {}): NoteFeedItem => ({
  id: 'n1', note_type: 'application_note',
  source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false },
  body: 'linked note', type: 'general', author: 'Kelly', language: null,
  created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-02T10:00:00Z',
  is_direct: false, principals: [],
  ...over,
})

const feedResult = (items: NoteFeedItem[], over: Partial<UseNoteFeedResult> = {}): UseNoteFeedResult =>
  ({ items, loading: false, error: false, hasMore: false, loadingMore: false, loadMore: loadMoreMock, reload: reloadMock, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  useNoteFeedMock.mockReturnValue(feedResult([]))
})

describe('LinkedNotesTab · toolbar', () => {
  // Bundle H (server source_type) has not landed — the hook always gets null;
  // filtering happens client-side over the already-loaded page (see file docblock).
  it('requests the feed once, without a source_type — filtering stays client-side for now', () => {
    render(<LinkedNotesTab entity="candidates" id="c1" />)
    expect(useNoteFeedMock).toHaveBeenCalledWith('candidates', 'c1', true, undefined, null)
  })

  it('the search box narrows on body text (HTML stripped), source label and author', async () => {
    const user = userEvent.setup()
    useNoteFeedMock.mockReturnValue(feedResult([
      feedItem({ id: 'n1', body: '<p>call about the interview</p>', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false } }),
      feedItem({ id: 'n2', body: 'placed successfully', author: 'Sam', source: { type: 'match', id: 'm1', label: 'Match · Piet', deleted: false } }),
    ]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)
    expect(screen.getByText(/call about the interview/)).toBeInTheDocument()
    expect(screen.getByText('placed successfully')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Zoek gekoppelde notities…'), 'interview')
    expect(screen.getByText(/call about the interview/)).toBeInTheDocument()
    expect(screen.queryByText('placed successfully')).not.toBeInTheDocument()
  })

  it('the source-type filter row (in the shared DrawerFilterMenu) narrows to that family', async () => {
    const user = userEvent.setup()
    useNoteFeedMock.mockReturnValue(feedResult([
      feedItem({ id: 'n1', body: 'application note', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false } }),
      feedItem({ id: 'n2', body: 'match note', source: { type: 'match', id: 'm1', label: 'Match · Piet', deleted: false } }),
    ]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Alle bronnen' }))
    await user.click(screen.getByRole('button', { name: 'Match' }))
    expect(screen.getByText('match note')).toBeInTheDocument()
    expect(screen.queryByText('application note')).not.toBeInTheDocument()
  })

  it('the "only direct" toggle shows the honest empty state instead of a filtered list', async () => {
    const user = userEvent.setup()
    useNoteFeedMock.mockReturnValue(feedResult([feedItem({ body: 'linked note' })]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)
    expect(screen.getByText('linked note')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('switch', { name: 'Alleen directe notities' }))
    expect(screen.queryByText('linked note')).not.toBeInTheDocument()
    expect(screen.getByText('Geen gekoppelde notities.')).toBeInTheDocument()
  })
})

describe('LinkedNotesTab · action cluster gating', () => {
  it('shows no pencil/pop-out when the reader may not manage the note', () => {
    useNoteFeedMock.mockReturnValue(feedResult([feedItem({ can_manage: false })]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)
    expect(screen.getByText('linked note')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bewerken' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open op tweede scherm' })).not.toBeInTheDocument()
  })

  it('shows both actions when can_manage is true', () => {
    useNoteFeedMock.mockReturnValue(feedResult([feedItem({ can_manage: true })]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)
    expect(screen.getByRole('button', { name: 'Bewerken' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open op tweede scherm' })).toBeInTheDocument()
  })

  it('a masked row never grows a pencil, even when can_manage is true', () => {
    useNoteFeedMock.mockReturnValue(feedResult([feedItem({ can_manage: true, body_masked: true, body: null })]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)
    expect(screen.getByText('Inhoud afgeschermd (geen kandidaat-rechten)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bewerken' })).not.toBeInTheDocument()
  })
})

describe('LinkedNotesTab · inline edit', () => {
  it('pencil opens the editor; save calls patchLinkedNote with the item + new body, then reloads', async () => {
    const item = feedItem({ can_manage: true })
    useNoteFeedMock.mockReturnValue(feedResult([item]))
    patchLinkedNoteMock.mockResolvedValueOnce(true)
    render(<LinkedNotesTab entity="candidates" id="c1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Bewerken' }))
    const textarea = screen.getByLabelText('rte-body')
    fireEvent.change(textarea, { target: { value: 'edited body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(patchLinkedNoteMock).toHaveBeenCalledWith(item, 'edited body'))
    await waitFor(() => expect(reloadMock).toHaveBeenCalled())
  })

  it('shows the save-error notice and keeps the editor open on failure', async () => {
    const item = feedItem({ can_manage: true })
    useNoteFeedMock.mockReturnValue(feedResult([item]))
    patchLinkedNoteMock.mockResolvedValueOnce(false)
    render(<LinkedNotesTab entity="candidates" id="c1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Bewerken' }))
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(screen.getByText('Opslaan is niet gelukt. Probeer het opnieuw.')).toBeInTheDocument())
    expect(reloadMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText('rte-body')).toBeInTheDocument()
  })

  it('cancel closes the editor without saving', () => {
    const item = feedItem({ can_manage: true })
    useNoteFeedMock.mockReturnValue(feedResult([item]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Bewerken' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuleren' }))

    expect(patchLinkedNoteMock).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('rte-body')).not.toBeInTheDocument()
    expect(screen.getByText('linked note')).toBeInTheDocument()
  })
})

describe('LinkedNotesTab · pop-out', () => {
  it('opens the note-id-in-URL second-screen window via the real window.open chain', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    useNoteFeedMock.mockReturnValue(feedResult([feedItem({ id: 'n9', can_manage: true, source: { type: 'candidate', id: 'c1', label: 'Ahmed Bakker', deleted: false } })]))
    render(<LinkedNotesTab entity="candidates" id="c1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open op tweede scherm' }))
    expect(openSpy).toHaveBeenCalledWith('/popout/notes/candidate/c1/n9', expect.stringContaining('koios-note-candidate-c1-n9'), expect.any(String))
    openSpy.mockRestore()
  })
})
