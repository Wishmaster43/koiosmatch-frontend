/**
 * DocumentsTab — multi-file upload queue (BUGFIX 23-07). Mirrors the candidates
 * DocumentsSection fix: picking several files used to collapse to `files?.[0]`.
 * These tests assert the REQUEST (§13) — the hook's `upload()` is called once
 * PER queued file, each with its own type, not just that a callback fired.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsTab from './DocumentsTab'
import { useEntityDocuments } from '@/hooks/useEntityDocuments'

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
/* eslint-disable no-restricted-syntax -- mock fixture DATA, not UI styling */
vi.mock('@/lib/useDocumentTypes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/useDocumentTypes')>()
  return {
    ...actual,
    useDocumentTypes: () => ({
      types: [
        { value: 'CV', label: 'CV', color: '#4F46E5' },
        { value: 'Diploma', label: 'Diploma', color: '#F59E0B' },
      ],
      labelOf: (v?: string) => v ?? '',
      colorOf: () => '#4F46E5',
    }),
  }
})
/* eslint-enable no-restricted-syntax */
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))

// Two distinct files so per-item state (type, remove, revoke) is never ambiguous.
const fileA = new File(['a-content'], 'a.pdf', { type: 'application/pdf' })
const fileB = new File(['b-content'], 'b.pdf', { type: 'application/pdf' })

const getFileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement

describe('DocumentsTab · multi-file upload queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom has no real blob URL support — stub it deterministically per file.
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((f: File) => `blob:${f.name}`),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('queues every picked file (not just the first) and calls upload() once per file on Add', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1" />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    // Two files picked → the summary header shows the count, not a single filename.
    expect(screen.getByText('documents.pendingCount')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'documents.addAll' }))

    // The actual regression check: upload() called TWICE, one per queued file.
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload).toHaveBeenNthCalledWith(1, fileA, 'CV', 'a.pdf', 'blob:a.pdf')
    expect(upload).toHaveBeenNthCalledWith(2, fileB, 'CV', 'b.pdf', 'blob:b.pdf')
  })

  it('calls upload() with each queued file\'s OWN type when a row select is changed', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1" />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    // Change only the second row's type — the first must stay on the default.
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'Diploma')

    await user.click(screen.getByRole('button', { name: 'documents.addAll' }))

    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload).toHaveBeenNthCalledWith(1, fileA, 'CV', 'a.pdf', 'blob:a.pdf')
    expect(upload).toHaveBeenNthCalledWith(2, fileB, 'Diploma', 'b.pdf', 'blob:b.pdf')
  })

  it('apply-to-all chip sets the SAME type on every queued item', async () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1" />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    await user.click(screen.getByRole('button', { name: 'Diploma' }))

    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toHaveValue('Diploma')
    expect(selects[1]).toHaveValue('Diploma')
  })

  it('a per-row remove drops only that item and revokes its own object URL', async () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    const { container } = render(<DocumentsTab customerId="cust-1" />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    const removeButtons = screen.getAllByRole('button', { name: 'common:remove' })
    await user.click(removeButtons[0])

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a.pdf')
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.queryAllByText('a.pdf')).toHaveLength(0)
    // The single remaining item's name now shows twice (summary header + row) — that's fine.
    expect(screen.getAllByText('b.pdf').length).toBeGreaterThan(0)
  })
})

/**
 * Delete confirmation (Danny 23-07): the row X only STAGES the delete — the
 * shared ConfirmDialog (never window.confirm) gates the actual remove() call.
 * Mirrors the candidates DocumentsSection behaviour on the customer entity.
 */
describe('DocumentsTab · delete confirmation', () => {
  const docA = { id: 'doc-a', name: 'a.pdf', type: 'CV', size: '10 KB', download_url: '/dl/a' }
  const docB = { id: 'doc-b', name: 'b.pdf', type: 'CV', size: '20 KB', download_url: '/dl/b' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('single delete: stages then confirms before calling remove()', async () => {
    const remove = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [docA], upload: vi.fn(), rename: vi.fn(), remove })
    const user = userEvent.setup()
    render(<DocumentsTab customerId="cust-1" />)

    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    // The row X only STAGES the delete — the ConfirmDialog gates the actual call.
    expect(remove).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'common:remove' }))
    expect(remove).toHaveBeenCalledWith('doc-a')
  })

  it('cancelling the delete confirmation never calls remove()', async () => {
    const remove = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [docA], upload: vi.fn(), rename: vi.fn(), remove })
    const user = userEvent.setup()
    render(<DocumentsTab customerId="cust-1" />)

    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'cancel' }))
    expect(remove).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bulk delete: selecting both rows and confirming calls remove() for each', async () => {
    const remove = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [docA, docB], upload: vi.fn(), rename: vi.fn(), remove })
    const user = userEvent.setup()
    render(<DocumentsTab customerId="cust-1" />)

    // Tick both row checkboxes (the header select-all checkbox is index 0).
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(checkboxes[2])

    await user.click(screen.getByRole('button', { name: 'documents.deleteSelected' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'common:remove' }))

    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith('doc-a')
    expect(remove).toHaveBeenCalledWith('doc-b')
  })
})

/**
 * Preview fix (Danny 03-08: "Preview van documenten is downloaden i.p.v.
 * preview???"). Root cause was measured at DocumentsTab.tsx:110 — `preview()` did
 * `window.open(download_url)`, a real navigation to a route the backend answers
 * with `Content-Disposition: attachment`, so the browser downloaded the file
 * instead of showing it. These tests prove the eye icon now opens the shared
 * DocPreviewModal in-dialog and never calls window.open.
 */
describe('DocumentsTab · preview opens the shared modal, never window.open', () => {
  const doc = { id: 'doc-a', name: 'a.pdf', type: 'CV', size: '10 KB', download_url: '/dl/a', url: '/api/customers/1/documents/doc-a/download' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('does not render the modal until the eye icon is clicked', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [doc], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)
    expect(screen.queryByTestId('doc-preview-modal')).not.toBeInTheDocument()
  })

  it('clicking the eye icon opens DocPreviewModal (scoped to "customer") instead of calling window.open', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [doc], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    render(<DocumentsTab customerId="cust-1" />)

    await user.click(screen.getByRole('button', { name: 'documents.preview' }))

    expect(openSpy).not.toHaveBeenCalled()
    const modal = screen.getByTestId('doc-preview-modal')
    expect(modal).toHaveAttribute('data-name', 'a.pdf')
    expect(modal).toHaveAttribute('data-scope', 'customer')
  })
})

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
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const { container } = render(<DocumentsTab customerId="cust-1" />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    expect(screen.queryByText('documents.linkLevelLabel')).not.toBeInTheDocument()
  })

  it('an unlinked upload calls upload() with exactly its original 4 arguments (no stray 5th)', async () => {
    const upload = vi.fn()
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
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
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
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
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
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
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], upload, rename: vi.fn(), remove: vi.fn() })
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
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [docLinkedToLocation, docLinkedToDepartment], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)

    // Both rows carry a chip — this test file's i18n falls back to echoing the raw
    // key (no real translation loaded), so both resolve to the identical text; the
    // COUNT (one per doc) is what proves the chip renders for both the location-only
    // and the department-linked row.
    expect(screen.getAllByText('notes.linkedTo')).toHaveLength(2)
  })

  it('renders no chip on a company-level document (no location/department link)', () => {
    const doc = { id: 'doc-a', name: 'a.pdf', type: 'CV', size: '10 KB', download_url: '/dl/a' }
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [doc], upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)

    expect(screen.queryByText('notes.linkedTo')).not.toBeInTheDocument()
  })
})
