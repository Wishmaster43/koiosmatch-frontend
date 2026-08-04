import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    // Deterministic blob-URL stand-ins — jsdom's real createObjectURL cannot be
    // read back, and the tests only need to assert the returned string is used.
    // Patches ONLY the two static methods (never replaces the global URL object
    // wholesale) — PdfPreview's own effect does `new URL(...)` to build the pdf.js
    // worker path, which a full `vi.stubGlobal('URL', {...})` would break (the
    // stand-in object is not a constructor), silently failing every PDF preview.
    URL.createObjectURL = vi.fn(() => 'blob:fetched-object-url')
    URL.revokeObjectURL = vi.fn()
    // The blob fetch itself — BLOB-FETCH FIX: a persisted doc's `url` is fetched
    // as a blob (never navigated to), so the backend's `Content-Disposition:
    // attachment` on that route is irrelevant here.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fetches a PERSISTED doc as a blob (never window.open/navigation) and renders the pdf.js canvas preview', async () => {
    const openSpy = vi.spyOn(window, 'open')
    render(<DocPreviewModal doc={{ name: 'cv.pdf', url: '/api/candidates/1/documents/2/download' }} onClose={() => {}} />)
    // PREVIEW-RELATIVE-URL-1: a relative api url resolves against the API origin
    // (test env: VITE_API_URL is relative → falls back to the frontend origin),
    // never fetched raw — a bare relative fetch was exactly the live 05-08 bug.
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`${window.location.origin}/api/candidates/1/documents/2/download`, { credentials: 'include' }))
    await waitFor(() => expect(document.querySelectorAll('canvas').length).toBe(2))
    expect(document.querySelector('iframe')).toBeNull()
    expect(openSpy).not.toHaveBeenCalled()
    // pdf.js is handed the FETCHED object URL, never the raw authenticated route.
    expect(mockGetDocument).toHaveBeenCalledWith({ url: 'blob:fetched-object-url' })
  })

  it('renders a PENDING (locally queued) file\'s own blob URL directly — no network fetch at all', async () => {
    render(<DocPreviewModal doc={{ name: 'cv.pdf', objectUrl: 'blob:http://localhost/local-abc' }} onClose={() => {}} />)
    await waitFor(() => expect(document.querySelectorAll('canvas').length).toBe(2))
    expect(fetch).not.toHaveBeenCalled()
    expect(mockGetDocument).toHaveBeenCalledWith({ url: 'blob:http://localhost/local-abc' })
  })

  it('renders a persisted IMAGE from its fetched blob URL', async () => {
    render(<DocPreviewModal doc={{ name: 'photo.png', url: '/api/customers/1/documents/2/download' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByAltText('photo.png')).toHaveAttribute('src', 'blob:fetched-object-url'))
  })

  it('does not render a PDF preview for a non-preview file type — no fetch attempted, honest download fallback', () => {
    render(<DocPreviewModal doc={{ name: 'contract.docx', url: '/x', download_url: '/x-signed' }} onClose={() => {}} />)
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.querySelector('canvas')).toBeNull()
    expect(screen.getByText('documents.previewUnavailable')).toBeInTheDocument()
    // Never fetched — this type is never rendered, so there is nothing to fetch for.
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByText('documents.download')).toHaveAttribute('href', '/x-signed')
  })

  it('falls back to the download link when pdf.js fails to render (never a blank frame)', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error('broken pdf')) })
    render(<DocPreviewModal doc={{ name: 'cv.pdf', url: '/x' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('documents.previewUnavailable')).toBeInTheDocument())
    expect(document.querySelector('canvas')).toBeNull()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('falls back to the download link when the blob fetch itself fails (network/auth error)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 403, blob: () => Promise.resolve(new Blob()) })))
    render(<DocPreviewModal doc={{ name: 'cv.pdf', url: '/x', download_url: '/x-signed' }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('documents.previewUnavailable')).toBeInTheDocument())
    expect(document.querySelector('canvas')).toBeNull()
    expect(screen.getByText('documents.download')).toHaveAttribute('href', '/x-signed')
  })

  it('renders nothing when there is no doc', () => {
    const { container } = render(<DocPreviewModal doc={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
