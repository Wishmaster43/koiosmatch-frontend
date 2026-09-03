/**
 * useNoteTypesFor — NOTE-TYPE-WIDEN-1 (BUG-NOTE-SCOPE-1, backend
 * CustomerController::addNote/updateNote, koiosmatch-api/app/Http/Controllers/
 * CustomerController.php:459-473). A location note accepts note types scoped to
 * entity in ['customer','location']; a deeper link WIDENS the accepted set, it
 * never narrows it. Commit bdce7008 replaced this widening with a single-entity
 * `useNoteTypes(scope)` fetch, which silently dropped the shallower entity's
 * types (e.g. a customer-seeded 'contract' type vanished from a location note
 * composer, and any historical location note of that type rendered a raw,
 * uncoloured slug). This file pins the fetch (both entity GETs actually fire),
 * the merge order/de-dup, and the label/colour resolution.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { useNoteTypesFor } from './useNoteTypes'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed,
// mirrors useNoteTypes.test.ts's own convention for this module.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// Two entities' seeded rows: 'general' exists on both (must de-dup to the FIRST
// entity's copy), 'conversation'/'contract' only on customer, 'visit'/'issue'
// only on location — mirrors NoteTypeLookupSeeder's real seed shape. `color` is
// an opaque marker string here (not a real hex/token) — the test only proves
// the resolver reads whichever value the row carries, not a design-token match.
const CUSTOMER_ROWS = [
  { value: 'general', label: 'Algemeen', color: 'seed-slate' },
  { value: 'conversation', label: 'Gesprek', color: 'seed-sky' },
  { value: 'contract', label: 'Contract afspraken', color: 'seed-blue' },
]
const LOCATION_ROWS = [
  { value: 'general', label: 'Algemeen (locatie)', color: 'seed-grey' },
  { value: 'visit', label: 'Bezoek', color: 'seed-amber' },
  { value: 'issue', label: 'Incident', color: 'seed-red' },
]

describe('useNoteTypesFor — widening union', () => {
  it('GETs every requested entity — both /note-types?entity=customer and ?entity=location', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url.includes('entity=customer') ? CUSTOMER_ROWS : url.includes('entity=location') ? LOCATION_ROWS : [],
    }))
    renderHook(() => useNoteTypesFor(['customer', 'location']), { wrapper })
    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith('/note-types?entity=customer', expect.anything())
      expect(mockedGet).toHaveBeenCalledWith('/note-types?entity=location', expect.anything())
    })
  })

  it('merges in call order, de-duplicated by value (first entity wins a clash)', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url.includes('entity=customer') ? CUSTOMER_ROWS : url.includes('entity=location') ? LOCATION_ROWS : [],
    }))
    const { result } = renderHook(() => useNoteTypesFor(['customer', 'location']), { wrapper })
    await waitFor(() => expect(result.current.types.map(t => t.value)).toEqual([
      'general', 'conversation', 'contract', 'visit', 'issue',
    ]))
    // 'general' resolves to the CUSTOMER entity's row (first in call order), not location's.
    expect(result.current.types.find(t => t.value === 'general')?.label).toBe('Algemeen')
  })

  it('labelOf/colorOf resolve a shallower entity\'s type (the exact bdce7008 regression: a "contract" note on a location must not render the raw slug)', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url.includes('entity=customer') ? CUSTOMER_ROWS : url.includes('entity=location') ? LOCATION_ROWS : [],
    }))
    const { result } = renderHook(() => useNoteTypesFor(['customer', 'location']), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.labelOf('contract')).toBe('Contract afspraken')
    expect(result.current.colorOf('contract')).toBe('seed-blue')
  })
})
