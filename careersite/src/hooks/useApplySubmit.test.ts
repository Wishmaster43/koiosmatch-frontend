import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApplySubmit, type ApplyFormValues } from './useApplySubmit'
import { strings } from '../strings'
import * as api from '../api'

// Only the network call is mocked; ApiError stays real so the status check runs for real.
vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return { ...actual, applyToVacancy: vi.fn() }
})

const values = { firstName: 'A', lastName: 'B', email: 'a@b.nl', phone: '1', website: '' } as ApplyFormValues

async function submitWith(error: unknown): Promise<string | null> {
  vi.mocked(api.applyToVacancy).mockRejectedValue(error)
  const { result } = renderHook(() => useApplySubmit('t', 'ref'))
  await act(async () => { await result.current.submit(values) })
  return result.current.errorMessage
}

describe('useApplySubmit errors', () => {
  it('shows the too-large text on a 413', async () => {
    expect(await submitWith(new api.ApiError(413))).toBe(strings.apply.errorTooLarge)
  })
  it('keeps the generic text on other failures', async () => {
    expect(await submitWith(new api.ApiError(500))).toBe(strings.apply.errorGeneric)
  })
})
