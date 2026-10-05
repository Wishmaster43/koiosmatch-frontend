/**
 * useAddTaskSubmit — ONIX N-005: a 422 bag key no form field maps to (a
 * required tenant custom field) must still surface as a banner on createError,
 * never a silent failed submit (the generic path only fires on `else`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useAddTaskSubmit } from './useAddTaskSubmit'
import type { TaskForm } from '../AddTaskModal'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), patch: vi.fn() }, unwrap: (r: { data: { data: unknown } }) => r.data.data }))

afterEach(() => { vi.clearAllMocks() })

const baseForm: TaskForm = {
  type: 'call', title: 'Bel kandidaat', assigneeId: '', status: '', due: '',
  teamId: '', dueTime: '', priority: '', description: '', candidateId: '', customerId: '', contactId: '',
}

// Echoes the key plus its interpolation options, so a banner test can assert
// the FIELD NAME made it through formatUnmappedErrors without a real i18n instance.
const tStub = ((k: string, opts?: Record<string, unknown>) => (opts ? `${k}::${JSON.stringify(opts)}` : k)) as unknown as Parameters<typeof useAddTaskSubmit>[0]['t']

const mountHook = () => renderHook(() => useAddTaskSubmit({
  form: baseForm, otherLinks: [], lookupIds: { type: {}, status: {}, priority: {} },
  loadingLookupIds: false, loadingTask: false, t: tStub,
}))

describe('useAddTaskSubmit · unmapped 422 banner (ONIX N-005)', () => {
  it('sets createError from the unmapped key when no field maps to it', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } },
    })
    const { result } = mountHook()
    await act(async () => { await result.current.handleSubmit() })
    expect(result.current.createError).toContain('vog')
    // ONIX N-005 verifier: only the unrendered dotted key is flagged, no form key.
    expect(result.current.errors).toEqual({ 'custom_fields.vog': true })
  })

  it('still maps a known field key onto errors, without touching createError via that branch', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { errors: { title: ['Required'] } } } })
    const { result } = mountHook()
    await act(async () => { await result.current.handleSubmit() })
    expect(result.current.errors).toEqual({ title: true })
  })
})
