/**
 * useDocumentTypes — DOCTYPE-ICON-1 coverage for the new `icon` surface:
 * resolveDocTypeIcon (curated lucide slug → component, safe FileText fallback for
 * unknown/empty/null names) and iconOf (resolving a stored type value/label to its
 * configured icon slug via the seed fallback, mirroring labelOf/colorOf). The
 * shared fetch/cache/dedupe plumbing already has its own coverage in
 * useCachedLookup.test.ts — this file only asserts the new document-type surface.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useDocumentTypes, resolveDocTypeIcon, DOC_TYPE_ICON_NAMES } from './useDocumentTypes'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('resolveDocTypeIcon', () => {
  // Every curated slug (must match the backend DOCTYPE-ICON-1 seed) resolves to a
  // real lucide component, never undefined/throwing.
  it.each(DOC_TYPE_ICON_NAMES)('resolves the curated slug "%s" to a component', (name) => {
    expect(resolveDocTypeIcon(name)).toBeTypeOf('object')
  })

  // Unknown, empty, null or missing names never crash — they fall back to the
  // same FileText component the 'file-text' slug itself resolves to.
  it('falls back to FileText for an unknown, empty, null or missing icon name', () => {
    const fallback = resolveDocTypeIcon('file-text')
    expect(resolveDocTypeIcon('not-a-real-icon')).toBe(fallback)
    expect(resolveDocTypeIcon('')).toBe(fallback)
    expect(resolveDocTypeIcon(null)).toBe(fallback)
    expect(resolveDocTypeIcon(undefined)).toBe(fallback)
  })

  // Case/whitespace-insensitive, mirroring how labelOf/colorOf normalise values.
  it('is case- and whitespace-insensitive', () => {
    expect(resolveDocTypeIcon(' ID-CARD ')).toBe(resolveDocTypeIcon('id-card'))
  })
})

describe('useDocumentTypes — iconOf', () => {
  // The GET never resolves in these tests, so the hook stays on its seed fallback
  // for the whole test (mirrors useNoteTypes.test.ts's "keeps the seed fallback"
  // pattern) — no module-scope cache pollution across tests in this file.
  it('resolves the seed icon for known default document types', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useDocumentTypes())
    expect(result.current.iconOf('CV')).toBe('file-text')
    expect(result.current.iconOf('ID-bewijs')).toBe('id-card')
    expect(result.current.iconOf('Overig')).toBe('file')
  })

  // Matching is case-insensitive and also works by label, mirroring labelOf/colorOf.
  it('matches case-insensitively and by label', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useDocumentTypes())
    expect(result.current.iconOf('cv')).toBe('file-text')
    expect(result.current.iconOf('diploma')).toBe('graduation-cap')
  })

  // An unrecognised or missing value resolves to null — resolveDocTypeIcon (not
  // iconOf) owns the FileText fallback, so callers never need a null-check.
  it('returns null for an unrecognised or missing value', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useDocumentTypes())
    expect(result.current.iconOf('not-a-type')).toBeNull()
    expect(result.current.iconOf(undefined)).toBeNull()
  })
})

// V20b entity scope: the request must carry `?entity=` when a caller passes one,
// and stay exactly as before when it doesn't. Every other test in this file also
// mounts the hook on the bare '/document-types' url (never resolving, so
// useCachedLookup's module-scope inFlight map claims that url for the rest of
// this file's run) — asserting the real GET call here needs a FRESH module
// instance per test (vi.resetModules + dynamic re-import) so these two cache
// entries never collide with the ones above, or with each other.
describe('useDocumentTypes — entity scope (V20b)', () => {
  it('omits the entity param on the base endpoint when no entity is given', async () => {
    vi.resetModules()
    const freshApi = (await import('@/lib/api')).default
    vi.mocked(freshApi.get).mockReturnValue(new Promise(() => {}))
    const { useDocumentTypes: freshUseDocumentTypes } = await import('./useDocumentTypes')

    renderHook(() => freshUseDocumentTypes())

    expect(freshApi.get).toHaveBeenCalledWith('/document-types?active=1', undefined)
  })

  it('bakes ?entity=<x> into the request url when an entity is given', async () => {
    vi.resetModules()
    const freshApi = (await import('@/lib/api')).default
    vi.mocked(freshApi.get).mockReturnValue(new Promise(() => {}))
    const { useDocumentTypes: freshUseDocumentTypes } = await import('./useDocumentTypes')

    renderHook(() => freshUseDocumentTypes('vacancy'))

    expect(freshApi.get).toHaveBeenCalledWith('/document-types?entity=vacancy&active=1', undefined)
  })
})

// N008-DOC-EXPIRY-FE-1: toOption() reads requires_expiry/default_validity_months
// tolerantly — present on the row maps through, absent never crashes and
// defaults to false/null (the BE lane that adds them may land separately).
describe('useDocumentTypes — expiry mapping (N008-DOC-EXPIRY-FE-1)', () => {
  it('maps requires_expiry/default_validity_months onto requiresExpiry/defaultValidityMonths', async () => {
    vi.resetModules()
    const freshApi = (await import('@/lib/api')).default
    vi.mocked(freshApi.get).mockResolvedValue({
      data: { data: [{ id: 1, name: 'VOG', label: 'VOG', requires_expiry: true, default_validity_months: 12 }] },
    })
    const { useDocumentTypes: freshUseDocumentTypes } = await import('./useDocumentTypes')

    // The seed already has its own 'VOG' entry — wait for the FETCHED single-row
    // list to replace it, not for the (trivially-true) seed presence.
    const { result } = renderHook(() => freshUseDocumentTypes())
    await waitFor(() => expect(result.current.types).toHaveLength(1))
    const vog = result.current.types.find((tp: { value: string }) => tp.value === 'VOG')
    expect(vog).toMatchObject({ requiresExpiry: true, defaultValidityMonths: 12 })
  })

  it('defaults to requiresExpiry false / defaultValidityMonths null when the row carries neither field', async () => {
    vi.resetModules()
    const freshApi = (await import('@/lib/api')).default
    vi.mocked(freshApi.get).mockResolvedValue({
      data: { data: [{ id: 2, name: 'CV', label: 'CV' }] },
    })
    const { useDocumentTypes: freshUseDocumentTypes } = await import('./useDocumentTypes')

    const { result } = renderHook(() => freshUseDocumentTypes())
    await waitFor(() => expect(result.current.types).toHaveLength(1))
    const cv = result.current.types.find((tp: { value: string }) => tp.value === 'CV')
    expect(cv).toMatchObject({ requiresExpiry: false, defaultValidityMonths: null })
  })
})
