/**
 * NoteFeedList — NOTITIE-DOORLINK-1 (read side): the four UI states, that
 * `is_direct: true` rows are filtered out (avoiding a double-render of the
 * host's own notes list — see file docblock), the source chip's deep-link vs.
 * deleted-degrade, and the only-direct toggle hiding the section entirely.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import NoteFeedList from './NoteFeedList'

// Stable note-type lookup stub (the type chip resolves against the principal's own list).
const noteTypesValue = { types: [{ value: 'general', label: 'Algemeen', color: 'var(--color-secondary)' }] }
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => noteTypesValue }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const openEntityMock = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntityMock }) }))

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const page = (rows: unknown[], current = 1, last = 1) =>
  ({ data: { data: rows, current_page: current, last_page: last, total: rows.length, per_page: 25 } }) as never

beforeEach(() => vi.clearAllMocks())

describe('NoteFeedList', () => {
  it('shows a loading state, then the empty state when the feed has nothing', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([]))
    render(createElement(NoteFeedList, { entity: 'candidates', id: 'c1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('Geen gekoppelde notities.')).toBeInTheDocument())
  })

  it('shows an error row with a working retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom'))
    render(createElement(NoteFeedList, { entity: 'candidates', id: 'c1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('Laden van gekoppelde notities is mislukt.')).toBeInTheDocument())
    vi.mocked(api.get).mockResolvedValueOnce(page([]))
    fireEvent.click(screen.getByText('Probeer opnieuw'))
    await waitFor(() => expect(screen.getByText('Geen gekoppelde notities.')).toBeInTheDocument())
  })

  it('asks the server for the linked subset (only_linked=1) and renders what it returns', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([
      { id: 'n2', note_type: 'application_note', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false }, body: 'linked note', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-02T10:00:00Z', is_direct: false, principals: [] },
    ]))
    render(createElement(NoteFeedList, { entity: 'candidates', id: 'c1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('linked note')).toBeInTheDocument())
    // The filter is SERVER-side since BE 97a1aac1 — the request must carry it.
    const [, config] = vi.mocked(api.get).mock.calls[0]
    expect((config?.params as Record<string, unknown>)?.only_linked).toBe(1)
  })

  it('a deep-linkable source chip opens the record; a deleted source degrades to plain text', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([
      { id: 'n1', note_type: 'application_note', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false }, body: 'alive', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', is_direct: false, principals: [] },
      { id: 'n2', note_type: 'match_note', source: { type: 'match', id: null, label: 'Match', deleted: true }, body: 'gone', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-02T10:00:00Z', is_direct: false, principals: [] },
    ]))
    render(createElement(NoteFeedList, { entity: 'candidates', id: 'c1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('alive')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Sollicitatie · Jan'))
    expect(openEntityMock).toHaveBeenCalledWith('applications', 'a1')
    // The deleted source's chip degrades to plain text — no click target for it.
    expect(screen.getByText('Match (verwijderd)')).toBeInTheDocument()
  })

  it('the only-direct toggle hides the section (it would otherwise always be empty)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([
      { id: 'n2', note_type: 'application_note', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false }, body: 'linked note', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-02T10:00:00Z', is_direct: false, principals: [] },
    ]))
    render(createElement(NoteFeedList, { entity: 'candidates', id: 'c1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('linked note')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.queryByText('linked note')).not.toBeInTheDocument()
  })

  it('load-more requests the next page (pinned params) and appends its rows', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([
      { id: 'n2', note_type: 'application_note', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false }, body: 'page one', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-02T10:00:00Z', is_direct: false, principals: [] },
    ], 1, 2))
    render(createElement(NoteFeedList, { entity: 'candidates', id: 'c1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('page one')).toBeInTheDocument())
    vi.mocked(api.get).mockResolvedValueOnce(page([
      { id: 'n3', note_type: 'match_note', source: { type: 'match', id: 'm1', label: 'Match · Jan', deleted: false }, body: 'page two', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-03T10:00:00Z', updated_at: '2026-08-03T10:00:00Z', is_direct: false, principals: [] },
    ], 2, 2))
    fireEvent.click(screen.getByText('Meer laden'))
    await waitFor(() => expect(screen.getByText('page two')).toBeInTheDocument())
    const [, config] = vi.mocked(api.get).mock.calls[1]
    expect(config?.params).toEqual({ only_linked: 1, per_page: 25, page: 2 })
  })

  it('renders the server-resolved type_label on the chip, never the raw slug', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([
      { id: 'n9', note_type: 'application_note', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false }, body: 'typed note', type: 'weird_slug', type_label: 'Bellijst', author: 'Kelly', language: null, created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', is_direct: false, principals: [] },
    ]))
    render(createElement(NoteFeedList, { entity: 'candidates', id: 'c1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('typed note')).toBeInTheDocument())
    expect(screen.getByText('Bellijst')).toBeInTheDocument()
    expect(screen.queryByText('weird_slug')).not.toBeInTheDocument()
  })

  it('renders the honest screened-off state for a masked item, never a blank body', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([
      { id: 'n8', note_type: 'match_note', source: { type: 'match', id: 'm1', label: 'Match', deleted: false }, body: null, body_masked: true, type: null, author: null, language: null, created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', is_direct: false, principals: [] },
    ]))
    render(createElement(NoteFeedList, { entity: 'customers', id: 'cu1' }), { wrapper })
    await waitFor(() => expect(screen.getByText('Inhoud afgeschermd (geen kandidaat-rechten)')).toBeInTheDocument())
  })
})
