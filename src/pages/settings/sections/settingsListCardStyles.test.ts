import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  classifyListLoadPhase, useSettingsListUiState, useSettingsListLoad, runSettingsListCreate,
} from './settingsListCardStyles'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

describe('classifyListLoadPhase', () => {
  it('classifies a 404 as unavailable', () => {
    expect(classifyListLoadPhase({ response: { status: 404 } })).toBe('unavailable')
  })

  it('classifies any other status as a real error', () => {
    expect(classifyListLoadPhase({ response: { status: 500 } })).toBe('error')
  })

  it('classifies a missing response as a real error', () => {
    expect(classifyListLoadPhase(new Error('network'))).toBe('error')
  })
})

describe('useSettingsListUiState', () => {
  it('starts with the calm defaults (nothing expanded/adding/saving, no edit drafts)', () => {
    const { result } = renderHook(() => useSettingsListUiState())
    expect(result.current.expanded).toBeNull()
    expect(result.current.adding).toBe(false)
    expect(result.current.saving).toBeNull()
    expect(result.current.editForms).toEqual({})
  })

  it('toggles adding and tracks the saving id independently', () => {
    const { result } = renderHook(() => useSettingsListUiState())
    act(() => result.current.setAdding(true))
    expect(result.current.adding).toBe(true)
    act(() => result.current.setSaving('new'))
    expect(result.current.saving).toBe('new')
  })
})

beforeEach(() => { vi.clearAllMocks() })

describe('useSettingsListLoad', () => {
  it('applies the fetched rows and flips the phase to ready on resolve', async () => {
    const apply = vi.fn()
    const fetcher = vi.fn().mockResolvedValue(apply)
    const setPhase = vi.fn()
    renderHook(() => useSettingsListLoad(fetcher, setPhase))
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1))
    expect(setPhase).toHaveBeenCalledWith('ready')
  })

  it('classifies a 404 rejection as unavailable via classifyListLoadPhase', async () => {
    const fetcher = vi.fn().mockRejectedValue({ response: { status: 404 } })
    const setPhase = vi.fn()
    renderHook(() => useSettingsListLoad(fetcher, setPhase))
    await waitFor(() => expect(setPhase).toHaveBeenCalledWith('unavailable'))
  })

  it('classifies any other rejection as a real error', async () => {
    const fetcher = vi.fn().mockRejectedValue({ response: { status: 500 } })
    const setPhase = vi.fn()
    renderHook(() => useSettingsListLoad(fetcher, setPhase))
    await waitFor(() => expect(setPhase).toHaveBeenCalledWith('error'))
  })

  it('writes no state after the component unmounts (alive guard)', async () => {
    let resolveFetch!: (apply: () => void) => void
    const fetcher = vi.fn(() => new Promise<() => void>((resolve) => { resolveFetch = resolve }))
    const setPhase = vi.fn()
    const { unmount } = renderHook(() => useSettingsListLoad(fetcher, setPhase))
    unmount()
    resolveFetch(vi.fn())
    await new Promise((r) => setTimeout(r, 0))
    expect(setPhase).not.toHaveBeenCalled()
  })
})

describe('runSettingsListCreate', () => {
  const baseOpts = () => ({
    name: 'New block',
    endpoint: '/vacancy-content-blocks',
    body: { name: 'New block', kind: 'text' },
    setSaving: vi.fn(),
    setList: vi.fn(),
    setNewForm: vi.fn(),
    emptyDraft: vi.fn(() => ({ name: '', kind: 'text' })),
    setAdding: vi.fn(),
    errorMessage: 'Could not create',
  })

  it('POSTs the given body, appends unwrap(res) to the list, resets the draft, and clears saving', async () => {
    mockPost.mockResolvedValue({ data: { data: { id: 'b1', name: 'New block', kind: 'text' } } })
    const opts = baseOpts()
    await runSettingsListCreate(opts)

    expect(mockPost).toHaveBeenCalledWith('/vacancy-content-blocks', { name: 'New block', kind: 'text' })
    expect(opts.setSaving).toHaveBeenNthCalledWith(1, 'new')
    const updater = opts.setList.mock.calls[0][0] as (prev: unknown[]) => unknown[]
    expect(updater([])).toEqual([{ id: 'b1', name: 'New block', kind: 'text' }])
    expect(opts.setNewForm).toHaveBeenCalledWith({ name: '', kind: 'text' })
    expect(opts.setAdding).toHaveBeenCalledWith(false)
    expect(opts.setSaving).toHaveBeenLastCalledWith(null)
  })

  it('does nothing (no POST) when the trimmed name is empty', async () => {
    const opts = baseOpts()
    await runSettingsListCreate({ ...opts, name: '   ' })
    expect(mockPost).not.toHaveBeenCalled()
    expect(opts.setSaving).not.toHaveBeenCalled()
  })

  it('notifies the error message and clears saving on a failed POST, without resetting the draft', async () => {
    mockPost.mockRejectedValue(new Error('network'))
    const opts = baseOpts()
    await runSettingsListCreate(opts)

    expect(notifyError).toHaveBeenCalledWith('Could not create')
    expect(opts.setNewForm).not.toHaveBeenCalled()
    expect(opts.setAdding).not.toHaveBeenCalled()
    expect(opts.setSaving).toHaveBeenLastCalledWith(null)
  })
})
