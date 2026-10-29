import { describe, it, expect, afterEach } from 'vitest'
import i18n from '@/i18n'
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

// UPLOAD-POLICY-1: the three 422 refusal codes.
describe('uploadErrorMessage 422 codes', () => {
  const tt = ((k: string, o?: Record<string, string>) => `T:${k}:${o ? JSON.stringify(o) : ''}`) as never
  const e = (data: object) => ({ response: { status: 422, data } })
  it('maps file_type_not_allowed with the joined allowed set', () => {
    expect(uploadErrorMessage(e({ code: 'file_type_not_allowed', context: { surface: 'import', allowed: ['csv', 'txt'] } }), tt, 'fb')).toBe('T:common:upload.typeNotAllowed:{"allowed":"csv, txt"}')
  })
  it('maps file_too_large with the formatted ceiling', () => {
    expect(uploadErrorMessage(e({ code: 'file_too_large', context: { max_bytes: 10 * 1024 * 1024 } }), tt, 'fb', 'en-GB')).toBe('T:common:upload.tooLargeMax:{"max":"10"}')
  })
  it('maps file_rejected_by_scanner', () => {
    expect(uploadErrorMessage(e({ code: 'file_rejected_by_scanner' }), tt, 'fb')).toBe('T:common:upload.rejectedByScanner:')
  })
  it('lets an unknown 422 code fall through', () => {
    expect(uploadErrorMessage(e({ code: 'other', message: 'Nope' }), tt, 'fb')).toBe('Nope')
  })
})

// P-014: the size number follows the active language with no locale argument (the callers' path).
describe('uploadErrorMessage · active-language size', () => {
  const tOpts = ((k: string, o?: { max?: string }) => `${k}:${o?.max ?? ''}`) as never
  const err = { response: { status: 422, data: { code: 'file_too_large', context: { max_bytes: 2621440 } } } }
  afterEach(async () => { await i18n.changeLanguage('nl') })
  it('renders 2.5 under English and 2,5 under Dutch', async () => {
    await i18n.changeLanguage('en')
    expect(uploadErrorMessage(err, tOpts, 'fb')).toBe('common:upload.tooLargeMax:2.5')
    await i18n.changeLanguage('nl')
    expect(uploadErrorMessage(err, tOpts, 'fb')).toBe('common:upload.tooLargeMax:2,5')
  })
})
