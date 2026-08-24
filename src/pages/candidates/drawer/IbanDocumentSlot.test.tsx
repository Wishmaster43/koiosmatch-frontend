/**
 * IbanDocumentSlot — DOC-BANK-2 seams (§13): the permission-hidden render, the
 * link/change/clear handoffs, and the inline upload's exact multipart request
 * followed by linking the fresh id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IbanDocumentSlot from './IbanDocumentSlot'
import api from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
vi.mock('@/lib/useDocumentTypes', () => ({ useDocumentTypes: () => ({ types: [{ value: 'ID-bewijs', label: 'ID-bewijs' }, { value: 'Bankpas privé', label: 'Bankpas privé' }, { value: 'Overig', label: 'Overig' }] }) }))
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => <div data-testid="preview-modal" /> }))
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: vi.fn() }))

const docs = [
  { id: 'd1', name: 'bankpas.pdf', url: '/dl/d1' },
  { id: 'd2', name: 'afschrift.pdf', url: '/dl/d2' },
]

describe('IbanDocumentSlot', () => {
  beforeEach(() => { vi.mocked(api.post).mockReset() })

  it('renders nothing while the server omitted the field (no financial permission)', () => {
    const { container } = render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={undefined} onLink={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('links an existing document from the picker', async () => {
    const user = userEvent.setup()
    const onLink = vi.fn()
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={null} onLink={onLink} />)
    await user.click(screen.getByRole('button', { name: /bankDoc\.link/ }))
    await user.click(screen.getByRole('button', { name: /bankDoc\.chooseExisting/ }))
    await user.click(await screen.findByText('afschrift.pdf'))
    expect(onLink).toHaveBeenCalledWith('d2')
  })

  it('shows preview, download and the change pencil once linked, and can clear', async () => {
    const user = userEvent.setup()
    const onLink = vi.fn()
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId="d1" onLink={onLink} />)
    expect(screen.getByText('bankpas.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'documents.preview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'documents.download' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'bankDoc.change' }))
    await user.click(screen.getByRole('button', { name: /bankDoc\.clear/ }))
    expect(onLink).toHaveBeenCalledWith(null)
  })

  // The seeded per-slot type wins as upload default — when the tenant lookup
  // actually carries it (else the first type; user can always repick).
  it('defaults the upload type to the preferredType when available', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'd9', name: 'pas.pdf' } } })
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={null} onLink={vi.fn()} preferredType="Bankpas privé" />)
    await user.click(screen.getByRole('button', { name: /bankDoc\.link/ }))
    const input = screen.getByLabelText('bankDoc.uploadNew', { selector: 'input' })
    await user.upload(input as HTMLInputElement, new File(['x'], 'pas.pdf', { type: 'application/pdf' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect((vi.mocked(api.post).mock.calls[0][1] as FormData).get('type')).toBe('Bankpas privé')
  })

  it('uploads inline through the one multipart route and links the fresh id', async () => {
    const user = userEvent.setup()
    const onLink = vi.fn()
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'd9', name: 'nieuw.pdf', url: '/dl/d9' } } })
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={null} onLink={onLink} />)
    await user.click(screen.getByRole('button', { name: /bankDoc\.link/ }))
    const input = screen.getByLabelText('bankDoc.uploadNew', { selector: 'input' })
    await user.upload(input as HTMLInputElement, new File(['x'], 'nieuw.pdf', { type: 'application/pdf' }))
    await waitFor(() => expect(onLink).toHaveBeenCalledWith('d9'))
    const [url, body] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/candidates/c1/documents')
    expect((body as FormData).get('type')).toBe('ID-bewijs')
    expect(((body as FormData).get('file') as File).name).toBe('nieuw.pdf')
  })
})
