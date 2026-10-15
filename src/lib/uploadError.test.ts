import { describe, it, expect } from 'vitest'
import { isPayloadTooLarge, isStorageUnavailable, uploadErrorMessage } from './uploadError'

const t = ((k: string) => `T:${k}`) as never

describe('uploadErrorMessage', () => {
  it('maps a bodiless 413 to the too-large key', () => {
    const err = { response: { status: 413 } }
    expect(isPayloadTooLarge(err)).toBe(true)
    expect(uploadErrorMessage(err, t, 'fb')).toBe('T:common:upload.tooLarge')
  })
  it('maps a 413 with a body to the too-large key as well', () => {
    expect(uploadErrorMessage({ response: { status: 413, data: { message: 'x' } } }, t, 'fb')).toBe('T:common:upload.tooLarge')
  })
  it('keeps the server message of a 422', () => {
    const err = { response: { status: 422, data: { message: 'Bad type' } } }
    expect(isPayloadTooLarge(err)).toBe(false)
    expect(uploadErrorMessage(err, t, 'fb')).toBe('Bad type')
  })
  it('falls back on a network error', () => {
    expect(uploadErrorMessage(new Error('Network Error'), t, 'fb')).toBe('fb')
  })
  // ONIX F-013/F-011 (BE b2cb6be5): the storage disk did not confirm the write or delete.
  it('maps a 503 with code storage_unavailable to the storage key', () => {
    const err = { response: { status: 503, data: { code: 'storage_unavailable', message: 'generic', request_id: 'r-1' } } }
    expect(isStorageUnavailable(err)).toBe(true)
    expect(uploadErrorMessage(err, t, 'fb')).toBe('T:common:upload.storageUnavailable')
  })
  it('keeps the generic path for a 503 without the storage code', () => {
    const err = { response: { status: 503, data: { message: 'Service Unavailable' } } }
    expect(isStorageUnavailable(err)).toBe(false)
    expect(uploadErrorMessage(err, t, 'fb')).toBe('Service Unavailable')
  })
})
