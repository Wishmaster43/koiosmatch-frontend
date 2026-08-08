/**
 * CustomerNotesPopout — the four UI states (§3): loading skeleton, error+retry,
 * success (header + shared NotesTab), and the document.title bootstrap/restore.
 * Mirrors CandidateNotesPopout.test.tsx's mocking convention.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerNotesPopout from './CustomerNotesPopout'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: new Set() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
vi.mock('./hooks/usePopoutCustomerNotes', () => ({ usePopoutCustomerNotes: () => ({ notes: [], addNote: vi.fn() }) }))

// Mutable per-test customer-lite state (vi.hoisted so the mock factory can read it).
const { liteState } = vi.hoisted(() => ({
  liteState: { customer: null as { id: string; name: string; initials: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useCustomerLite', () => ({ useCustomerLite: () => liteState }))

describe('CustomerNotesPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.customer = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the customer identity loads', () => {
    liteState.loading = true
    render(<CustomerNotesPopout id="cust-1" />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('shows an error row with a working retry when the customer fails to load', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<CustomerNotesPopout id="cust-1" />)
    expect(screen.getByText('popout.loadError')).toBeInTheDocument()
    await user.click(screen.getByText('common:error.retry'))
    expect(liteState.reload).toHaveBeenCalledTimes(1)
  })

  it('renders the customer name + the shared notes surface on success', () => {
    liteState.customer = { id: 'cust-1', name: 'Zorgpartners B.V.', initials: 'ZB' }
    render(<CustomerNotesPopout id="cust-1" />)
    expect(screen.getByText('Zorgpartners B.V.')).toBeInTheDocument()
    // The shared NotesTab's own empty-state copy proves it actually mounted.
    expect(screen.getByText('notes.notesEmpty')).toBeInTheDocument()
  })

  it('sets the window title to the customer popout title and restores it on unmount', () => {
    liteState.customer = { id: 'cust-1', name: 'Zorgpartners B.V.', initials: 'ZB' }
    const { unmount } = render(<CustomerNotesPopout id="cust-1" />)
    expect(document.title).toBe('popout.windowTitle')
    unmount()
    expect(document.title).toBe(previousTitle)
  })
})
