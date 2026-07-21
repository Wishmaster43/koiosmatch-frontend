import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DocPreviewModal from './DocPreviewModal'

// The document-types lookup fetch is irrelevant to PDF rendering — avoid a real
// network attempt in jsdom.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrapList: () => ({ rows: [] }),
}))

// `pdfjs-dist` is lazy-loaded inside PdfPreview via a dynamic `import()` — mock it
// so tests never touch the real ~1MB library or its worker. Built with
// `vi.hoisted` because the mock factory (hoisted above imports by Vitest) needs
// to close over these fakes, and tests reconfigure `mockGetDocument` per case.
const { fakeDoc, fakePage, mockGetDocument } = vi.hoisted(() => {
  const fakePage = {
    getViewport: vi.fn(({ scale = 1 }: { scale?: number } = {}) => ({ width: 100 * scale, height: 140 * scale })),
    render: vi.fn(() => ({ promise: Promise.resolve(undefined) })),
  }
  const fakeDoc = {
    numPages: 2,
    getPage: vi.fn(() => Promise.resolve(fakePage)),
    destroy: vi.fn(),
  }
  const mockGetDocument = vi.fn(() => ({ promise: Promise.resolve(fakeDoc) }))
  return { fakeDoc, fakePage, mockGetDocument }
})
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
}))

describe('DocPreviewModal', () => {
  beforeEach(() => {
    // Reset every fake back to its default two-page, error-free behaviour.
    vi.clearAllMocks()
    fakeDoc.numPages = 2
    fakeDoc.getPage = vi.fn(() => Promise.resolve(fakePage))
    fakePage.render = vi.fn(() => ({ promise: Promise.resolve(undefined) }))
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakeDoc) })
    // jsdom has no real canvas 2D context — stub one so the render() path runs.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext
  })

  it('renders the pdf.js canvas preview for a PDF (no iframe)', async () => {
    render(<DocPreviewModal doc={{ name: 'cv.pdf', url: 'blob:http://localhost/abc' }} onClose={() => {}} />)
    // pdf.js opens the doc (2 pages) and paints one <canvas> per page.
    await waitFor(() => expect(document.querySelectorAll('canvas').length).toBe(2))
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('does not render a PDF preview for a non-preview file type (download fallback)', () => {
    render(<DocPreviewModal doc={{ name: 'contract.docx', url: 'blob:http://localhost/xyz' }} onClose={() => {}} />)
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.querySelector('canvas')).toBeNull()
    expect(screen.getByText('documents.previewUnavailable')).toBeInTheDocument()
  })

  it('falls back to the download link when pdf.js fails to render (never a blank frame)', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error('broken pdf')) })
    render(<DocPreviewModal doc={{ name: 'cv.pdf', url: 'blob:http://localhost/abc' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('documents.previewUnavailable')).toBeInTheDocument())
    expect(document.querySelector('canvas')).toBeNull()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('renders nothing when there is no doc', () => {
    const { container } = render(<DocPreviewModal doc={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
