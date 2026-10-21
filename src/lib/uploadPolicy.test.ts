import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { acceptFor, checkUploadFile, setUploadPolicy, getUploadPolicy, subscribeUploadPolicy, uploadRefusalText, useUploadPolicy } from './uploadPolicy'

const t = ((k: string, o?: Record<string, string>) => `T:${k}:${o ? JSON.stringify(o) : ''}`) as never

afterEach(() => setUploadPolicy(null))

describe('uploadPolicy', () => {
  it('builds the seed accept string per surface', () => {
    expect(acceptFor('import')).toBe('.csv,.txt,.xlsx')
    expect(acceptFor('cv_parse')).toBe('.pdf,.doc,.docx,.jpg,.jpeg,.png')
    expect(acceptFor('documents').split(',')).toHaveLength(12)
  })
  it('lets the server value win per surface and restores the seed on null', () => {
    setUploadPolicy({ documents: { extensions: ['pdf'], mimes: ['application/pdf'] } })
    expect(acceptFor('documents')).toBe('.pdf,application/pdf')
    expect(acceptFor('cv_parse')).toBe('.pdf,.doc,.docx,.jpg,.jpeg,.png')
    setUploadPolicy(null)
    expect(getUploadPolicy().documents.extensions).toContain('docx')
  })
  it('refuses a wrong type listing the allowed set, case-insensitive', () => {
    expect(checkUploadFile('import', { name: 'CV.XLSX', size: 1 })).toEqual({ ok: true })
    expect(checkUploadFile('import', { name: 'a.pdf', size: 1 })).toEqual({ ok: false, reason: 'type', allowed: ['csv', 'txt', 'xlsx'] })
    expect(checkUploadFile('import', { name: 'noext', size: 1 })).toMatchObject({ ok: false, reason: 'type' })
  })
  it('refuses size only when max_bytes is a number', () => {
    expect(checkUploadFile('import', { name: 'a.csv', size: 9e9 })).toEqual({ ok: true })
    setUploadPolicy({ import: { extensions: ['csv'], max_bytes: 100 } })
    expect(checkUploadFile('import', { name: 'a.csv', size: 101 })).toEqual({ ok: false, reason: 'size', maxBytes: 100 })
    expect(checkUploadFile('import', { name: 'a.csv', size: 100 })).toEqual({ ok: true })
  })
  it('notifies subscribers on set and stops after unsubscribe', () => {
    const fn = vi.fn()
    const off = subscribeUploadPolicy(fn)
    setUploadPolicy(null)
    expect(fn).toHaveBeenCalledTimes(1)
    off()
    setUploadPolicy(null)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('renders refusal text with the 422 keys', () => {
    expect(uploadRefusalText({ ok: true }, t)).toBe('')
    expect(uploadRefusalText({ ok: false, reason: 'type', allowed: ['a', 'b'] }, t)).toBe('T:common:upload.typeNotAllowed:{"allowed":"a, b"}')
    expect(uploadRefusalText({ ok: false, reason: 'size', maxBytes: 5 * 1024 * 1024 }, t, 'en-GB')).toBe('T:common:upload.tooLargeMax:{"max":"5"}')
  })
})

describe('useUploadPolicy', () => {
  // The hook follows the store: seed first, then the server value, with a live checker.
  it('re-renders with the server policy and checks against it', () => {
    const { result } = renderHook(() => useUploadPolicy('documents'))
    expect(result.current.accept).toBe(acceptFor('documents'))
    expect(result.current.accept.split(',')).toHaveLength(12)
    act(() => setUploadPolicy({ documents: { extensions: ['pdf'], mimes: ['application/pdf'] } }))
    expect(result.current.accept).toBe('.pdf,application/pdf')
    expect(result.current.check({ name: 'a.docx', size: 1 })).toEqual({ ok: false, reason: 'type', allowed: ['pdf'] })
  })
})
