// DocumentsSection — document ↔ entry linking, upload side (split from DocumentsSection.test.tsx): DOC-ENTRY-LINK-1, DOC-LANG-SKILL-LINK-1; the list-row suites live in DocumentsSection.linkRows.test.tsx.
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
// describe block (DocumentsSection.listMeta.test.tsx) overrides this per-test to prove the OFF path too.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
mockUseAuth.mockReturnValue({ hasPermission: () => true })

// Minimal candidate: only `id` + `documents` matter to this section.
const candidate = (): Candidate => ({ id: 'c1', documents: [] } as unknown as Candidate)

// Two distinct files so per-item state (type, remove, revoke) is never ambiguous.
const fileA = new File(['a-content'], 'a.pdf', { type: 'application/pdf' })

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
// G34: the "Koppelen aan" link picker (DocumentLinkPicker) is the house SelectMenu
// too — same idiom, distinct accessible-name prefix (documents.linkToFor).
// DROPDOWN-CLEAR-1: filter to only trigger buttons (which have aria-haspopup).
const getLinkTriggers = () => screen.queryAllByRole('button', { name: /documents\.linkToFor/ })
  .filter(btn => btn.hasAttribute('aria-haspopup'))
const pickLink = async (user: ReturnType<typeof userEvent.setup>, rowIndex: number, label: string) => {
  await user.click(getLinkTriggers()[rowIndex])
  await user.click(await within(openPortalMenu()).findByRole('button', { name: label }))
}

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
    // Only the doc-type picker — no fake affordance offering nothing to pick.
    expect(getTypeTriggers()).toHaveLength(1)
    expect(getLinkTriggers()).toHaveLength(0)
  })

  it('shows the grouped "Koppelen aan" picker (education + certification) when the candidate has both', () => {
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    // Doc type + "Koppelen aan" = one of each picker for this one queued file.
    expect(getTypeTriggers()).toHaveLength(1)
    expect(getLinkTriggers()).toHaveLength(1)
  })

  it('PATCHes the picked EDUCATION with the new document id after a successful upload', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    await pickLink(user, 0, 'sections.education · Verpleegkunde')
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/educations/e1', { document_id: 101 }, { quietStatuses: [422] }))
  })

  it('PATCHes the picked CERTIFICATION with the new document id after a successful upload', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    await pickLink(user, 0, 'sections.certifications · VCA Basis')
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/certifications/cert1', { document_id: 101 }, { quietStatuses: [422] }))
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
    await pickLink(user, 0, 'sections.education · Verpleegkunde')
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
    await pickLink(user, 0, 'sections.education · Verpleegkunde')
    // Two "common:add" buttons exist here: the persistent header "+" trigger and
    // this queue's own upload button — the queue's is always the LAST in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Koppelen mislukt'))
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

/**
 * DOC-LANG-SKILL-LINK-1: the same OPTIONAL "Koppelen aan" picker, extended to
 * languages/skills (BE landed document_id on candidate_languages/candidate_skills).
 * Mirrors the DOC-ENTRY-LINK-1 describe block above exactly — asserts the REQUEST
 * (§13): route + body, not merely that a callback fired.
 */
describe('DocumentsSection · DOC-LANG-SKILL-LINK-1 upload + link (languages/skills)', () => {
  const withLinkables = (): Candidate => ({
    id: 'c1',
    documents: [],
    languages: [{ id: 'lang1', language: 'Engels' }],
    skills: [{ id: 'skill1', name: 'Heftruck rijden' }],
  } as unknown as Candidate)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn((f: File) => `blob:${f.name}`), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the grouped "Koppelen aan" picker (language + skill) when the candidate has both', () => {
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    // Doc type + "Koppelen aan" = one of each picker for this one queued file.
    expect(getTypeTriggers()).toHaveLength(1)
    expect(getLinkTriggers()).toHaveLength(1)
  })

  it('a legacy skill entry with no id is never offered as a link target (no fake affordance)', () => {
    const noIdSkill: Candidate = { id: 'c1', documents: [], skills: ['Heftruck rijden'] } as unknown as Candidate
    const { container } = render(<DocumentsSection c={noIdSkill} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    // Only the doc-type picker — the plain-string legacy skill has nothing a PATCH could target.
    expect(getTypeTriggers()).toHaveLength(1)
    expect(getLinkTriggers()).toHaveLength(0)
  })

  it('PATCHes the picked LANGUAGE with the new document id after a successful upload', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    await pickLink(user, 0, 'sections.languages · Engels')
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/languages/lang1', { document_id: 101 }, { quietStatuses: [422] }))
  })

  it('PATCHes the picked SKILL with the new document id after a successful upload', async () => {
    const user = userEvent.setup()
    const { container } = render(<DocumentsSection c={withLinkables()} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    await pickLink(user, 0, 'sections.skills · Heftruck rijden')
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/candidates/c1/skills/skill1', { document_id: 101 }, { quietStatuses: [422] }))
  })

  it('calls onRefresh after a successful language link PATCH, so the Achtergrond tab remounts with the fresh link', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    const { container } = render(<DocumentsSection c={withLinkables()} onRefresh={onRefresh} />)
    fireEvent.change(getFileInput(container), { target: { files: [fileA] } })
    await pickLink(user, 0, 'sections.skills · Heftruck rijden')
    await user.click(screen.getAllByRole('button', { name: 'common:add' }).at(-1)!)
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  })
})
