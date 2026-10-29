/**
 * importApi tests — the sample-CSV download falls back to an English file name.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() }, unwrap: (r: unknown) => r }))

import api from '@/lib/api'
import { downloadImportTemplate } from './importApi'

afterEach(() => vi.restoreAllMocks())

describe('downloadImportTemplate', () => {
  it('falls back to an English file name when no Content-Disposition header is sent', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: new Blob(['a']), headers: {} })
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    let downloaded = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download
    })
    await downloadImportTemplate('customers')
    expect(api.get).toHaveBeenCalledWith('/imports/customers/template.csv', { responseType: 'blob' })
    expect(downloaded).toBe('import-example-customers.csv')
  })
})
