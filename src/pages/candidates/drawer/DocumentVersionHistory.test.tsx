/**
 * DocumentVersionHistory — UPLOADS-SCAN-1: a non-clean superseded version shows its
 * scan state instead of a download link; a clean one keeps the link.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentVersionHistory from './DocumentVersionHistory'
import type { DocVersion } from './DocumentVersionHistory'

vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))

const versions: DocVersion[] = [
  { id: 1, scan_status: 'pending', download_url: '/v/1' },
  { id: 2, scan_status: 'rejected', download_url: '/v/2' },
  { id: 3, scan_status: 'clean', download_url: '/v/3' },
]

describe('DocumentVersionHistory · scan state', () => {
  it('renders nothing without versions', () => {
    const { container } = render(<DocumentVersionHistory versions={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows pending and rejected as text without a link, and keeps the clean download link', async () => {
    render(<DocumentVersionHistory versions={versions} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/common:upload\.scanPending/)).toBeInTheDocument()
    expect(screen.getByText(/common:upload\.scanRejected/)).toBeInTheDocument()
    const links = screen.getAllByLabelText('documents.downloadVersion')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/v/3')
  })
})
