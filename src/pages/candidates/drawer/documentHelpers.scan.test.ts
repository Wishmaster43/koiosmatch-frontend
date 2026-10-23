// documentHelpers scan state: docScanState and the docUrl rule for non-clean rows.
import { describe, it, expect } from 'vitest'
import { docScanState, docUrl } from './documentHelpers'

// The wire sends null for a non-clean row; the type stays string-only (see DocItem).
const nullUrl = null as unknown as undefined

describe('docScanState / docUrl', () => {
  it('is null for clean and absent status', () => {
    expect(docScanState({ scan_status: 'clean' })).toBeNull()
    expect(docScanState({})).toBeNull()
  })
  it('reports pending and rejected', () => {
    expect(docScanState({ scan_status: 'pending' })).toBe('pending')
    expect(docScanState({ scan_status: 'rejected' })).toBe('rejected')
  })
  it('never falls back to the authenticated url for a non-clean row', () => {
    expect(docUrl({ scan_status: 'pending', download_url: nullUrl, url: '/x' })).toBeUndefined()
    expect(docUrl({ scan_status: 'rejected', url: '/x' })).toBeUndefined()
  })
  it('keeps the existing url order for clean and legacy rows', () => {
    expect(docUrl({ scan_status: 'clean', download_url: '/signed', url: '/x' })).toBe('/signed')
    expect(docUrl({ url: '/x' })).toBe('/x')
    expect(docUrl({ download_url: nullUrl, url: '/x' })).toBe('/x')
  })
})
