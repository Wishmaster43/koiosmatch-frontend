/**
 * useLiteTextPopout — patchLiteText asserts the REQUEST (§13): a PATCH to
 * {endpoint}/{id} with the field body, nullOnEmpty coercing an empty string to
 * null (mirrors the per-entity choice the drawer itself makes) versus sending
 * it through as '' when false, and the revert + error toast on a failed PATCH.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { patchLiteText } from './useLiteTextPopout'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { TFunction } from 'i18next'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const t = ((k: string) => k) as unknown as TFunction

beforeEach(() => { vi.clearAllMocks() })

describe('patchLiteText', () => {
  it('PATCHes {endpoint}/{id} with the field body, resolving true on success', async () => {
    mockPatch.mockResolvedValue({})
    const revert = vi.fn()
    const ok = await patchLiteText('/matches', 'm1', 'notes', '<p>hi</p>', t, revert)
    expect(mockPatch).toHaveBeenCalledWith('/matches/m1', { notes: '<p>hi</p>' })
    expect(ok).toBe(true)
    expect(revert).not.toHaveBeenCalled()
  })

  it('sends an empty string as null when nullOnEmpty is true', async () => {
    mockPatch.mockResolvedValue({})
    await patchLiteText('/matches', 'm1', 'notes', '', t, vi.fn(), true)
    expect(mockPatch).toHaveBeenCalledWith('/matches/m1', { notes: null })
  })

  it('sends an empty string through as-is when nullOnEmpty is false', async () => {
    mockPatch.mockResolvedValue({})
    await patchLiteText('/matches', 'm1', 'notes', '', t, vi.fn(), false)
    expect(mockPatch).toHaveBeenCalledWith('/matches/m1', { notes: '' })
  })

  it('reverts and toasts the extracted error on a failed PATCH, resolving false', async () => {
    mockPatch.mockRejectedValue({ response: { data: { message: 'nope' } } })
    const revert = vi.fn()
    const ok = await patchLiteText('/matches', 'm1', 'notes', 'x', t, revert)
    expect(revert).toHaveBeenCalledTimes(1)
    expect(notifyError).toHaveBeenCalledWith('nope')
    expect(ok).toBe(false)
  })
})
