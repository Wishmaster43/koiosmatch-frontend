import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const notifyError = vi.fn()
vi.mock('@/lib/notify', () => ({ notifyError: (m: string) => notifyError(m) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => `${k}|${o?.allowed ?? ''}`, i18n: { language: 'en' } }),
}))

import { useUploadPickFilter } from './useUploadPickFilter'

afterEach(() => notifyError.mockClear())

describe('useUploadPickFilter', () => {
  it('exposes the surface accept string', () => {
    const { result } = renderHook(() => useUploadPickFilter('import'))
    expect(result.current.accept).toBe('.csv,.txt,.xlsx')
  })
  it('keeps allowed files, drops refused ones and reports once per pick', () => {
    const { result } = renderHook(() => useUploadPickFilter('documents'))
    const ok = new File(['x'], 'a.pdf')
    const out = result.current.filterPicked([ok, new File(['x'], 'virus.exe'), new File(['x'], 'b.exe')])
    expect(out).toEqual([ok])
    expect(notifyError).toHaveBeenCalledTimes(1)
    expect(notifyError.mock.calls[0][0]).toContain('common:upload.typeNotAllowed')
  })
  it('stays silent when everything passes', () => {
    const { result } = renderHook(() => useUploadPickFilter('documents'))
    expect(result.current.filterPicked([new File(['x'], 'a.pdf')])).toHaveLength(1)
    expect(notifyError).not.toHaveBeenCalled()
  })
})
