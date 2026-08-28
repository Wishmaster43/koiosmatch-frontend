/**
 * ScopedNotesTab — pins for the NOTITIE-DOORLINK-1 sub-entity mounts (r2-N3):
 * the scope→route-kind mapping and the sibling render of the linked-notes
 * section (it must survive an own-notes load failure).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import ScopedNotesTab from './ScopedNotesTab'

const feedProps = vi.fn()
vi.mock('@/components/drawer/tabs/notes/NoteFeedList', () => ({
  default: (props: Record<string, unknown>) => { feedProps(props); return createElement('div', null, 'FEED') },
}))
vi.mock('@/components/drawer/tabs/NotesTab', () => ({ default: () => createElement('div', null, 'OWN-NOTES') }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ writableTypes: [], types: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Kelly' } }) }))
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useScopedCustomerNotes: vi.fn(() => ({ notes: [], loading: false, error: false, reload: vi.fn() })),
}))
import { useScopedCustomerNotes } from '../hooks/useCustomerDrawerData'

beforeEach(() => { feedProps.mockClear() })

describe('ScopedNotesTab · linked-notes mount', () => {
  it('maps scope=location to the locations feed kind under the owning customer', () => {
    render(createElement(ScopedNotesTab, { scope: 'location', id: 'loc9', customerId: 'cu1' }))
    expect(feedProps).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'customers', id: 'cu1', sub: { kind: 'locations', id: 'loc9' },
    }))
  })

  it('maps scope=department to the departments feed kind', () => {
    render(createElement(ScopedNotesTab, { scope: 'department', id: 'dep3', customerId: 'cu1' }))
    expect(feedProps).toHaveBeenCalledWith(expect.objectContaining({
      sub: { kind: 'departments', id: 'dep3' },
    }))
  })

  it('renders the linked-notes section even while the own-notes load FAILED (sibling mount)', async () => {
    vi.mocked(useScopedCustomerNotes).mockReturnValueOnce({ notes: [], loading: false, error: true, reload: vi.fn() } as never)
    render(createElement(ScopedNotesTab, { scope: 'location', id: 'loc9', customerId: 'cu1' }))
    await waitFor(() => expect(screen.getByText('FEED')).toBeInTheDocument())
  })

  it('omits the feed without a customerId (no route to build)', () => {
    render(createElement(ScopedNotesTab, { scope: 'location', id: 'loc9' }))
    expect(feedProps).not.toHaveBeenCalled()
  })
})
