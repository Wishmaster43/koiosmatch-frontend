/**
 * useEntityDocuments — L8-docs-1: the hook now exposes loading/error alongside
 * docs, so consumers can render the four honest UI states instead of a failed
 * fetch silently reading as "no documents".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useEntityDocuments } from './useEntityDocuments'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// DATETIME-IMPORT-LES: the hook now resolves the active locale via
// @/lib/datetime (useLocale), whose module import drags the real i18n init
// (initReactI18next) along — stub that export too, or the flat mock above
// leaves i18n.use(initReactI18next) undefined and the suite throws on setup.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@/lib/formatters', () => ({ formatFileSizeMb: (bytes: number) => String(Math.round(bytes / 1048576 * 10) / 10), formatNumber: (n: number) => String(n) }))

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { mockGet.mockReset() })

describe('useEntityDocuments · loading/error state', () => {
  it('starts loading, then resolves docs with loading false and error false', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'd1', name: 'contract.pdf' }] } })
    const { result } = renderHook(() => useEntityDocuments('vacancies', 'v1'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.docs).toHaveLength(1)
  })

  it('surfaces error true (and empty docs) on a failed fetch, never a silent empty state', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useEntityDocuments('vacancies', 'v1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.docs).toEqual([])
  })

  it('resets loading/error without fetching when parentId is absent', () => {
    const { result } = renderHook(() => useEntityDocuments('vacancies', undefined))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
    expect(result.current.docs).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })
})
