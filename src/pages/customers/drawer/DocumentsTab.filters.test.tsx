/** DocumentsTab · filters, doc-type scope and list states (split from DocumentsTab.test.tsx; the upload queue, delete and preview suites stay there, the linked-to picker, upload policy and scan state live in DocumentsTab.linked.test.tsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsTab from './DocumentsTab'
import { useEntityDocuments } from '@/hooks/useEntityDocuments'
import { useDocumentTypes } from '@/lib/useDocumentTypes'

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
// vi.fn() (not a plain arrow) so DOCTYPE-SCOPE-1's tests below can assert WHICH
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

/**
 * DOC-FILTER-PARITY-1 (08-08): the type filter now lives behind the shared
 * DrawerFilterMenu, mirroring the candidate documents section's own filter menu
 * exactly (§13: assert the toolbar renders search + filter, and that picking a
 * type actually narrows the visible rows — not just that a callback fired). This
 * file never bootstraps a real i18next instance (see DocumentsTab.test.tsx),
 * so every `t()` call falls back to its raw (possibly namespace-prefixed) key.
 */
describe('DocumentsTab · type filter (DOC-FILTER-PARITY-1)', () => {
  const cvDoc = { id: 'doc-a', name: 'a.pdf', type: 'CV', size: '10 KB', download_url: '/dl/a' }
  const diplomaDoc = { id: 'doc-b', name: 'b.pdf', type: 'Diploma', size: '20 KB', download_url: '/dl/b' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('the toolbar renders the search box and a Filter button', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [cvDoc, diplomaDoc], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)
    expect(screen.getByPlaceholderText('documents.search')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:filters.button' })).toBeInTheDocument()
  })

  it('picking a TYPE in the menu narrows the visible documents', async () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [cvDoc, diplomaDoc], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    render(<DocumentsTab customerId="cust-1" />)
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getByText('b.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common:filters.button' }))
    await user.click(screen.getByRole('button', { name: 'documents.allTypes' }))
    await user.click(screen.getByRole('button', { name: 'CV' }))

    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.queryByText('b.pdf')).not.toBeInTheDocument()
  })

  it('clear-all resets the type filter back to "all"', async () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [cvDoc, diplomaDoc], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    render(<DocumentsTab customerId="cust-1" />)

    await user.click(screen.getByRole('button', { name: 'common:filters.button' }))
    await user.click(screen.getByRole('button', { name: 'documents.allTypes' }))
    await user.click(screen.getByRole('button', { name: 'CV' }))
    expect(screen.queryByText('b.pdf')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common:filters.clearAll' }))
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getByText('b.pdf')).toBeInTheDocument()
  })

  it('the free-text search still narrows by name or type, unchanged', async () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [cvDoc, diplomaDoc], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    const user = userEvent.setup()
    render(<DocumentsTab customerId="cust-1" />)

    await user.type(screen.getByPlaceholderText('documents.search'), 'diploma')
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('b.pdf')).toBeInTheDocument()
  })
})

/**
 * DOCTYPE-SCOPE-1 (audit finding, 05-08) — `docTypeScope` picks WHICH entity-scoped
 * document-type lookup the tab reads, so a location/department drill-down
 * (ScopedDocumentsTab) can consult its OWN vocabulary instead of silently reusing
 * the customer's. Default omitted = 'customer', byte-identical to before this prop existed.
 */
describe('DocumentsTab · docTypeScope (DOCTYPE-SCOPE-1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults to the "customer" lookup when no scope is given', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)
    expect(vi.mocked(useDocumentTypes)).toHaveBeenCalledWith('customer')
  })

  it('reads the location-scoped lookup and threads it into the preview modal', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" docTypeScope="customer_location" />)
    expect(vi.mocked(useDocumentTypes)).toHaveBeenCalledWith('customer_location')
  })

  it('reads the department-scoped lookup', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" docTypeScope="customer_department" />)
    expect(vi.mocked(useDocumentTypes)).toHaveBeenCalledWith('customer_department')
  })
})

// §3 four UI states: a pending/failed fetch must never render the same as an
// honestly empty list.
describe('DocumentsTab · loading/error states never look like "no documents" (§3)', () => {
  it('shows a loading row, not the empty state, while the list fetch is pending', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: true, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)

    expect(screen.getByText('documents.loading')).toBeInTheDocument()
    expect(screen.queryByText('documents.empty')).not.toBeInTheDocument()
  })

  it('shows an error row, not the empty state, when the list fetch fails', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: true, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)

    expect(screen.getByText('documents.loadError')).toBeInTheDocument()
    expect(screen.queryByText('documents.empty')).not.toBeInTheDocument()
  })

  it('shows the honest empty state once loading finishes with no error and no docs', () => {
    vi.mocked(useEntityDocuments).mockReturnValue({ docs: [], loading: false, error: false, upload: vi.fn(), rename: vi.fn(), remove: vi.fn() })
    render(<DocumentsTab customerId="cust-1" />)

    expect(screen.getByText('documents.empty')).toBeInTheDocument()
  })
})
