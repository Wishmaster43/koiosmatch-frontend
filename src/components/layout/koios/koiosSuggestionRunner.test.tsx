/**
 * koiosSuggestionRunner — useRun: a coded refusal (ai_disclosure_missing) reaches the
 * panel as the translated copy, never the server's sentence (ONIX I-001).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRun } from './koiosSuggestionRunner'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn() }) }))

describe('useRun', () => {
  it('shows the translated errors.aiDisclosureMissing text on a coded 422', async () => {
    const setExec = vi.fn()
    const { result } = renderHook(() => useRun(setExec))
    const call = vi.fn().mockRejectedValue({ response: { status: 422, data: { code: 'ai_disclosure_missing', message: 'NL zin' } } })
    await result.current('a1', call, 'executed')
    expect(call).toHaveBeenCalledWith('a1')
    const last = setExec.mock.calls.at(-1)![0]
    expect(last.phase).toBe('error')
    expect(last.message).toBe('errors.aiDisclosureMissing')
  })
})
