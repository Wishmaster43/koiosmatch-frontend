/**
 * DocumentsSection — multi-file upload queue (BUGFIX 23-07). Proves the actual
 * bug: picking several files used to collapse to `files?.[0]`, silently dropping
 * everything else. These tests assert the REQUEST (§13) — every queued file gets
 * its own POST with its own `type`, not just that a callback fired.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsSection from './DocumentsSection'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'

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
// Preview modal only ever mounts on click — stub it so its own deps (pdf.js) never load here.
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => null }))

// Minimal candidate: only `id` + `documents` matter to this section.
const candidate = (): Candidate => ({ id: 'c1', documents: [] } as unknown as Candidate)

// Two distinct files so per-item state (type, remove, revoke) is never ambiguous.
const fileA = new File(['a-content'], 'a.pdf', { type: 'application/pdf' })
const fileB = new File(['b-content'], 'b.pdf', { type: 'application/pdf' })

const getFileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement

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
    expect(screen.getAllByRole('combobox')).toHaveLength(2)

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

  it('uploads each queued file with its OWN type when a row select is changed', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={candidate()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA, fileB] } })

    // Change only the second row's type — the first must stay on the default.
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'Diploma')

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

    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toHaveValue('Diploma')
    expect(selects[1]).toHaveValue('Diploma')
  })

  it('a per-row remove drops only that item and revokes its own object URL', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={candidate()} />)
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
describe('DocumentsSection · DOC-ENTRY-LINK-1 upload + link', () => {
  const withLinkables = (): Candidate => ({
    id: 'c1',
    documents: [],
    educations: [{ id: 'e1', title: 'Verpleegkunde' }],
    certifications: [{ id: 'cert1', name: 'VCA Basis' }],
  } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn((f: File) => `blob:${f.name}`), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('hides the "Koppelen aan" picker entirely when the candidate has no education/certification to link', () => {
    const { container } = render(<DocumentsSection c={candidate()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    // Only the doc-type select — no fake affordance offering nothing to pick.
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('shows the grouped "Koppelen aan" picker (education + certification) when the candidate has both', () => {
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    // Doc type + "Koppelen aan" = two comboboxes for this one queued file.
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('PATCHes the picked EDUCATION with the new document id after a successful upload', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'education:e1')
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/educations/e1', { document_id: 101 }))
  })

  it('PATCHes the picked CERTIFICATION with the new document id after a successful upload', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'certification:cert1')
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/certifications/cert1', { document_id: 101 }))
  })

  it('never fires the link PATCH when nothing was picked (plain upload)', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('calls onRefresh after a successful link PATCH, so the Achtergrond tab remounts with the fresh link', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    const { container } = render(<DocumentsSection c={withLinkables()} onRefresh={onRefresh} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'education:e1')
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  })

  it('surfaces the server error and never calls onRefresh when the link PATCH is rejected', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: 'Koppelen mislukt' } } })
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    const { container } = render(<DocumentsSection c={withLinkables()} onRefresh={onRefresh} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'education:e1')
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Koppelen mislukt'))
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
