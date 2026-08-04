/**
 * VacancyLookupsContext — DEFAULTS-1 (V11/V19): the seniority/education lookups
 * carry the backend's `is_default` singleton, and the context resolves it into
 * `defaultSeniority` / `defaultEducation`.
 *
 * The regression this guards: normalize() used to keep only value/label/color and
 * DROPPED is_default, so the Settings default-toggle was decoration — no consumer
 * could ever read the tenant's choice.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { VacancyLookupsProvider, useVacancyLookups } from './VacancyLookupsContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

const mockedGet = vi.mocked(api.get)

// Answer each lookup endpoint from one map; anything unlisted resolves empty (→ seed).
function mockLookups(byUrl: Record<string, unknown[]>) {
  mockedGet.mockImplementation((url: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the axios response envelope
    Promise.resolve({ data: byUrl[url] ?? [] } as any))
}

const wrapper = ({ children }: { children: ReactNode }) => <VacancyLookupsProvider>{children}</VacancyLookupsProvider>

afterEach(() => vi.clearAllMocks())

describe('VacancyLookupsContext defaults', () => {
  it('carries is_default through and resolves the flagged seniority + education', async () => {
    mockLookups({
      '/vacancy-seniority-levels': [
        { id: 's1', name: 'Starter', is_default: false },
        { id: 's2', name: 'Medior', is_default: true },
      ],
      '/vacancy-education-levels': [
        { id: 'e1', name: 'MBO', is_default: true },
        { id: 'e2', name: 'HBO', is_default: false },
      ],
    })
    const { result } = renderHook(() => useVacancyLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.seniorityLevels.map(s => s.is_default)).toEqual([false, true])
    expect(result.current.defaultSeniority).toBe('s2')
    expect(result.current.defaultEducation).toBe('e1')
  })

  it('accepts the tinyint/string shapes Laravel may serialise the flag as', async () => {
    mockLookups({ '/vacancy-seniority-levels': [{ id: 's1', name: 'Starter' }, { id: 's2', name: 'Senior', is_default: 1 }] })
    const { result } = renderHook(() => useVacancyLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.defaultSeniority).toBe('s2')
  })

  it('proposes nothing when the tenant flagged no default (no index-0 guess)', async () => {
    mockLookups({
      '/vacancy-seniority-levels': [{ id: 's1', name: 'Starter' }, { id: 's2', name: 'Senior' }],
      '/vacancy-education-levels': [{ id: 'e1', name: 'MBO' }],
    })
    const { result } = renderHook(() => useVacancyLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.defaultSeniority).toBe('')
    expect(result.current.defaultEducation).toBe('')
  })
})

/**
 * CHANNEL-FLAGS-1 (round-4 audit finding #3) — normalize() used to keep only
 * value/label/color/is_default and DROPPED active/default_enabled, so
 * PublishingTab had no way to hide a deactivated channel or pre-check the
 * tenant's default ones on a new vacancy.
 */
describe('VacancyLookupsContext channel flags', () => {
  it('carries active/default_enabled through, and default_enabled tolerates the tinyint shape', async () => {
    mockLookups({
      '/vacancy-channels': [
        { id: 'c1', name: 'Career page', active: true, default_enabled: true },
        { id: 'c2', name: 'Indeed', active: true, default_enabled: 0 },
      ],
    })
    const { result } = renderHook(() => useVacancyLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.channels.map(c => ({ value: c.value, default_enabled: c.default_enabled }))).toEqual([
      { value: 'c1', default_enabled: true },
      { value: 'c2', default_enabled: false },
    ])
  })

  it('drops a deactivated channel from the list entirely (sortActiveRows filters it before mapping)', async () => {
    mockLookups({
      '/vacancy-channels': [
        { id: 'c1', name: 'Career page', active: true },
        { id: 'c2', name: 'Old board', active: false },
      ],
    })
    const { result } = renderHook(() => useVacancyLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.channels.map(c => c.value)).toEqual(['c1'])
  })
})
