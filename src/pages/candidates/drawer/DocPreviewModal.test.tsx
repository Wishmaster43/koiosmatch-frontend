import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocPreviewModal from './DocPreviewModal'

// The document-types lookup fetch is irrelevant to sandboxing — avoid a real
// network attempt in jsdom.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrapList: () => ({ rows: [] }),
}))

describe('DocPreviewModal', () => {
  it('renders the PDF preview iframe (unsandboxed — see AUDIT-3 code comment)', () => {
    render(<DocPreviewModal doc={{ name: 'cv.pdf', url: 'blob:http://localhost/abc' }} onClose={() => {}} />)
    const frame = document.querySelector('iframe')
    expect(frame).not.toBeNull()
    // Measured live (real Chrome, blob: AND http: URLs): ANY `sandbox` value at all —
    // "", "allow-same-origin", and a maximal token set — makes Chrome refuse to load
    // its built-in PDF viewer (broken-doc icon or a blank frame + a SecurityError).
    // Not a flag we got wrong; a sandboxed iframe cannot show this preview in Chrome,
    // so it stays unsandboxed here (no regression vs. before this wave).
    expect(frame?.getAttribute('sandbox')).toBeNull()
  })

  it('does not render an iframe for a non-preview file type (download fallback)', () => {
    render(<DocPreviewModal doc={{ name: 'contract.docx', url: 'blob:http://localhost/xyz' }} onClose={() => {}} />)
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByText('documents.previewUnavailable')).toBeInTheDocument()
  })

  it('renders nothing when there is no doc', () => {
    const { container } = render(<DocPreviewModal doc={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
