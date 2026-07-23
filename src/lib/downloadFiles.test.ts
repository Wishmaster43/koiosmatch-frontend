import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadFilesSequentially } from './downloadFiles'

describe('downloadFilesSequentially', () => {
  let clicks: { href: string; download: string }[]
  let clickSpy: ReturnType<typeof vi.spyOn>

  // Capture each anchor's href/download at the moment it is clicked — jsdom
  // never navigates, so click() is the only observable download trigger.
  beforeEach(() => {
    clicks = []
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download })
    })
  })

  afterEach(() => {
    clickSpy.mockRestore()
    vi.useRealTimers()
  })

  it('creates and clicks an anchor per file with the correct href and download attribute', async () => {
    const count = await downloadFilesSequentially([
      { url: 'https://example.com/a.pdf', name: 'a.pdf' },
      { url: 'https://example.com/b.pdf', name: 'b.pdf' },
    ], 0)
    expect(count).toBe(2)
    expect(clicks).toEqual([
      { href: 'https://example.com/a.pdf', download: 'a.pdf' },
      { href: 'https://example.com/b.pdf', download: 'b.pdf' },
    ])
  })

  it('skips entries without a url and only counts started downloads', async () => {
    const count = await downloadFilesSequentially([
      { url: null, name: 'missing.pdf' },
      { url: 'https://example.com/c.pdf', name: 'c.pdf' },
      { name: 'also-missing.pdf' },
    ], 0)
    expect(count).toBe(1)
    expect(clicks).toEqual([{ href: 'https://example.com/c.pdf', download: 'c.pdf' }])
  })

  it('waits delayMs between downloads but not after the last one', async () => {
    vi.useFakeTimers()
    const promise = downloadFilesSequentially([
      { url: 'https://example.com/a.pdf', name: 'a.pdf' },
      { url: 'https://example.com/b.pdf', name: 'b.pdf' },
    ], 300)
    // The first download fires synchronously, before the first await point.
    expect(clicks).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(299)
    expect(clicks).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(clicks).toHaveLength(2)
    await promise
  })

  it('falls back to an empty download name when the file has no name', async () => {
    await downloadFilesSequentially([{ url: 'https://example.com/no-name.pdf' }], 0)
    expect(clicks).toEqual([{ href: 'https://example.com/no-name.pdf', download: '' }])
  })
})
