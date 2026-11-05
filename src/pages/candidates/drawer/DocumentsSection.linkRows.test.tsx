/** DocumentsSection · linking (split from DocumentsSection.linking.test.tsx; DOC-LIST-LINK-1, REFERENTIE-VELDEN-1, DOC-1-EIGENAAR-1: list row chips, relink/clear, occupied entries). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
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
// describe block (DocumentsSection.listMeta.test.tsx) overrides this per-test to prove the OFF path too.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
mockUseAuth.mockReturnValue({ hasPermission: () => true })

// PORTAL-MARKER-1: the open menu is PORTALLED into document.body now — scope the
// option query to the one open portal menu (only one exists at a time), which
// keeps the original intent: never collide with in-page chips or other rows.
const openPortalMenu = () => document.querySelector('[data-dropdown-portal]') as HTMLElement
// G34: the "Koppelen aan" link picker (DocumentLinkPicker) is the house SelectMenu
// too — same idiom, distinct accessible-name prefix (documents.linkToFor).
// DROPDOWN-CLEAR-1: filter to only trigger buttons (which have aria-haspopup).
const getLinkTriggers = () => screen.queryAllByRole('button', { name: /documents\.linkToFor/ })
  .filter(btn => btn.hasAttribute('aria-haspopup'))
const pickLink = async (user: ReturnType<typeof userEvent.setup>, rowIndex: number, label: string) => {
  await user.click(getLinkTriggers()[rowIndex])
  await user.click(await within(openPortalMenu()).findByRole('button', { name: label }))
}

/**
 * DOC-LIST-LINK-1 (Danny 08-08 "je ziet hier niet waaraan een document gekoppeld
 * is en je kan de koppeling niet wijzigen"): the LIST row now shows the resolved
 * link as a chip (education_id/certification_id/language_id/skill_id from
 * DocumentResource) and can change/clear it via the inline "Koppelen aan" picker.
 * Asserts the REQUEST (§13): route + body, including the clear-then-set order
 * relinkDocument uses when moving a link from one entry to another.
 */
describe('DocumentsSection · DOC-LIST-LINK-1 list row link chip + relink/clear', () => {
  const linkables = () => ({
    educations: [{ id: 'e1', title: 'Verpleegkunde' }],
    certifications: [{ id: 'cert1', name: 'VCA Basis' }],
  })
  // A document already linked to the education (mirrors the real DocumentResource
  // contract: education_id is the reverse-FK id, not a column on the document itself).
  const linkedDoc = { id: 'doc1', name: 'diploma.pdf', type: 'Diploma', size: '10 KB', url: '/x', education_id: 'e1' }
  const unlinkedDoc = { id: 'doc1', name: 'diploma.pdf', type: 'Diploma', size: '10 KB', url: '/x' }
  const withDocs = (doc: Record<string, unknown>): Candidate => ({ id: 'c1', documents: [doc], ...linkables() } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the linked education\'s own label as a chip on the row', () => {
    render(<DocumentsSection c={withDocs(linkedDoc)} />)
    expect(screen.getByText('Verpleegkunde')).toBeInTheDocument()
  })

  it('renders no chip at all for a document with no link (never an empty chip)', () => {
    render(<DocumentsSection c={withDocs(unlinkedDoc)} />)
    expect(screen.queryByTitle('documents.linkedTo')).not.toBeInTheDocument()
  })

  it('hides the "change link" control when the candidate has nothing to link to', () => {
    render(<DocumentsSection c={{ id: 'c1', documents: [unlinkedDoc] } as unknown as Candidate} />)
    expect(screen.queryByRole('button', { name: 'documents.changeLink' })).not.toBeInTheDocument()
  })

  it('hides the "change link" control for a not-yet-persisted (optimistic) row', () => {
    const tempDoc = { id: -1753280000000, name: 'pending.pdf', type: 'CV' }
    render(<DocumentsSection c={withDocs(tempDoc)} />)
    expect(screen.queryByRole('button', { name: 'documents.changeLink' })).not.toBeInTheDocument()
  })

  it('linking a previously UNLINKED document PATCHes only the new relation (no clear call)', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDocs(unlinkedDoc)} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await pickLink(user, 0, 'sections.education · Verpleegkunde')
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/educations/e1', { document_id: 'doc1' }, { quietStatuses: [422] }))
    expect(api.patch).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Verpleegkunde')).toBeInTheDocument()
  })

  it('RE-linking from education to certification CLEARS the old side FIRST, then sets the new one', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDocs(linkedDoc)} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await pickLink(user, 0, 'sections.certifications · VCA Basis')
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2))
    const calls = vi.mocked(api.patch).mock.calls
    // Order matters: the old link is cleared BEFORE the new one is set (measured
    // live 08-08 — setting the new side first left BOTH sides pointing at the
    // same document on the real API).
    expect(calls[0]).toEqual(['/candidates/c1/educations/e1', { document_id: null }, { quietStatuses: [422] }])
    expect(calls[1]).toEqual(['/candidates/c1/certifications/cert1', { document_id: 'doc1' }, { quietStatuses: [422] }])
    expect(await screen.findByText('VCA Basis')).toBeInTheDocument()
    expect(screen.queryByText('Verpleegkunde')).not.toBeInTheDocument()
  })

  it('clearing an existing link PATCHes document_id: null and the chip disappears', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDocs(linkedDoc)} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    // The blank "documents.linkTo" option is the explicit "no link" choice.
    await pickLink(user, 0, 'documents.linkTo')
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/educations/e1', { document_id: null }, { quietStatuses: [422] }))
    expect(api.patch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('Verpleegkunde')).not.toBeInTheDocument())
  })

  it('calls onRefresh after a successful relink, so the Achtergrond tab remounts with the fresh link', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<DocumentsSection c={withDocs(unlinkedDoc)} onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await pickLink(user, 0, 'sections.education · Verpleegkunde')
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  })

  it('keeps the OLD chip and surfaces the server error when a relink PATCH is REJECTED', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: 'Koppelen mislukt' } } })
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<DocumentsSection c={withDocs(linkedDoc)} onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await pickLink(user, 0, 'sections.certifications · VCA Basis')
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Koppelen mislukt'))
    // The optimistic swap never happened — the original link is still shown, and
    // the OTHER tab is never told to refresh with a link that never actually changed.
    expect(screen.getByText('Verpleegkunde')).toBeInTheDocument()
    expect(screen.queryByText('VCA Basis')).not.toBeInTheDocument()
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

/**
 * REFERENTIE-VELDEN-1 (Danny 08-08): the DOCUMENT side of the reference-letter
 * link CMBE shipped (candidate_references.document_id + the reverse reference_id
 * on DocumentResource, commit 9a9bd8c9) — mirrors the DOC-LIST-LINK-1 block above
 * exactly, one kind further. Asserts the REQUEST (§13): route + body, including
 * the clear-then-set order, and that the chip renders the referent's OWN name.
 */
describe('DocumentsSection · REFERENTIE-VELDEN-1 reference link chip + relink/clear', () => {
  const linkables = () => ({
    educations: [{ id: 'e1', title: 'Verpleegkunde' }],
    references: [{ id: 'ref1', first_name: 'Jan', middle_name: 'de', last_name: 'Vries' }],
  })
  // A document already linked to the reference (mirrors the real DocumentResource
  // contract: reference_id is the reverse-FK id, not a column on the document itself).
  const linkedDoc = { id: 'doc1', name: 'referentiebrief.pdf', type: 'Diploma', size: '10 KB', url: '/x', reference_id: 'ref1' }
  const unlinkedDoc = { id: 'doc1', name: 'referentiebrief.pdf', type: 'Diploma', size: '10 KB', url: '/x' }
  const withDocs = (doc: Record<string, unknown>): Candidate => ({ id: 'c1', documents: [doc], ...linkables() } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the referent\'s composed name as a chip on the row', () => {
    render(<DocumentsSection c={withDocs(linkedDoc)} />)
    expect(screen.getByText('Jan de Vries')).toBeInTheDocument()
  })

  it('renders no chip at all for a document with no link (never an empty chip)', () => {
    render(<DocumentsSection c={withDocs(unlinkedDoc)} />)
    expect(screen.queryByTitle('documents.linkedTo')).not.toBeInTheDocument()
  })

  it('linking a previously UNLINKED document to a REFERENCE PATCHes only the new relation (no clear call)', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDocs(unlinkedDoc)} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await pickLink(user, 0, 'sections.references · Jan de Vries')
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/references/ref1', { document_id: 'doc1' }, { quietStatuses: [422] }))
    expect(api.patch).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Jan de Vries')).toBeInTheDocument()
  })

  it('RE-linking from education to reference CLEARS the old side FIRST, then sets the new one', async () => {
    const educationLinkedDoc = { id: 'doc1', name: 'diploma.pdf', type: 'Diploma', size: '10 KB', url: '/x', education_id: 'e1' }
    const user = userEvent.setup()
    render(<DocumentsSection c={withDocs(educationLinkedDoc)} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await pickLink(user, 0, 'sections.references · Jan de Vries')
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2))
    const calls = vi.mocked(api.patch).mock.calls
    // Order matters: the old link is cleared BEFORE the new one is set (same
    // clear-then-set order DOC-LIST-LINK-1 uses for every other kind).
    expect(calls[0]).toEqual(['/candidates/c1/educations/e1', { document_id: null }, { quietStatuses: [422] }])
    expect(calls[1]).toEqual(['/candidates/c1/references/ref1', { document_id: 'doc1' }, { quietStatuses: [422] }])
    expect(await screen.findByText('Jan de Vries')).toBeInTheDocument()
  })

  it('clearing an existing reference link PATCHes document_id: null and the chip disappears', async () => {
    const user = userEvent.setup()
    render(<DocumentsSection c={withDocs(linkedDoc)} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    // The blank "documents.linkTo" option is the explicit "no link" choice.
    await pickLink(user, 0, 'documents.linkTo')
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/references/ref1', { document_id: null }, { quietStatuses: [422] }))
    expect(api.patch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('Jan de Vries')).not.toBeInTheDocument())
  })
})

/**
 * DOC-1-EIGENAAR-1 (Danny 08-08 punt 6), the DOCUMENT side of the same rule.
 * MEASURED live 08-08: PATCHing a second document onto an entry that already carries
 * one answers 200 and silently RELEASES the first — so an occupied entry must not be
 * offered as a link target. The entry this document itself hangs on stays offered, so
 * the link can always be switched or cleared.
 */
describe('DocumentsSection · DOC-1-EIGENAAR-1 occupied entries are not offered as link targets', () => {
  const doc = { id: 'doc1', name: 'diploma.pdf', type: 'Diploma', size: '10 KB', url: '/x' }
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('leaves an entry that already carries another document out of the picker', async () => {
    const user = userEvent.setup()
    const c = {
      id: 'c1', documents: [doc],
      educations: [{ id: 'e1', title: 'Verpleegkunde', document_id: 'other-doc' }, { id: 'e2', title: 'Anatomie', document_id: null }],
    } as unknown as Candidate
    render(<DocumentsSection c={c} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await user.click(getLinkTriggers()[0])
    // PORTAL-MARKER-1: the open menu lives in document.body now — scope to it.
    const menu = openPortalMenu()
    expect(within(menu).queryByRole('button', { name: 'sections.education · Verpleegkunde' })).toBeNull()
    expect(await within(menu).findByRole('button', { name: 'sections.education · Anatomie' })).toBeInTheDocument()
  })

  it('KEEPS the entry this document hangs on, so its own link can still be cleared', async () => {
    const user = userEvent.setup()
    const c = {
      id: 'c1', documents: [{ ...doc, education_id: 'e1' }],
      educations: [{ id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }],
    } as unknown as Candidate
    render(<DocumentsSection c={c} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    await pickLink(user, 0, 'documents.linkTo')
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/educations/e1', { document_id: null }, { quietStatuses: [422] }))
  })

  it('hides the "change link" control entirely when every entry is already occupied', () => {
    const c = {
      id: 'c1', documents: [doc],
      educations: [{ id: 'e1', title: 'Verpleegkunde', document_id: 'other-doc' }],
      certifications: [{ id: 'cert1', name: 'VCA Basis', document_id: 'yet-another' }],
    } as unknown as Candidate
    render(<DocumentsSection c={c} />)
    // The old gate ("the candidate HAS entries") opened a picker that rendered
    // nothing — an empty affordance (§3).
    expect(screen.queryByRole('button', { name: 'documents.changeLink' })).not.toBeInTheDocument()
  })
})

/**
 * Documents punchlist point 1 (DOC-EXPIRY-1): a document carrying `expires_at`
 * shows a danger chip once past due, a warning chip inside the 30-day window
 * (mirrors pages/matches/matchExpiry.ts's own window), and no chip otherwise.
 * Dates are computed relative to the real clock (±10/90 days) so the assertion
 * never depends on injecting a fake `now` and stays clear of the day-0 boundary.
 */
