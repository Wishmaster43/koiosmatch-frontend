import { describe, it, expect } from 'vitest'
import { isPayloadTooLarge, uploadErrorMessage } from './uploadError'

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
})
