import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerBlobDownload } from './downloadBlob'

// triggerBlobDownload is the shared save-Blob-to-disk trigger (exports, invoices, proposal CV).
describe('triggerBlobDownload', () => {
  const createObjectURL = vi.fn(() => 'blob:fake-url')
  const revokeObjectURL = vi.fn()
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    // jsdom does not navigate; the spy records the clicked anchor as its call context.
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('clicks an anchor with the file name and the object URL of the same blob', () => {
    const blob = new Blob(['x'], { type: 'text/csv' })
    triggerBlobDownload(blob, 'report-2026-01.csv')
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('report-2026-01.csv')
    expect(anchor.getAttribute('href')).toBe('blob:fake-url')
    expect(document.body.contains(anchor)).toBe(false)
  })

  it('defers the revoke: not synchronously, only after the timers advance', () => {
    triggerBlobDownload(new Blob(['x']), 'x.csv')
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
