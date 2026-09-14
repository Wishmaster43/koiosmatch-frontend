import { describe, it, expect, vi, afterEach } from 'vitest'
import { triggerBlobDownload } from './downloadBlob'

// triggerBlobDownload is the shared save-Blob-to-disk trigger (ExportSettings, AdminInvoicesSettings).
describe('triggerBlobDownload', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('creates an object URL, clicks a download anchor with the given filename, then revokes the URL', () => {
    // jsdom has no createObjectURL/revokeObjectURL implementation — stub both.
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake-url')
    URL.revokeObjectURL = vi.fn()
    const createUrl = vi.spyOn(URL, 'createObjectURL')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL')
    const clickSpy = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })

    const blob = new Blob(['x'], { type: 'text/csv' })
    triggerBlobDownload(blob, 'report-2026-01.csv')

    expect(createUrl).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake-url')
  })
})
