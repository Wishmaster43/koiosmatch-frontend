/**
 * useDocumentTypes — DOCTYPE-ICON-1 coverage for the new `icon` surface:
 * resolveDocTypeIcon (curated lucide slug → component, safe FileText fallback for
 * unknown/empty/null names) and iconOf (resolving a stored type value/label to its
 * configured icon slug via the seed fallback, mirroring labelOf/colorOf). The
 * shared fetch/cache/dedupe plumbing already has its own coverage in
 * useCachedLookup.test.ts — this file only asserts the new document-type surface.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
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
