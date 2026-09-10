/**
 * ScopedNotesTab — pins NOTE-TYPE-WIDEN-1 (BUG-NOTE-SCOPE-1): the component must
 * wire useNoteTypesFor with the WIDENED entity set for its scope, never the bare
 * scope alone — the exact regression commit bdce7008 introduced. The hook's own
 * real fetch/merge/label resolution (both GETs firing, union order, labelOf) is
 * pinned separately in src/lib/useNoteTypes.widen.test.tsx; here we pin the
 * component's WIRING.
 *
 * K-288: the linked-notes feed (NOTITIE-DOORLINK-1) this file used to pin as a
 * sibling mount moved OUT of this component into its own sub-tab on the host
 * (LocationDetail/DepartmentDetail) — that coverage now lives in those files'
 * own test suites.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import ScopedNotesTab from './ScopedNotesTab'

// Stub renders each note's resolved label via chipTypes (mirrors NoteRow's own
// lookup) so a test can assert the WIDENED label shows, not a raw type slug.
vi.mock('@/components/drawer/tabs/NotesTab', () => ({
  default: (props: Record<string, unknown>) => {
    const notes = (props.notes as { type?: string }[]) ?? []
    const chipTypes = (props.chipTypes as { value: string; label: string }[]) ?? []
    return createElement('div', null, 'OWN-NOTES', ...notes.map((n, i) =>
      createElement('span', { key: i }, chipTypes.find(ct => ct.value === n.type)?.label ?? n.type)))
  },
}))
// DRY round 10, CUSTTABS: mock the OTHER note-types hook too — the shared
// useNotesTabContent hook must never fire both requests on one mount.
vi.mock('@/lib/useNoteTypes', () => ({
  useNoteTypesFor: vi.fn(() => ({ writableTypes: [], types: [] })),
  useNoteTypes: vi.fn(() => ({ writableTypes: [], types: [] })),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Kelly' } }) }))
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useScopedCustomerNotes: vi.fn(() => ({ notes: [], loading: false, error: false, reload: vi.fn() })),
}))
import { useScopedCustomerNotes } from '../hooks/useCustomerDrawerData'
import { useNoteTypesFor, useNoteTypes } from '@/lib/useNoteTypes'

beforeEach(() => { vi.mocked(useNoteTypesFor).mockClear(); vi.mocked(useNoteTypes).mockClear() })

describe('ScopedNotesTab · NOTE-TYPE-WIDEN-1 (BUG-NOTE-SCOPE-1)', () => {
  it('scope=location widens useNoteTypesFor to [customer,location], and a historical "contract" note (a customer-level type) renders its resolved label, not the raw slug', () => {
    vi.mocked(useScopedCustomerNotes).mockReturnValueOnce({
      notes: [{ id: 'n1', type: 'contract', text: 'x' }], loading: false, error: false, reload: vi.fn(),
    } as never)
    // Simulates what the widened union (real behaviour pinned in
    // useNoteTypes.widen.test.tsx) resolves to: 'contract' only exists on the
    // CUSTOMER entity, never on 'location' alone.
    vi.mocked(useNoteTypesFor).mockReturnValueOnce({
      writableTypes: [], types: [{ value: 'contract', label: 'Contract afspraken' }],
    } as never)
    render(createElement(ScopedNotesTab, { scope: 'location', id: 'loc9', customerId: 'cu1' }))
    // The component must request the WIDENED set — never the bare scope alone,
    // which is exactly what commit bdce7008 regressed to.
    expect(useNoteTypesFor).toHaveBeenCalledWith(['customer', 'location'])
    expect(screen.getByText('Contract afspraken')).toBeInTheDocument()
    expect(screen.queryByText('contract')).not.toBeInTheDocument()
  })

  it('scope=department widens useNoteTypesFor to [customer,location,department]', () => {
    render(createElement(ScopedNotesTab, { scope: 'department', id: 'dep3', customerId: 'cu1' }))
    expect(useNoteTypesFor).toHaveBeenCalledWith(['customer', 'location', 'department'])
  })
})

describe('ScopedNotesTab · shared useNotesTabContent fires exactly one note-types request (DRY round 10, CUSTTABS)', () => {
  it('calls useNoteTypesFor only, never useNoteTypes', () => {
    render(createElement(ScopedNotesTab, { scope: 'location', id: 'loc9', customerId: 'cu1' }))
    expect(useNoteTypesFor).toHaveBeenCalled()
    expect(useNoteTypes).not.toHaveBeenCalled()
  })
})
