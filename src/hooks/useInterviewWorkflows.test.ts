/**
 * useInterviewWorkflows — verdict finding 4 (MEDIUM, fixed): mirrors
 * useInterviewFlows' hard-won rule (r2 C1) that an INACTIVE value must never
 * be offered for a fresh pick, while a value bound BEFORE it went inactive
 * still resolves (via `describe()`) instead of falling through to a raw id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useInterviewWorkflows } from './useInterviewWorkflows'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const workflows = [
  { id: 'wf-1', name: 'Kelly-Helpende', status: 'active', kind: 'interview', folder: { id: 'f1', name: 'Kelly' } },
  { id: 'wf-2', name: 'Oude flow', status: 'inactive', kind: 'interview', folder: { id: 'f1', name: 'Kelly' } },
]

beforeEach(() => vi.clearAllMocks())

describe('useInterviewWorkflows · active-only options (mirrors useInterviewFlows r2 C1)', () => {
  it('excludes an inactive workflow from the pickable options', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: workflows } } as never)
    const { result } = renderHook(() => useInterviewWorkflows(true), { wrapper })
    await waitFor(() => expect(result.current.options.length).toBe(1))
    expect(result.current.options).toEqual([{ value: 'wf-1', label: 'Kelly · Kelly-Helpende' }])
  })

  it('still resolves the inactive one via describe(), with its label + the inactive flag', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: workflows } } as never)
    const { result } = renderHook(() => useInterviewWorkflows(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.describe('wf-2')).toEqual({ label: 'Kelly · Oude flow', inactive: true })
    // The active one describes as NOT inactive, same shape.
    expect(result.current.describe('wf-1')).toEqual({ label: 'Kelly · Kelly-Helpende', inactive: false })
  })

  it('describe() returns null for an id the fetched list never carried at all', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: workflows } } as never)
    const { result } = renderHook(() => useInterviewWorkflows(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.describe('wf-does-not-exist')).toBeNull()
    expect(result.current.describe(null)).toBeNull()
  })

  it('byId still carries the inactive workflow (options is the only active-filtered view)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: workflows } } as never)
    const { result } = renderHook(() => useInterviewWorkflows(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.byId.get('wf-2')?.name).toBe('Oude flow')
  })
})
