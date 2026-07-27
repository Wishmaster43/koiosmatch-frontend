import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'
import type { ApplicationDetail } from '@/types/application'

// useNoteTypes fetches /note-types on mount; addNote POSTs → stub both api methods.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn() } }))
// Stub useDateFormat so the shared NotesTab doesn't transitively init i18n (t() → keys).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, locale: 'nl-NL' }) }))
// OPTIMISTIC-REVERT-1 (audit 2026-07-27): mock notify so a failed save's error toast is assertable.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, owner: { id: 'u1', name: 'Bente de Jong', initials: 'BD', color: null }, notes: [], ...over,
} as unknown as ApplicationDetail)

describe('applications NotesTab (shared reuse)', () => {
  it('shows the notes section and the empty state', () => {
    render(<NotesTab application={app()} />)
    expect(screen.getByText('notes.title')).toBeInTheDocument()
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
  })

  it('offers a new-note composer button', () => {
    render(<NotesTab application={app()} />)
    expect(screen.getByText('notes.new')).toBeInTheDocument()
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
    await user.click(screen.getByText('notes.new'))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))
    // The optimistic note was added, then the rejected POST must remove it again —
    // the empty state returns instead of a fake "saved" note staying on screen.
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
    expect(notifyError).toHaveBeenCalledWith('Notitie opslaan mislukt')
  })
})
