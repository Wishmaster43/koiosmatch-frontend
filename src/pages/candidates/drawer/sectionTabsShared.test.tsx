/**
 * sectionTabsShared.test — F-001: the linked-document download prefers the signed download_url and is
 * disabled (never a live download) for a pending or rejected scan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'

const downloadMock = vi.fn()
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: (...a: unknown[]) => downloadMock(...a) }))

import { DocEntryLinks } from './sectionTabsShared'

describe('DocEntryLinks download', () => {
  beforeEach(() => downloadMock.mockReset())

  it('downloads the signed download_url of a clean row', () => {
    render(<DocEntryLinks doc={{ name: 'a.pdf', url: '/stream/1', download_url: 'https://signed/1' }} onPreview={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Downloaden' }))
    expect(downloadMock).toHaveBeenCalledWith([{ url: 'https://signed/1', name: 'a.pdf' }])
  })

  it.each([['pending', 'Virusscan loopt'], ['rejected', 'Geweigerd door de virusscanner']])('keeps a %s row disabled with its state text', (scan_status, text) => {
    render(<DocEntryLinks doc={{ name: 'a.pdf', url: '/stream/1', download_url: null, scan_status }} onPreview={vi.fn()} />)
    const btn = screen.getByRole('button', { name: text }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(downloadMock).not.toHaveBeenCalled()
  })
})
