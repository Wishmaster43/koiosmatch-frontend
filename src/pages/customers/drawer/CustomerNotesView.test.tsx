import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TFunction } from 'i18next'
import CustomerNotesView from './CustomerNotesView'

// Deep-path stub of the shared NotesTab UI helper (never the barrel).
const notesTabProps = vi.fn()
vi.mock('@/components/drawer/tabs/NotesTab', () => ({
  default: (props: Record<string, unknown>) => { notesTabProps(props); return <div data-testid="notes-tab" /> },
}))

const t = ((key: string) => key) as unknown as TFunction

describe('CustomerNotesView', () => {
  it('renders the shared NotesTab with the customer-scoped popout, wiring and resolved labels', () => {
    const addNote = vi.fn()
    render(<CustomerNotesView notes={[]} addNote={addNote} editNote={vi.fn()} deleteNote={vi.fn()}
      customerId="cust-1" noteTypes={[]} chipTypes={[]} authorInitials="JJ" t={t} />)

    expect(screen.getByTestId('notes-tab')).toBeInTheDocument()
    const props = notesTabProps.mock.calls[notesTabProps.mock.calls.length - 1][0]
    expect(props.popout).toEqual({ entity: 'customer', id: 'cust-1' })
    expect(props.authorInitials).toBe('JJ')
    expect(props.showTimeline).toBe(false)
    expect(props.showConversations).toBe(false)
    // The labels object resolves every key through the caller-supplied t() (rule C).
    expect(props.labels.notes).toBe('notes.notes')
    expect(props.labels.deleteConfirm).toBe('notes.deleteConfirm')
    expect(props.labels.notePlaceholder()).toBe('notes.notePlaceholder')
  })

  it('omits the popout link when no customerId is known', () => {
    render(<CustomerNotesView notes={[]} addNote={vi.fn()} editNote={vi.fn()} deleteNote={vi.fn()}
      noteTypes={[]} chipTypes={[]} authorInitials="" t={t} />)

    const props = notesTabProps.mock.calls[notesTabProps.mock.calls.length - 1][0]
    expect(props.popout).toBeUndefined()
  })
})
