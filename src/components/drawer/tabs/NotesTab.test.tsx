/**
 * NotesTab · search (Danny 03-08: "bij notities wil ik ook een zoekbalk hebben").
 * Added in the SHARED component so every host (candidates/customers/opportunities/
 * applications) gets it at once. Narrows on body text (HTML stripped) + author
 * name; edit still targets the note's ORIGINAL index in the full list after a
 * search narrows what is rendered (openEdit/onEditNote key off that index).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})` }) }))

const labels = {
  notes: 'Notities', newNote: 'Nieuwe notitie', notesEmpty: 'Geen notities',
  searchPlaceholder: 'Zoek notities…', save: 'Save', cancel: 'Cancel', edit: 'Bewerken',
}

const note = (over: Record<string, unknown> = {}) => ({
  type: 'note', title: '', author: 'Eva', text: '<p>Hello world</p>', created_at: '2026-08-01', ...over,
})

describe('NotesTab · search', () => {
  it('shows every note until something is typed', () => {
    render(<NotesTab notes={[note({ text: '<p>Hello world</p>' }), note({ text: '<p>Bye</p>', author: 'Tom' })]}
      labels={labels} showTimeline={false} showConversations={false} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('Bye')).toBeInTheDocument()
  })

  it('narrows on the note BODY text (HTML stripped before matching)', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note({ text: '<p>Hello world</p>' }), note({ text: '<p>Bye</p>', author: 'Tom' })]}
      labels={labels} showTimeline={false} showConversations={false} />)
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'hello')
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByText('Bye')).toBeNull()
  })

  it('narrows on the AUTHOR name', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note({ text: '<p>Hello world</p>', author: 'Eva' }), note({ text: '<p>Bye</p>', author: 'Tom' })]}
      labels={labels} showTimeline={false} showConversations={false} />)
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'tom')
    expect(screen.getByText('Bye')).toBeInTheDocument()
    expect(screen.queryByText('Hello world')).toBeNull()
  })

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={labels} showTimeline={false} showConversations={false} />)
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'zzz-no-match')
    expect(screen.getByText('Geen notities')).toBeInTheDocument()
  })

  it('a filtered note\'s edit pencil still targets its ORIGINAL index in the full list', async () => {
    const user = userEvent.setup()
    const onEditNote = vi.fn()
    render(<NotesTab
      notes={[note({ text: '<p>First</p>', author: 'Eva' }), note({ text: '<p>Second</p>', author: 'Tom' }), note({ text: '<p>Third</p>', author: 'Ann' })]}
      labels={labels} onEditNote={onEditNote} showTimeline={false} showConversations={false} />)
    // Narrow to the THIRD note (original index 2) only.
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'third')
    expect(screen.getByText('Third')).toBeInTheDocument()
    await user.click(screen.getByTitle('Bewerken'))
    // The composer opens pre-filled from onEditNote's own call — assert the INDEX
    // argument, not just that it fired, since that index is what a real host
    // (e.g. CommunicationTab's editUserNote) uses to patch the right record.
    // Triggering the actual save proves which index is bound.
    await user.click(screen.getByTitle('Save'))
    expect(onEditNote).toHaveBeenCalledWith(2, expect.objectContaining({}))
  })
})

// Load-error state (Danny 04-08: retry affordance added HERE, in the shared tab, so
// every host gets it at once — see the four pages/*/drawer/NotesTab.tsx wrappers).
describe('NotesTab · load-error retry', () => {
  it('renders the danger text and a retry button, and calls onRetry on click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<NotesTab error onRetry={onRetry} labels={{ ...labels, loadError: 'Notes could not be loaded.', retry: 'Try again' }} />)
    expect(screen.getByText('Notes could not be loaded.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders only the static text, no button, when onRetry is omitted (back-compat)', () => {
    render(<NotesTab error labels={{ ...labels, loadError: 'Notes could not be loaded.' }} />)
    expect(screen.getByText('Notes could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not render the notes body while in the error state', () => {
    render(<NotesTab error notes={[note()]} labels={{ ...labels, loadError: 'Notes could not be loaded.' }} />)
    expect(screen.queryByText('Hello world')).toBeNull()
  })
})
