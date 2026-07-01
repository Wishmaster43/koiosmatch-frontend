import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotesTab from './NotesTab'
import type { ApplicationDetail } from '@/types/application'

// useNoteTypes fetches /note-types on mount → stub the api client.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }))
// Stub useDateFormat so the shared NotesTab doesn't transitively init i18n (t() → keys).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, locale: 'nl-NL' }) }))

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
})
