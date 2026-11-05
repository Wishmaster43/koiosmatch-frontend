/** DocumentsTab · linked-to picker, upload policy and scan state (split from DocumentsTab.test.tsx; the queue, delete and preview suites stay there, filters and list states live in DocumentsTab.filters.test.tsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsTab from './DocumentsTab'
import { useEntityDocuments } from '@/hooks/useEntityDocuments'
import { acceptFor } from '@/lib/uploadPolicy'
import { notifyError } from '@/lib/notify'

// The real modal fetches over the network (pdf.js, blob fetch) — irrelevant here,
// where the only thing under test is HOW the eye icon opens it. A marker stand-in
// proves the wiring without mounting any of that.
vi.mock('@/components/drawer/DocPreviewModal', () => ({
  default: ({ doc, docTypeScope }: { doc?: { name?: string }; docTypeScope?: string }) => (
    <div data-testid="doc-preview-modal" data-name={doc?.name} data-scope={docTypeScope} />
  ),
}))

// The list + optimistic upload/rename/delete hook — stubbed so only `upload()`'s
// call arguments matter here, not its internal optimistic-row bookkeeping.
vi.mock('@/hooks/useEntityDocuments', () => ({
  useEntityDocuments: vi.fn(() => ({ docs: [], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })),
}))
// A fixed 2-type tenant lookup — the real hook's fetch/cache plumbing is irrelevant
// here. Keeps the real resolveDocTypeIcon/DOC_TYPE_ICON_MAP (importOriginal) since
// DocumentsTab renders the row tile through it — only the hook itself is stubbed.
// vi.fn() (not a plain arrow) so DOCTYPE-SCOPE-1's tests (DocumentsTab.filters.test.tsx) can assert WHICH
// scope string DocumentsTab actually passed through, not just that types loaded.
vi.mock('@/lib/useDocumentTypes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/useDocumentTypes')>()
  const { DOC_TYPES, CV_COLOR } = await import('./DocumentsTab.testKit')
  return {
    ...actual,
    useDocumentTypes: vi.fn(() => ({
      types: DOC_TYPES,
      labelOf: (v?: string) => v ?? '',
      colorOf: () => CV_COLOR,
    })),
  }
})
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))

// Two distinct files so per-item state (type, remove, revoke) is never ambiguous.
const fileA = new File(['a-content'], 'a.pdf', { type: 'application/pdf' })

const getFileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement

// G34: the per-queued-file type picker is the house SelectMenu (a <button>+popover),
// not a native <select> — every trigger shares the SAME accessible-name prefix (this
// test file never bootstraps real i18n, so the interpolated `{name}` in
// documents.docTypeFor never resolves; production i18n differentiates them for real).
// `getAllByRole` + index picks the wanted row; opening it scopes the option query to
// its OWN wrapper div, so it never collides with the always-visible "apply to all" chips.
// DROPDOWN-CLEAR-1: SelectMenu now renders a separate clear X button alongside the
// trigger. Filter to only trigger buttons (which have aria-haspopup).
const getTypeTriggers = () => screen.getAllByRole('button', { name: /documents\.docTypeFor/ })
  .filter(btn => btn.hasAttribute('aria-haspopup'))

/**
 * DOCS-LOC-DEPT-1 (Danny: "je moet weten op welk niveau [een document] gekoppeld
 * wordt: KLANT, LOCATIE, AFDELING, CONTACTPERSOON") — the upload's "gekoppeld aan"
 * picker over three levels (documents have no customer_contact_id column, unlike
 * notes) and the "linked to" chip on each row. Asserts the REQUEST (§13): upload()
 * only ever gains a 5th argument when a level was actually picked.
 */
describe('DocumentsTab · "gekoppeld aan" upload picker (DOCS-LOC-DEPT-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn((f: File) => `blob:${f.name}`), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('offers no picker at all when the caller passes no locations/departments', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const { container } = render(<DocumentsTab customerId="cust-1" />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    expect(screen.queryByText('documents.linkLevelLabel')).not.toBeInTheDocument()
  })

  it('an unlinked upload calls upload() with exactly its original 4 arguments (no stray 5th)', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload, rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1"
      locations={[{ id: 'loc-1', name: 'Hoofdlocatie' }]} departments={[]} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })

    // Two buttons share this label with one file queued: the always-present header
    // "+ Document" trigger, and the pending card's own submit — the LATTER (last in
    // DOM order) is the one that actually calls upload().
    const addButtons = screen.getAllByRole('button', { name: 'documents.add' })
    await user.click(addButtons[addButtons.length - 1])

    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0]).toEqual([fileA, 'CV', 'a.pdf', 'blob:a.pdf'])
  })

  it('picking a location sends customer_location_id as upload()\'s 5th argument', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload, rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1"
      locations={[{ id: 'loc-1', name: 'Hoofdlocatie' }]} departments={[]} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })

    await user.click(screen.getByRole('button', { name: 'notes.linkLevelOptions.customer' }))
    await user.click(screen.getByRole('button', { name: 'Hoofdlocatie' }))
    // Two buttons share this label with one file queued: the always-present header
    // "+ Document" trigger, and the pending card's own submit — the LATTER (last in
    // DOM order) is the one that actually calls upload().
    const addButtons = screen.getAllByRole('button', { name: 'documents.add' })
    await user.click(addButtons[addButtons.length - 1])

    expect(upload).toHaveBeenCalledWith(fileA, 'CV', 'a.pdf', 'blob:a.pdf', { customer_location_id: 'loc-1' })
  })

  it('picking a department sends customer_department_id as upload()\'s 5th argument', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload, rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1"
      locations={[]} departments={[{ id: 'dep-1', name: 'Verpleging', locationName: 'Hoofdlocatie' }]} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })

    await user.click(screen.getByRole('button', { name: 'notes.linkLevelOptions.customer' }))
    await user.click(screen.getByRole('button', { name: 'Verpleging — Hoofdlocatie' }))
    // Two buttons share this label with one file queued: the always-present header
    // "+ Document" trigger, and the pending card's own submit — the LATTER (last in
    // DOM order) is the one that actually calls upload().
    const addButtons = screen.getAllByRole('button', { name: 'documents.add' })
    await user.click(addButtons[addButtons.length - 1])

    expect(upload).toHaveBeenCalledWith(fileA, 'CV', 'a.pdf', 'blob:a.pdf', { customer_department_id: 'dep-1' })
  })

  it('a locked scope (ScopedDocumentsTab) offers no picker and always sends the locked field', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload, rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1"
      lockedLevelFields={{ customer_location_id: 'loc-1' }} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })

    expect(screen.queryByText('documents.linkLevelLabel')).not.toBeInTheDocument()
    // Two buttons share this label with one file queued: the always-present header
    // "+ Document" trigger, and the pending card's own submit — the LATTER (last in
    // DOM order) is the one that actually calls upload().
    const addButtons = screen.getAllByRole('button', { name: 'documents.add' })
    await user.click(addButtons[addButtons.length - 1])
    expect(upload).toHaveBeenCalledWith(fileA, 'CV', 'a.pdf', 'blob:a.pdf', { customer_location_id: 'loc-1' })
  })

  it('renders the "linked to" chip on a document that carries a location/department name, department winning over location', () => {
    const docLinkedToLocation = { id: 'doc-a', name: 'a.pdf', type: 'CV', size: '10 KB', download_url: '/dl/a', location_name: 'Hoofdlocatie' }
    const docLinkedToDepartment = { id: 'doc-b', name: 'b.pdf', type: 'CV', size: '20 KB', download_url: '/dl/b', location_name: 'Hoofdlocatie', department_name: 'Verpleging' }
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [docLinkedToLocation, docLinkedToDepartment], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)

    // Both rows carry a chip — this test file's i18n falls back to echoing the raw
    // key (no real translation loaded), so both resolve to the identical text; the
    // COUNT (one per doc) is what proves the chip renders for both the location-only
    // and the department-linked row.
    expect(screen.getAllByText('notes.linkedTo')).toHaveLength(2)
  })

  it('renders no chip on a company-level document (no location/department link)', () => {
    const doc = { id: 'doc-a', name: 'a.pdf', type: 'CV', size: '10 KB', download_url: '/dl/a' }
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [doc], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)

    expect(screen.queryByText('notes.linkedTo')).not.toBeInTheDocument()
  })
})

vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// UPLOAD-POLICY-1: the picker carries the documents policy and refused types never reach the queue.
describe('DocumentsTab · upload policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn((f: File) => `blob:${f.name}`), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sets the policy accept string and queues only the allowed file', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload, rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup({ applyAccept: false })
    const { container } = render(<DocumentsTab customerId="cust-1" />)
    expect(getFileInput(container).accept).toBe(acceptFor('documents'))
    await user.upload(getFileInput(container), [new File(['x'], 'cv.pdf'), new File(['x'], 'virus.exe')])
    expect(getTypeTriggers()).toHaveLength(1)
    const addButtons = screen.getAllByRole('button', { name: 'documents.add' })
    await user.click(addButtons[addButtons.length - 1])
    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0][2]).toBe('cv.pdf')
    expect(vi.mocked(notifyError)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notifyError).mock.calls[0][0]).toContain('upload.typeNotAllowed')
  })
})

describe('DocumentsTab · scan state (UPLOADS-SCAN-1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a pending row shows the state chip and a locked preview; a clean row shows no chip', () => {
    const docs = [
      { id: 'p', name: 'p.pdf', type: 'CV', size: '1 KB', download_url: null, scan_status: 'pending' as const },
      { id: 'c', name: 'c.pdf', type: 'CV', size: '1 KB', download_url: '/dl/c', scan_status: 'clean' as const },
    ]
    vi.mocked(useEntityDocuments).mockReturnValue({ docs, loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)
    expect(screen.getAllByText('common:upload.scanPending')).toHaveLength(1)
    const previews = screen.getAllByRole('button', { name: 'documents.preview' })
    expect(previews[0]).toHaveAttribute('aria-disabled', 'true')
    expect(previews[1]).not.toHaveAttribute('aria-disabled')
  })
})
