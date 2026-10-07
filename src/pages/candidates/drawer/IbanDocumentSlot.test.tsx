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
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { name?: string }) => (o?.name ? `${k}|${o.name}` : k) }) }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
// A plain vi.fn default so individual tests can override the returned types
// (N008-DOC-EXPIRY-FE-1 needs a per-test requiresExpiry type) without touching
// the other cases, which keep this same default list.
type MockDocType = { value: string; label: string; requiresExpiry?: boolean; defaultValidityMonths?: number | null }
const mockUseDocumentTypes = vi.fn((): { types: MockDocType[] } => ({ types: [{ value: 'ID-bewijs', label: 'ID-bewijs' }, { value: 'Bankpas privé', label: 'Bankpas privé' }, { value: 'Overig', label: 'Overig' }] }))
vi.mock('@/lib/useDocumentTypes', () => ({ useDocumentTypes: () => mockUseDocumentTypes() }))
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => <div data-testid="preview-modal" /> }))
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: vi.fn() }))

const docs = [
  { id: 'd1', name: 'bankpas.pdf', url: '/dl/d1' },
  { id: 'd2', name: 'afschrift.pdf', url: '/dl/d2' },
]

describe('IbanDocumentSlot', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    mockUseDocumentTypes.mockReset()
    mockUseDocumentTypes.mockReturnValue({ types: [{ value: 'ID-bewijs', label: 'ID-bewijs' }, { value: 'Bankpas privé', label: 'Bankpas privé' }, { value: 'Overig', label: 'Overig' }] })
  })

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

  // N008-DOC-EXPIRY-FE-1: the server's own 422 reason for expires_at reaches the
  // recruiter instead of a generic "action failed" line.
  it("shows the server's reason when the upload is refused (422 expires_at)", async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: { errors: { expires_at: ['X reason'] } } } })
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={null} onLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /bankDoc\.link/ }))
    const input = screen.getByLabelText('bankDoc.uploadNew', { selector: 'input' })
    await user.upload(input as HTMLInputElement, new File(['x'], 'vog.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText('X reason')).toBeInTheDocument()
  })

  // N008-DOC-EXPIRY-FE-1: a type that requires an expiry sends expires_at on the
  // multipart upload once the recruiter has filled the date field.
  it('sends expires_at when the type requires one', async () => {
    const user = userEvent.setup()
    mockUseDocumentTypes.mockReturnValue({ types: [{ value: 'VOG', label: 'VOG', requiresExpiry: true, defaultValidityMonths: null }] })
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'd9', name: 'vog.pdf' } } })
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={null} onLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /bankDoc\.link/ }))
    // react-datepicker's customInput parses typed text in MM/dd/yyyy (its own
    // locale default) — mirrors PendingUploadQueue.test.tsx's own pattern.
    const dateInput = screen.getByRole('textbox')
    await user.type(dateInput, '01/31/2027')
    const input = screen.getByLabelText('bankDoc.uploadNew', { selector: 'input' })
    await user.upload(input as HTMLInputElement, new File(['x'], 'vog.pdf', { type: 'application/pdf' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect((vi.mocked(api.post).mock.calls[0][1] as FormData).get('expires_at')).toBe('2027-01-31')
  })

  // 07-10 fix: the sr-only expiry label names the type's LABEL, not its (often
  // Dutch slug) value — the mocked type here deliberately differs from its value.
  it('names the expiry field after the type label, not its value', async () => {
    const user = userEvent.setup()
    mockUseDocumentTypes.mockReturnValue({ types: [{ value: 'vog_slug', label: 'VOG certificate', requiresExpiry: true, defaultValidityMonths: null }] })
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={null} onLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /bankDoc\.link/ }))
    expect(screen.getByText('documents.expiryFor|VOG certificate')).toBeInTheDocument()
    expect(screen.queryByText('documents.expiryFor|vog_slug')).toBeNull()
  })

  // 07-10 fix: a rejected upload without a server message falls back to the
  // slot's OWN key, not the generic common:actionFailed.
  it("shows the slot's own upload-failed text when the server sends no message", async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValue(new Error('network down'))
    render(<IbanDocumentSlot candidateId="c1" documents={docs} linkedDocumentId={null} onLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /bankDoc\.link/ }))
    const input = screen.getByLabelText('bankDoc.uploadNew', { selector: 'input' })
    await user.upload(input as HTMLInputElement, new File(['x'], 'vog.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText('bankDoc.uploadFailed')).toBeInTheDocument()
  })
})
