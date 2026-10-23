// CvBlock — UPLOADS-SCAN-1: a pending CV shows its state and offers no preview/download; a clean CV is unchanged.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CvBlock from './CvBlock'
import { useCandidateCvDocument } from '../hooks/useCandidateCvDocument'

vi.mock('../hooks/useCandidateCvDocument', () => ({ useCandidateCvDocument: vi.fn() }))
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => <div data-testid="preview-modal" /> }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDateTime: (v: string) => v }) }))

const mockCv = (cv: Record<string, unknown>) =>
  vi.mocked(useCandidateCvDocument).mockReturnValue({ cvDocuments: [cv], loading: false, error: false } as never)

describe('CvBlock · scan state', () => {
  it('pending CV: state chip, locked preview, no download link', () => {
    mockCv({ id: '1', name: 'cv.pdf', download_url: null, url: '/u', scan_status: 'pending' })
    render(<CvBlock candidateId="c1" />)
    expect(screen.getByText('common:upload.scanPending')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'drawer.cv.view' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'drawer.cv.view' })).toHaveStyle({ opacity: '0.5', cursor: 'not-allowed' })
    fireEvent.click(screen.getByRole('button', { name: 'drawer.cv.view' }))
    expect(screen.queryByTestId('preview-modal')).toBeNull()
    expect(screen.queryByRole('link', { name: 'drawer.cv.download' })).toBeNull()
  })

  it('rejected CV shows the rejected text', () => {
    mockCv({ id: '1', name: 'cv.pdf', download_url: null, scan_status: 'rejected' })
    render(<CvBlock candidateId="c1" />)
    expect(screen.getByText('common:upload.scanRejected')).toBeInTheDocument()
  })

  it('clean CV: no chip, download link present', () => {
    mockCv({ id: '1', name: 'cv.pdf', download_url: '/dl', scan_status: 'clean' })
    render(<CvBlock candidateId="c1" />)
    expect(screen.queryByText('common:upload.scanPending')).toBeNull()
    expect(screen.getByRole('link', { name: 'drawer.cv.download' })).toHaveAttribute('href', '/dl')
  })
})
