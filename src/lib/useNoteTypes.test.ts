/**
 * useNoteTypes — entity scoping (NOTE-TYPES-2/3 wave 2, Danny 2026-07-20). Every
 * call site now scopes its own owning entity (candidate/application/customer/
 * opportunity/…) so a note type never leaks across entities. Asserting the actual
 * GET request (not just that data loaded) catches a regression that silently drops
 * the `?entity=` scope on either side (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useNoteTypes, DEFAULT_NOTE_TYPES } from './useNoteTypes'
import type { NoteTypeEntity } from './useNoteTypes'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useNoteTypes — entity scoping', () => {
  // The four wave-2 call sites (CommunicationTab, CustomerNotesTab, applications/
  // opportunities NotesTab) each pass their own entity — assert the exact request
  // per variant so a caller that forgets to scope shows up here, not in production.
  it.each<NoteTypeEntity>(['candidate', 'application', 'customer', 'opportunity', 'match', 'task', 'contact'])(
    'GETs /note-types?entity=%s for the %s entity',
    async (entity) => {
      mockedGet.mockResolvedValue({ data: [] })
      renderHook(() => useNoteTypes(entity))
      await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(`/note-types?entity=${entity}`, undefined))
    },
  )

  // Every it.each iteration above resolves an EMPTY list, which useCachedLookup
  // treats as "nothing usable" and never caches (see mapNoteTypes) — so reusing an
  // entity here is still a genuine cache-miss fetch, order-independent.
  it('keeps the seed fallback while the request is pending (fallback behaviour retained)', () => {
    mockedGet.mockReturnValue(new Promise(() => {})) // never resolves in this test
    const { result } = renderHook(() => useNoteTypes('candidate'))
    expect(result.current.types).toEqual(DEFAULT_NOTE_TYPES)
  })
})
