/**
 * useNotesTabContent — verifies the hook's handler methods build correct API requests
 * for scoped notes create/edit/delete operations. Note-type vocabulary resolution is
 * NOT part of this hook (DRY round 10, CUSTTABS) — each consumer resolves its own
 * note types, so this hook is tested independently of @/lib/useNoteTypes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotesTabContent } from './useNotesTabContent'

const mockPost = vi.fn().mockResolvedValue({})
const mockPatch = vi.fn().mockResolvedValue({})
const mockDelete = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

vi.mock('@/lib/initials', () => ({ initialsOf: () => 'AB' }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/extractApiError', () => ({ extractApiError: () => 'error' }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Alice Bob' } }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

beforeEach(() => {
  mockPost.mockClear()
  mockPatch.mockClear()
  mockDelete.mockClear()
})

describe('useNotesTabContent', () => {
  it('addNote sends POST with scoped payload fields', () => {
    const reload = vi.fn()
    const { result } = renderHook(() => useNotesTabContent({
      notes: [],
      reload,
      customerId: 'cust1',
      createPayloadFields: { customer_contact_id: 'contact1' },
      apiEndpoint: '/customers/cust1/notes',
    }))

    act(() => {
      result.current.addNote({ type: 'call', title: 'T', body: 'B', language: 'nl' })
    })

    expect(mockPost).toHaveBeenCalledWith('/customers/cust1/notes', {
      type: 'call',
      title: 'T',
      text: 'B',
      language: 'nl',
      customer_contact_id: 'contact1',
    })
  })

  it('editNote sends PATCH with correct ID and without scope fields', () => {
    const reload = vi.fn()
    const note = { id: 'note1', body: 'old' }
    const { result } = renderHook(() => useNotesTabContent({
      notes: [note],
      reload,
      customerId: 'cust1',
      createPayloadFields: { customer_location_id: 'loc1' },
      apiEndpoint: '/customers/cust1/notes',
    }))

    act(() => {
      result.current.editNote(0, { type: 'email', title: 'T2', body: 'B2' })
    })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/notes/note1', {
      type: 'email',
      title: 'T2',
      text: 'B2',
      language: undefined,
    })
  })

  it('deleteNote sends DELETE to the correct endpoint', () => {
    const reload = vi.fn()
    const note = { id: 'note1' }
    const { result } = renderHook(() => useNotesTabContent({
      notes: [note],
      reload,
      customerId: 'cust1',
      createPayloadFields: { customer_contact_id: 'contact1' },
      apiEndpoint: '/customers/cust1/notes',
    }))

    act(() => {
      result.current.deleteNote(0)
    })

    expect(mockDelete).toHaveBeenCalledWith('/customers/cust1/notes/note1')
  })
})
