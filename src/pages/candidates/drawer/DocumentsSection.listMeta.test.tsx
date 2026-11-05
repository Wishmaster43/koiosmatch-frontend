// DocumentsSection — list metadata (split from DocumentsSection.test.tsx): expiry, versions, permission gating, type filter menu, upload policy.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsSection from './DocumentsSection'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'
import { acceptFor } from '@/lib/uploadPolicy'
import { documentTypesSeed } from './DocumentsSection.testKit'

// The multipart POST + its response envelope — id present so the optimistic row reconciles.
vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { data: { id: 101 } } })),
    patch: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    delete: vi.fn(() => Promise.resolve({})),
  },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))
// Mocked so the revert-on-failure tests below can assert the exact server
// message surfaced, instead of the real window-event toast.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// A fixed 2-type tenant lookup — the real hook's fetch/cache plumbing is irrelevant
// here. Keeps the real resolveDocTypeIcon/DOC_TYPE_ICON_MAP (importOriginal) since
// DocumentsSection renders the row tile through it — only the hook itself is stubbed.
vi.mock('@/lib/useDocumentTypes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/useDocumentTypes')>()
  return {
    ...actual,
    useDocumentTypes: () => documentTypesSeed(),
  }
})
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))
// Preview modal only ever mounts on click — stub it so its own deps (pdf.js) never load here.
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => null }))
// Point 4: every manage action (upload/rename/replace/delete) gates on
// candidates.documents.manage. DEFAULT here is a manager (matches every
// pre-existing test's assumption of full rights) — the dedicated gating
// describe block below overrides this per-test to prove the OFF path too.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
mockUseAuth.mockReturnValue({ hasPermission: () => true })

// Minimal candidate: only `id` + `documents` matter to this section.
const candidate = (): Candidate => ({ id: 'c1', documents: [] } as unknown as Candidate)


const getFileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement
// DOC-VERSIE-1: the replace input is the single-file one (no `multiple` attr) —
// distinguishes it from the main upload input once both are in the DOM.
const getReplaceFileInput = (container: HTMLElement) => container.querySelector('input[type="file"]:not([multiple])') as HTMLInputElement

// G34: the per-queued-file type picker is the house SelectMenu, not a native
// <select> — every trigger shares the SAME accessible-name prefix (this test file
// never bootstraps real i18n, so the interpolated `{name}` in documents.docTypeFor
// never resolves; production i18n differentiates them for real). Opening a trigger
// scopes the option query to its OWN wrapper div, so it never collides with the
// always-visible "apply to all" chips or another row's picker.
// DROPDOWN-CLEAR-1: SelectMenu now renders a separate clear X button alongside the
// trigger. Filter to only trigger buttons (which have aria-haspopup).
const getTypeTriggers = () => screen.getAllByRole('button', { name: /documents\.docTypeFor/ })
  .filter(btn => btn.hasAttribute('aria-haspopup'))


describe('DocumentsSection · DOC-EXPIRY-1 expiry chip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  const isoDaysFromNow = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  it('shows the DANGER "expired" chip for a document past its expires_at', () => {
    const doc = { id: 'd1', name: 'vog.pdf', type: 'CV', size: '10 KB', url: '/x', expires_at: isoDaysFromNow(-10) }
    render(<DocumentsSection c={{ id: 'c1', documents: [doc] } as unknown as Candidate} />)
    expect(screen.getByText('documents.expiredOn')).toBeInTheDocument()
  })

  it('shows the WARNING "expiring soon" chip for a document inside the 30-day window', () => {
    const doc = { id: 'd1', name: 'vog.pdf', type: 'CV', size: '10 KB', url: '/x', expires_at: isoDaysFromNow(10) }
    render(<DocumentsSection c={{ id: 'c1', documents: [doc] } as unknown as Candidate} />)
    expect(screen.getByText('documents.expiresOn')).toBeInTheDocument()
  })

  it('shows no expiry chip for a document expiring far in the future', () => {
    const doc = { id: 'd1', name: 'vog.pdf', type: 'CV', size: '10 KB', url: '/x', expires_at: isoDaysFromNow(90) }
    render(<DocumentsSection c={{ id: 'c1', documents: [doc] } as unknown as Candidate} />)
    expect(screen.queryByText('documents.expiredOn')).not.toBeInTheDocument()
    expect(screen.queryByText('documents.expiresOn')).not.toBeInTheDocument()
  })

  it('shows no expiry chip when the document carries no expires_at at all', () => {
    const doc = { id: 'd1', name: 'cv.pdf', type: 'CV', size: '10 KB', url: '/x' }
    render(<DocumentsSection c={{ id: 'c1', documents: [doc] } as unknown as Candidate} />)
    expect(screen.queryByText('documents.expiredOn')).not.toBeInTheDocument()
    expect(screen.queryByText('documents.expiresOn')).not.toBeInTheDocument()
  })
})

/**
 * Documents punchlist point 3 (DOC-VERSIE-1): replace swaps the file on the SAME
 * document id via a dedicated multipart POST, and the version history the list
 * response carries per document renders as a collapsible list with its own
 * per-version download link. Asserts the REQUEST (§13), not just a fired callback.
 */
describe('DocumentsSection · DOC-VERSIE-1 replace + version history', () => {
  const uuidDoc = { id: 'a1b2c3d4-uuid', name: 'cv.pdf', type: 'CV', size: '44 KB', url: '/api/candidates/c1/documents/a1b2c3d4-uuid/download' }
  const withDoc = (): Candidate => ({ id: 'c1', documents: [uuidDoc] } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs the replacement file to the per-id /replace route as multipart, keyed on the SAME document id', async () => {
    const replacement = new File(['new-bytes'], 'cv-v2.pdf', { type: 'application/pdf' })
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'a1b2c3d4-uuid', name: 'cv.pdf', type: 'CV', size: 51200, versions: [] } } })
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withDoc()} />)
    await user.click(screen.getByRole('button', { name: 'documents.replace' }))
    fireEvent.change(getReplaceFileInput(container), { target: { files: [replacement] } })

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/candidates/c1/documents/a1b2c3d4-uuid/replace',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ))
    const fd = vi.mocked(api.post).mock.calls[0][1] as FormData
    expect(fd.get('file')).toBe(replacement)
  })

  it('shows the collapsible "N previous versions" list with a per-version download link', async () => {
    const docWithVersions = {
      ...uuidDoc,
      versions: [{ id: 'v1', file_size: 40000, replaced_by_name: 'Jan Jansen', created_at: '2026-07-01T10:00:00Z', download_url: 'https://files.example.test/v1' }],
    }
    const user = userEvent.setup()
    render(<DocumentsSection c={{ id: 'c1', documents: [docWithVersions] } as unknown as Candidate} />)
    await user.click(screen.getByRole('button', { name: 'documents.versionCount' }))
    expect(screen.getByText('Jan Jansen', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'documents.downloadVersion' })).toHaveAttribute('href', 'https://files.example.test/v1')
  })

  it('never shows the version-history toggle for a document with no versions yet', () => {
    render(<DocumentsSection c={withDoc()} />)
    expect(screen.queryByText('documents.versionCount')).not.toBeInTheDocument()
  })
})

/**
 * Documents punchlist point 4: EVERY manage action (upload/rename/replace/delete,
 * single or bulk) gates on candidates.documents.manage; read + download (preview,
 * bulk-download) stay available regardless — never double-gated behind manage.
 */
describe('DocumentsSection · point 4 permission gating (candidates.documents.manage)', () => {
  const uuidDoc = { id: 'a1b2c3d4-uuid', name: 'cv.pdf', type: 'CV', size: '44 KB', url: '/api/candidates/c1/documents/a1b2c3d4-uuid/download', download_url: 'https://files.example.test/dl' }
  const withDoc = (): Candidate => ({ id: 'c1', documents: [uuidDoc] } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    // Restore the file-wide manager default for every OTHER describe block.
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
  })

  it('hides every manage action without the permission, but keeps preview available', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<DocumentsSection c={withDoc()} />)
    expect(screen.queryByRole('button', { name: 'common:add' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common:edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'documents.replace' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common:remove' })).not.toBeInTheDocument()
    // Read stays available regardless — never double-gated behind manage.
    expect(screen.getByRole('button', { name: 'documents.preview' })).toBeInTheDocument()
  })

  it('shows every manage action WITH the permission', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    render(<DocumentsSection c={withDoc()} />)
    expect(screen.getByRole('button', { name: 'common:add' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'documents.replace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:remove' })).toBeInTheDocument()
  })

  it('hides bulk-delete without the permission but keeps bulk-download', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    const user = userEvent.setup()
    render(<DocumentsSection c={withDoc()} />)
    // Row checkbox (index 0 is the header select-all checkbox).
    await user.click(screen.getAllByRole('checkbox')[1])
    expect(screen.getByRole('button', { name: 'documents.downloadSelected' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'documents.deleteSelected' })).not.toBeInTheDocument()
  })
})

/**
 * DOC-TYPE-FILTER-1 / NOTES-DOC-FILTER-MENU-1 (Danny 08-08): the document-type
 * filter moved from an inline dropdown next to search into the shared
 * DrawerFilterMenu popover — filtering BEHAVIOUR is unchanged, only where the
 * control lives changed. No real i18next instance is bootstrapped in this file
 * (matches every other describe block above), so `t()` calls without a
 * `defaultValue` fall back to the raw (possibly namespace-prefixed) key.
 */
describe('DocumentsSection · document-type filter menu (DOC-TYPE-FILTER-1)', () => {
  const cvDoc = { id: 'd1', name: 'cv.pdf', type: 'CV', size: '10 KB', url: '/x' }
  const diplomaDoc = { id: 'd2', name: 'diploma.pdf', type: 'Diploma', size: '10 KB', url: '/x' }
  const withTypedDocs = (): Candidate => ({ id: 'c1', documents: [cvDoc, diplomaDoc] } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('the toolbar no longer renders the type dropdown inline — only ONE Filter button', () => {
    render(<DocumentsSection c={withTypedDocs()} />)
    expect(screen.queryByText('documents.allTypes')).toBeNull()
    // KEY-ECHO: no i18n instance here, so the Filter button is named by its key (its defaultValue is gone, §5 one source per label).
    expect(screen.getByRole('button', { name: 'common:filters.button' })).toBeInTheDocument()
  })

  it('picking a TYPE in the menu narrows the visible documents exactly as the old inline dropdown did', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withTypedDocs()} />)
    expect(screen.getByText('cv.pdf')).toBeInTheDocument()
    expect(screen.getByText('diploma.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common:filters.button' }))
    await user.click(screen.getByRole('button', { name: 'documents.allTypes' }))
    await user.click(screen.getByRole('button', { name: 'CV' }))

    expect(screen.getByText('cv.pdf')).toBeInTheDocument()
    expect(screen.queryByText('diploma.pdf')).toBeNull()
  })

  it('the badge counts the active filter, and clear-all resets it back to "all"', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withTypedDocs()} />)
    await user.click(screen.getByRole('button', { name: 'common:filters.button' }))
    await user.click(screen.getByRole('button', { name: 'documents.allTypes' }))
    await user.click(screen.getByRole('button', { name: 'CV' }))
    expect(screen.queryByText('diploma.pdf')).toBeNull()
    expect(screen.getByText('1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common:filters.clearAll' }))
    expect(screen.getByText('cv.pdf')).toBeInTheDocument()
    expect(screen.getByText('diploma.pdf')).toBeInTheDocument()
    expect(screen.queryByText('1')).toBeNull()
  })

  it('Escape closes the filter panel', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withTypedDocs()} />)
    await user.click(screen.getByRole('button', { name: 'common:filters.button' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// UPLOAD-POLICY-1: both pickers carry the documents policy and refused types never reach the queue.
describe('DocumentsSection · upload policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn((f: File) => `blob:${f.name}`), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sets the policy accept string on the upload and replace inputs', () => {
    const { container } = render(<DocumentsSection c={candidate()} />)
    expect(getFileInput(container).accept).toBe(acceptFor('documents'))
    expect(getReplaceFileInput(container).accept).toBe(acceptFor('documents'))
  })

  it('queues only the allowed file and reports the refusal once', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = render(<DocumentsSection c={candidate()} />)
    await user.upload(getFileInput(container), [new File(['x'], 'cv.pdf'), new File(['x'], 'virus.exe')])
    expect(getTypeTriggers()).toHaveLength(1)
    const addButtons = screen.getAllByRole('button', { name: 'common:add' })
    await user.click(addButtons[addButtons.length - 1])
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notifyError)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notifyError).mock.calls[0][0]).toContain('upload.typeNotAllowed')
  })
})
