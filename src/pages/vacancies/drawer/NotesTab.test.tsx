import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'
import type { VacancyDetail } from '@/types/vacancy'

// useNoteTypes fetches /note-types on mount; addNote POSTs → stub both api methods.
// Keep the real named exports (importActual) — useCachedLookup's tenant-scoped
// cache key needs the real getActiveTenantId, only the default client is stubbed
// (mirrors matches/tasks NotesTab.test.tsx).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn() } }
})
// Stub useDateFormat so the shared NotesTab doesn't transitively init i18n (t() → keys).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, locale: 'nl-NL' }) }))
// OPTIMISTIC-REVERT-1 pattern (mirrors applications/drawer/NotesTab.test.tsx): mock
// notify so a failed save's error toast is assertable.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const vacancy = (over: Partial<VacancyDetail> = {}) => ({
  id: 1, owner: { id: 'u1', name: 'Bente de Jong', initials: 'BD', color: null }, notes: [], ...over,
} as unknown as VacancyDetail)

describe('vacancies NotesTab (VACANCY-NOTE-TYPE-1, shared reuse)', () => {
  it('shows the notes section and the empty state', () => {
    render(<NotesTab vacancy={vacancy()} />)
    // The section title is gone (Danny 05-08) — the search input is the stable landmark.
    expect(screen.getByPlaceholderText('notes.searchPlaceholder')).toBeInTheDocument()
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
  })

  it('offers a new-note composer button', () => {
    render(<NotesTab vacancy={vacancy()} />)
    expect(screen.getByRole('button', { name: 'notes.new' })).toBeInTheDocument()
  })

  it('does not render the drawer-owned timeline/conversations sections here', () => {
    render(<NotesTab vacancy={vacancy()} />)
    expect(screen.queryByText('sections.timeline')).toBeNull()
    expect(screen.queryByText('sections.conversations')).toBeNull()
  })

  // §13 — a mutation test must assert the REQUEST, not only that a callback fired.
  // VacancyNoteController validates `type` against the entity=vacancy note_types scope
  // (VACANCY-NOTE-TYPE-1), so the composer must actually carry the picked type on save.
  it('POSTs the picked note type to /vacancies/{id}/notes', async () => {
    mockPost.mockResolvedValue({ data: { id: 99, body: 'x', type: 'intake', created_at: '2026-08-04' } })
    const user = userEvent.setup()
    render(<NotesTab vacancy={vacancy()} />)
    await user.click(screen.getByRole('button', { name: 'notes.new' }))
    // Seed fallback (DEFAULT_NOTE_TYPES) renders while /note-types resolves empty —
    // pick a non-default type pill to prove the choice, not just the default, rides along.
    await user.click(screen.getByRole('button', { name: 'Intake' }))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/vacancies/1/notes', expect.objectContaining({ type: 'intake' })))
  })

  it('removes the optimistic note and reports the server message when the save FAILS', async () => {
    mockPost.mockRejectedValue({ response: { status: 422, data: { message: 'Notitie opslaan mislukt' } } })
    const user = userEvent.setup()
    render(<NotesTab vacancy={vacancy()} />)
    await user.click(screen.getByRole('button', { name: 'notes.new' }))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
    expect(notifyError).toHaveBeenCalledWith('Notitie opslaan mislukt')
  })
})
