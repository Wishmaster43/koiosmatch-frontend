import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'
// NOTE-AUTHOR-SHAPE-2: imported directly (not through the applications wrapper)
// for the ownership-gating tests below — see that describe block's header comment.
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import type { ApplicationDetail } from '@/types/application'

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
// OPTIMISTIC-REVERT-1 (audit 2026-07-27): mock notify so a failed save's error toast is assertable.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// AUTHOR-1 (07-08): useApplicationNotes reads the LOGGED-IN user off useAuth — a
// controllable mock lets the regression test prove the optimistic note credits
// this user, never the application's assigned owner.
const mockUseAuth = vi.fn(() => ({ user: { id: 'u9', name: 'Kelly Recruiter' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, owner: { id: 'u1', name: 'Bente de Jong', initials: 'BD', color: null }, notes: [], ...over,
} as unknown as ApplicationDetail)

describe('applications NotesTab (shared reuse)', () => {
  it('shows the notes section and the empty state', () => {
    render(<NotesTab application={app()} />)
    // The section title is gone (Danny 05-08 — the tab already names the section);
    // the toolbar's search input is the section's stable landmark now.
    expect(screen.getByPlaceholderText('notes.searchPlaceholder')).toBeInTheDocument()
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
  })

  it('offers a new-note composer button', () => {
    render(<NotesTab application={app()} />)
    // Icon-only add trigger (28-07): the label is now its accessible name.
    expect(screen.getByRole('button', { name: 'notes.new' })).toBeInTheDocument()
  })

  it('does not render the drawer-owned timeline/conversations sections here', () => {
    render(<NotesTab application={app()} />)
    // showTimeline/showConversations are false → those section labels are absent.
    expect(screen.queryByText('sections.timeline')).toBeNull()
    expect(screen.queryByText('sections.conversations')).toBeNull()
  })

  // OPTIMISTIC-REVERT-1 (audit 2026-07-27): this used to end in `.catch(() => {})`,
  // silently keeping the optimistic note on screen forever — a recruiter who believes
  // a note was recorded will not write it twice. The failure must remove it again.
  it('removes the optimistic note and reports the server message when the save FAILS', async () => {
    mockPost.mockRejectedValue({ response: { status: 422, data: { message: 'Notitie opslaan mislukt' } } })
    const user = userEvent.setup()
    render(<NotesTab application={app()} />)
    // Icon-only add trigger (28-07): the label is now its accessible name.
    await user.click(screen.getByRole('button', { name: 'notes.new' }))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))
    // The optimistic note was added, then the rejected POST must remove it again —
    // the empty state returns instead of a fake "saved" note staying on screen.
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
    expect(notifyError).toHaveBeenCalledWith('Notitie opslaan mislukt')
  })

  // AUTHOR-1 (07-08): the optimistic note used to credit `application.owner` (the
  // assigned recruiter, "Bente de Jong" here) instead of whoever is actually typing —
  // it must show the LOGGED-IN user instead, and POST the real request body.
  it('credits the optimistic note to the logged-in user, not the application owner', async () => {
    mockPost.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<NotesTab application={app()} />)
    await user.click(screen.getByRole('button', { name: 'notes.new' }))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))

    // The logged-in user's name renders on the note card; the assigned owner's does not.
    await waitFor(() => expect(screen.getByText(/Kelly Recruiter/)).toBeInTheDocument())
    expect(screen.queryByText(/Bente de Jong/)).toBeNull()
    // The real request still goes to the application notes route (§13: assert the REQUEST).
    expect(mockPost).toHaveBeenCalledWith('/applications/1/notes', expect.objectContaining({ type: expect.any(String) }))
  })

  // A-popout-1: the composer's second-screen icon opens the SAME
  // /popout/notes/{entity}/{id} route every other entity's NotesTab uses — assert
  // the actual window.open call (route + entity + id + named window), not just
  // that a handler fired (§13).
  const composerPopOut = () =>
    screen.getByPlaceholderText('notes.placeholder').parentElement!
      .querySelector('button[aria-label="openSecondScreen"]') as HTMLButtonElement | null

  it('the composer pop-out opens /popout/notes/application/{id} in a per-record named window', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    render(<NotesTab application={app({ id: 7 })} />)
    await user.click(screen.getByRole('button', { name: 'notes.new' }))
    await user.click(composerPopOut()!)
    expect(openSpy).toHaveBeenCalledWith('/popout/notes/application/7', 'koios-notes-application-7', expect.any(String))
    openSpy.mockRestore()
  })
})

// NOTE-AUTHOR-SHAPE-2 (verified live 2026-08-07, CMBE 5961c673): a fetched/seeded
// application note now carries a real `author_id` (mapApplication/useApplicationNotes
// thread it through as `authorId`/`author_id`) instead of always dropping the key —
// the precondition the shared NotesTab's canManageNote() rights gate needs to engage
// at all (an absent key stays permissively "not migrated", see that file's RIGHTS
// comment). Exercised against the REAL shared component directly (not through this
// page's `NotesTab` wrapper): applications have no PATCH/DELETE note route yet
// (routes/api/tenant/applications-matches.php: only POST), so the wrapper correctly
// never wires onEditNote/onDeleteNote (§3 no fake affordance) — these tests prove the
// DATA is now gate-ready for the day that route ships, using the note shape this
// lane's fix produces.
describe('note ownership gating — shared NotesTab, key-present path (NOTE-AUTHOR-SHAPE-2)', () => {
  afterEach(() => { mockUseAuth.mockReturnValue({ user: { id: 'u9', name: 'Kelly Recruiter' } }) })

  it("hides edit/delete for another user's note when the viewer lacks notes.manage_all", () => {
    render(
      <SharedNotesTab
        notes={[{ text: 'Note from a colleague', author_id: 'other-user' }]}
        onEditNote={vi.fn()} onDeleteNote={vi.fn()}
        labels={{ edit: 'notes.edit', deleteNote: 'notes.delete' }}
        showTimeline={false} showConversations={false}
      />,
    )
    expect(screen.queryByRole('button', { name: 'notes.edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'notes.delete' })).toBeNull()
  })

  it('still allows managing your OWN note (author_id matches the logged-in user)', () => {
    render(
      <SharedNotesTab
        notes={[{ text: 'My own note', author_id: 'u9' }]}
        onEditNote={vi.fn()} onDeleteNote={vi.fn()}
        labels={{ edit: 'notes.edit', deleteNote: 'notes.delete' }}
        showTimeline={false} showConversations={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'notes.edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notes.delete' })).toBeInTheDocument()
  })

  it("allows managing another user's note once the viewer holds notes.manage_all", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u9', name: 'Kelly Recruiter' },
      hasPermission: (p: string) => p === 'candidates.notes.manage_all',
    } as never)
    render(
      <SharedNotesTab
        notes={[{ text: 'Note from a colleague', author_id: 'other-user' }]}
        onEditNote={vi.fn()} onDeleteNote={vi.fn()}
        labels={{ edit: 'notes.edit', deleteNote: 'notes.delete' }}
        showTimeline={false} showConversations={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'notes.edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notes.delete' })).toBeInTheDocument()
  })
})
