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
