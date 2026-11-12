// DocumentsSection — F-004 confirm/reject seam: the accept glyph POSTs the confirm route, the delete glyph words a reject.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsSection from './DocumentsSection'
import api from '@/lib/api'
import type { Candidate } from '@/types/candidate'
import { documentTypesSeed } from './DocumentsSection.testKit'

// The confirm POST resolves the fresh row (size in bytes, confirmed_at set).
vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { data: { id: 'd1', confirmed_at: '2026-11-12T10:00:00Z', size: 44856 } } })),
    patch: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    delete: vi.fn(() => Promise.resolve({})),
  },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// Fixed tenant lookup; the real icon map stays.
vi.mock('@/lib/useDocumentTypes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/useDocumentTypes')>()
  return { ...actual, useDocumentTypes: () => documentTypesSeed() }
})
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => null }))
// Full rights: candidates.update (accept glyph) and candidates.documents.manage (delete glyph).
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

// One unconfirmed, scan-clean document on candidate c1.
const unconfirmed = (): Candidate => ({
  id: 'c1',
  documents: [{ id: 'd1', name: 'cv.pdf', type: 'CV', size: '44 KB', url: '/x', confirmed_at: null, scan_status: 'clean' }],
} as unknown as Candidate)

describe('DocumentsSection · F-004 unconfirmed document row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
  })

  it('clicking documents.confirm on an unconfirmed row POSTs the confirm route of that document with no body', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={unconfirmed()} />)
    expect(screen.getByText('documents.unconfirmed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'documents.confirm' }))
    await waitFor(() => expect(screen.queryByText('documents.unconfirmed')).not.toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/candidates/c1/documents/d1/confirm'])
  })

  it('a confirmed sibling row reserves the accept slot while an unconfirmed row exists', () => {
    const c = unconfirmed()
    c.documents = [...(c.documents ?? []), { id: 'd2', name: 'id.pdf', type: 'ID', size: '1 KB', url: '/y', confirmed_at: '2026-11-01T10:00:00Z', scan_status: 'clean' } as never]
    const { container } = render(<DocumentsSection c={c} />)
    expect(screen.getAllByLabelText('documents.confirm')).toHaveLength(1)
    expect(container.querySelectorAll('span[aria-hidden="true"][style*="width: 18px"]')).toHaveLength(1)
  })

  it('the delete glyph of an unconfirmed row opens the dialog with the reject wording', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={unconfirmed()} />)
    await user.click(screen.getByRole('button', { name: 'documents.reject' }))
    expect(screen.getByText('documents.rejectTitle')).toBeInTheDocument()
    expect(screen.queryByText('documents.deleteTitle')).not.toBeInTheDocument()
  })
})
