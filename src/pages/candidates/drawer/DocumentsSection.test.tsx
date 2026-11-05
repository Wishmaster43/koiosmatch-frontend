/**
 * DocumentsSection — multi-file upload queue (BUGFIX 23-07). Proves the actual
 * bug: picking several files used to collapse to `files?.[0]`, silently dropping
 * everything else. These tests assert the REQUEST (§13) — every queued file gets
 * its own POST with its own `type`, not just that a callback fired.
 *
 * G34: the per-row type picker and the "Koppelen aan" link picker are the house
 * SelectMenu (a <button>+popover), not native <select>s — every mutation
 * ASSERTION below (api.post/api.patch route + body) is unchanged; only the
 * interaction that reaches it (click-open + click-option, instead of
 * `user.selectOptions`) is updated. Mirrors customers/drawer/DocumentsTab.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsSection from './DocumentsSection'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'
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

// Two distinct files so per-item state (type, remove, revoke) is never ambiguous.
const fileA = new File(['a-content'], 'a.pdf', { type: 'application/pdf' })
const fileB = new File(['b-content'], 'b.pdf', { type: 'application/pdf' })

const getFileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement

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
// PORTAL-MARKER-1: the open menu is PORTALLED into document.body now — scope the
// option query to the one open portal menu (only one exists at a time), which
// keeps the original intent: never collide with in-page chips or other rows.
const openPortalMenu = () => document.querySelector('[data-dropdown-portal]') as HTMLElement
const pickRowType = async (user: ReturnType<typeof userEvent.setup>, rowIndex: number, label: string) => {
  await user.click(getTypeTriggers()[rowIndex])
  await user.click(await within(openPortalMenu()).findByRole('button', { name: label }))
}


describe('DocumentsSection · multi-file upload queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom has no real blob URL support — stub it deterministically per file.
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((f: File) => `blob:${f.name}`),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('queues every picked file (not just the first) and uploads all of them on Add', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={candidate()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    // Two files picked → the summary header shows the count, not a single filename.
    expect(screen.getByText('documents.pendingCount')).toBeInTheDocument()
    expect(getTypeTriggers()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'documents.addAll' }))

    // The actual regression check: TWO POSTs, one per queued file, both defaulted to 'CV'.
    expect(api.post).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(api.post).mock.calls
    expect(calls.map(([url]) => url)).toEqual(['/candidates/c1/documents', '/candidates/c1/documents'])
    const sent = calls.map(([, fd]) => ({ name: (fd as FormData).get('name'), type: (fd as FormData).get('type') }))
    expect(sent).toEqual(expect.arrayContaining([
      { name: 'a.pdf', type: 'CV' },
      { name: 'b.pdf', type: 'CV' },
    ]))
  })

  it('is no longer a native <select> — the per-row type picker is the house SelectMenu', () => {
    const { container } = render(<DocumentsSection c={candidate()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })
    expect(container.querySelector('select')).toBeNull()
  })

  it('uploads each queued file with its OWN type when a row\'s type picker is changed', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={candidate()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    // Change only the second row's type — the first must stay on the default.
    await pickRowType(user, 1, 'Diploma')

    await user.click(screen.getByRole('button', { name: 'documents.addAll' }))

    expect(api.post).toHaveBeenCalledTimes(2)
    const types = vi.mocked(api.post).mock.calls.map(([, fd]) => (fd as FormData).get('type'))
    expect(types).toEqual(['CV', 'Diploma'])
  })

  it('apply-to-all chip sets the SAME type on every queued item', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={candidate()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    await user.click(screen.getByRole('button', { name: 'Diploma' }))

    const triggers = getTypeTriggers()
    expect(triggers[0]).toHaveTextContent('Diploma')
    expect(triggers[1]).toHaveTextContent('Diploma')
  })

  it('a per-row remove drops only that item and revokes its own object URL', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={candidate()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    const removeButtons = screen.getAllByRole('button', { name: 'common:remove' })
    await user.click(removeButtons[0])

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a.pdf')
    expect(getTypeTriggers()).toHaveLength(1)
    expect(screen.queryAllByText('a.pdf')).toHaveLength(0)
    // The single remaining item's name now shows twice (summary header + row) — that's fine.
    expect(screen.getAllByText('b.pdf').length).toBeGreaterThan(0)
  })
})

/**
 * Regression (BUGFIX 23-07, Danny: "naam wijzigen maakt document onbruikbaar???"):
 * CandidateDocument ids are UUID STRINGS, but the old guard only persisted
 * rename/delete for positive NUMERIC ids — so neither ever reached the server
 * and every change silently reverted on reload. These assert the REQUEST (§13).
 */
describe('DocumentsSection · rename/delete persist for UUID server docs', () => {
  const uuidDoc = { id: 'a1b2c3d4-uuid', name: 'cv.pdf', type: 'CV', size: '44 KB', url: '/api/candidates/c1/documents/a1b2c3d4-uuid/download' }
  const withDoc = (): Candidate => ({ id: 'c1', documents: [uuidDoc] } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('rename PATCHes the per-id route for a UUID doc (extension preserved)', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDoc()} />)
    await user.click(screen.getByRole('button', { name: 'common:edit' }))
    const input = screen.getByDisplayValue('cv')
    await user.clear(input)
    await user.type(input, 'cv-nieuw{Enter}')
    expect(api.patch).toHaveBeenCalledWith('/candidates/c1/documents/a1b2c3d4-uuid', { name: 'cv-nieuw.pdf' })
  })

  it('delete asks for confirmation, then DELETEs the per-id route for a UUID doc (Danny 23-07)', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDoc()} />)
    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    // The row X only STAGES the delete — the ConfirmDialog gates the actual request.
    expect(api.delete).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'common:remove' }))
    expect(api.delete).toHaveBeenCalledWith('/candidates/c1/documents/a1b2c3d4-uuid')
  })

  it('cancelling the delete confirmation never fires a request', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDoc()} />)
    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'cancel' }))
    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('cv.pdf')).toBeInTheDocument()
  })

  it('a temp (negative numeric) optimistic id still never fires a server call', async () => {
    const user = userEvent.setup()
    const tempDoc = { id: -1753280000000, name: 'pending.pdf', type: 'CV', objectUrl: 'blob:pending.pdf' }
    render(<DocumentsSection c={{ id: 'c1', documents: [tempDoc] } as unknown as Candidate} />)
    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'common:remove' }))
    expect(api.delete).not.toHaveBeenCalled()
  })
})

/**
 * Bulk delete (Danny 23-07): the checkbox selection's delete action goes through
 * the SAME shared ConfirmDialog — never a native confirm(). Asserts the REQUEST:
 * one DELETE per selected, persisted doc, and the rows drop from the list.
 */
describe('DocumentsSection · bulk delete', () => {
  const docA = { id: 'uuid-a', name: 'a.pdf', type: 'CV', size: '10 KB', url: '/api/candidates/c1/documents/uuid-a/download' }
  const docB = { id: 'uuid-b', name: 'b.pdf', type: 'CV', size: '20 KB', url: '/api/candidates/c1/documents/uuid-b/download' }
  const withDocs = (): Candidate => ({ id: 'c1', documents: [docA, docB] } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('selecting both rows and confirming deletes both via their per-id routes', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDocs()} />)

    // Tick both row checkboxes (the header select-all checkbox is index 0).
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(checkboxes[2])

    await user.click(screen.getByRole('button', { name: 'documents.deleteSelected' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'common:remove' }))

    expect(api.delete).toHaveBeenCalledTimes(2)
    expect(api.delete).toHaveBeenCalledWith('/candidates/c1/documents/uuid-a')
    expect(api.delete).toHaveBeenCalledWith('/candidates/c1/documents/uuid-b')
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument()
    expect(screen.queryByText('b.pdf')).not.toBeInTheDocument()
  })
})

/**
 * BUG CLASS FIX regression coverage (this audit wave): a failed rename PATCH
 * used to only toast while the new name stayed in the list forever — the user
 * believes the rename saved until a reload brings the old name back. Asserts
 * the SEAM (§13): the request still fires, but a REJECTED request puts the
 * exact old name back, and a resolved one keeps the new one.
 */
describe('DocumentsSection · rename reverts the name on a FAILED PATCH', () => {
  const uuidDoc = { id: 'a1b2c3d4-uuid', name: 'cv.pdf', type: 'CV', size: '44 KB', url: '/api/candidates/c1/documents/a1b2c3d4-uuid/download' }
  const withDoc = (): Candidate => ({ id: 'c1', documents: [uuidDoc] } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the new name once the PATCH resolves', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDoc()} />)
    await user.click(screen.getByRole('button', { name: 'common:edit' }))
    const input = screen.getByDisplayValue('cv')
    await user.clear(input)
    await user.type(input, 'cv-nieuw{Enter}')
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    expect(screen.getByText('cv-nieuw.pdf')).toBeInTheDocument()
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('puts the OLD name back when the PATCH is REJECTED, and surfaces the server message', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: 'Naam bestaat al' } } })
    const user = userEvent.setup()
    render(<DocumentsSection c={withDoc()} />)
    await user.click(screen.getByRole('button', { name: 'common:edit' }))
    const input = screen.getByDisplayValue('cv')
    await user.clear(input)
    await user.type(input, 'cv-nieuw{Enter}')
    // The rejected PATCH reverts the optimistic name — never leave the unsaved
    // name showing (the mocked rejection can already settle by the time
    // user.type resolves, so this only asserts the settled end state).
    await waitFor(() => expect(screen.getByText('cv.pdf')).toBeInTheDocument())
    expect(screen.queryByText('cv-nieuw.pdf')).not.toBeInTheDocument()
    expect(notifyError).toHaveBeenCalledWith('Naam bestaat al')
  })
})

/**
 * BUG CLASS FIX regression coverage (this audit wave): a failed delete used to
 * only toast while the row stayed gone — the user believes the document was
 * removed. Asserts the SEAM (§13): the request still fires, but a REJECTED
 * request puts the row back.
 */
describe('DocumentsSection · delete puts the row back on a FAILED request', () => {
  const uuidDoc = { id: 'a1b2c3d4-uuid', name: 'cv.pdf', type: 'CV', size: '44 KB', url: '/api/candidates/c1/documents/a1b2c3d4-uuid/download' }
  const withDoc = (): Candidate => ({ id: 'c1', documents: [uuidDoc] } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('puts the row back when the DELETE is REJECTED, and surfaces the server message', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { data: { message: 'Verwijderen mislukt' } } })
    const user = userEvent.setup()
    render(<DocumentsSection c={withDoc()} />)
    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'common:remove' }))
    // The rejected DELETE puts the row back — never leave it looking gone (the
    // mocked rejection can already settle by the time the click resolves, so
    // this only asserts the settled end state).
    await waitFor(() => expect(screen.getByText('cv.pdf')).toBeInTheDocument())
    expect(notifyError).toHaveBeenCalledWith('Verwijderen mislukt')
  })
})

/**
 * DOC-ENTRY-LINK-1: the OPTIONAL "Koppelen aan" picker in the upload queue —
 * on a successful upload with a pick, PATCHes the chosen education/certification
 * with the freshly uploaded document's id. Asserts the REQUEST (§13): route +
 * body, not merely that a callback fired.
 */
