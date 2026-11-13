/** SectionTabs · linked-document resolver, education and certification icons (split from SectionTabs.test.tsx; real i18n nl). */
import i18n from '@/i18n'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EducationTab, CertificationsTab, resolveLinkedDocument } from './SectionTabs'

// KAND-NIVEAU-1: EducationTab now also fires useEducationLevels' GET (built on the
// shared useCachedLookup) — resolve it with an empty list so no real network call
// fires and the hook's fallback seed renders (mirrors BackgroundTab.test.tsx's
// identical mock, added there for the same reason with useSkillLevels).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
  // useCachedLookup (behind useEducationLevels/useSkillLevels) keys its cache by
  // the active tenant — stub it so those hooks resolve instead of throwing.
  getActiveTenantId: () => 'test-tenant',
}))

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))// DOC-ENTRY-LINK-1: stub the shared preview modal (its own pdf.js internals are out
// of scope here, mirrors DocumentsSection.test.tsx) but keep the passed `doc` visible
// so a test can assert WHICH document the preview icon actually opened.
vi.mock('@/components/drawer/DocPreviewModal', () => ({
  default: ({ doc }: { doc?: { name?: string } }) => <div data-testid="preview-modal">{doc?.name}</div>,
}))
// Asserted as a REQUEST-shaped call (§13: url + name), never just "a click fired".
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: vi.fn() }))
import { downloadFilesSequentially } from '@/lib/downloadFiles'

describe('resolveLinkedDocument (DOC-ENTRY-LINK-1)', () => {
  const documents = [{ id: 'doc1', name: 'diploma.pdf' }, { id: 'doc2', name: 'other.pdf' }]

  it('matches by the entry\'s own document_id against the documents list first', () => {
    expect(resolveLinkedDocument({ id: 'e1', document_id: 'doc1' }, documents, 'education_id')).toEqual(documents[0])
  })

  it('falls back to the nested `document` object (education-only shape) when no list match exists', () => {
    const nested = { id: 'doc9', name: 'nested.pdf' }
    expect(resolveLinkedDocument({ id: 'e1', document: nested }, documents, 'education_id')).toBe(nested)
  })

  it('falls back to the document\'s own reverse link (education_id/certification_id) as a last resort', () => {
    const withReverse = [{ id: 'doc9', name: 'diploma.pdf', education_id: 'e1' }]
    expect(resolveLinkedDocument({ id: 'e1' }, withReverse, 'education_id')).toEqual(withReverse[0])
  })

  // DOC-LANG-SKILL-LINK-1: the same resolver, extended to language_id/skill_id.
  it('resolves via document_id with the language_id reverse key', () => {
    expect(resolveLinkedDocument({ id: 'l1', document_id: 'doc2' }, documents, 'language_id')).toEqual(documents[1])
  })

  it('resolves via document_id with the skill_id reverse key', () => {
    expect(resolveLinkedDocument({ id: 's1', document_id: 'doc1' }, documents, 'skill_id')).toEqual(documents[0])
  })

  it('falls back to the document\'s own reverse link (skill_id) as a last resort', () => {
    const withReverse = [{ id: 'doc9', name: 'certificaat.pdf', skill_id: 's1' }]
    expect(resolveLinkedDocument({ id: 's1' }, withReverse, 'skill_id')).toEqual(withReverse[0])
  })

  it('returns undefined when nothing links the entry to any document', () => {
    expect(resolveLinkedDocument({ id: 'e1' }, documents, 'education_id')).toBeUndefined()
  })
})

/**
 * DOC-ENTRY-LINK-1: the three subtle icons (preview/download/jump) an education/
 * certification entry grows once it has a linked proof document — plus the
 * "Koppelen aan" picker in the entry's OWN edit form. Mirrors the DOC-EDU-1/
 * DOC-GELDIGHEID-1 backend contract (document_id on both sub-entities).
 */
describe('EducationTab · DOC-EDU-1 linked-document icons + edit-form picker', () => {
  const documents = [
    { id: 'doc1', name: 'diploma.pdf', url: '/api/candidates/c1/documents/doc1/download', type: 'Diploma' },
    { id: 'doc2', name: 'ander.pdf', url: '/api/candidates/c1/documents/doc2/download' },
  ]

  it('renders no link icons when the entry has no linked document (calm by default)', () => {
    const item = { id: 'e1', title: 'Verpleegkunde', school: 'ROC' }
    render(<EducationTab items={[item]} documents={documents} />)
    expect(screen.queryByTitle(i18n.t('candidates:documents.preview'))).toBeNull()
    expect(screen.queryByTitle(i18n.t('candidates:documents.download'))).toBeNull()
  })

  it('renders preview + download icons once the entry links a document (by document_id)', () => {
    const item = { id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }
    render(<EducationTab items={[item]} documents={documents} />)
    expect(screen.getByTitle(i18n.t('candidates:documents.preview'))).toBeInTheDocument()
    expect(screen.getByTitle(i18n.t('candidates:documents.download'))).toBeInTheDocument()
  })

  it('the jump icon is absent without an onJumpToDocuments callback, and present + wired with one', async () => {
    const user = userEvent.setup()
    const onJumpToDocuments = vi.fn()
    const item = { id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }
    const { rerender } = render(<EducationTab items={[item]} documents={documents} />)
    // No callback supplied → no jump affordance at all (never a dead button).
    expect(screen.queryByTitle(/jumpToDocuments|Naar documenten/)).toBeNull()

    rerender(<EducationTab items={[item]} documents={documents} onJumpToDocuments={onJumpToDocuments} />)
    await user.click(screen.getByTitle(/jumpToDocuments|Naar documenten/))
    expect(onJumpToDocuments).toHaveBeenCalledTimes(1)
  })

  it('preview opens the shared DocPreviewModal with the resolved linked document', async () => {
    const user = userEvent.setup()
    const item = { id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }
    render(<EducationTab items={[item]} documents={documents} />)
    expect(screen.queryByTestId('preview-modal')).toBeNull()
    await user.click(screen.getByTitle(i18n.t('candidates:documents.preview')))
    expect(screen.getByTestId('preview-modal')).toHaveTextContent('diploma.pdf')
  })

  it('download calls the shared downloadFilesSequentially helper with the linked document\'s own url + name', async () => {
    const user = userEvent.setup()
    vi.mocked(downloadFilesSequentially).mockClear()
    const item = { id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }
    render(<EducationTab items={[item]} documents={documents} />)
    await user.click(screen.getByTitle(i18n.t('candidates:documents.download')))
    expect(downloadFilesSequentially).toHaveBeenCalledWith([{ url: documents[0].url, name: documents[0].name }])
  })

  it('the edit-form "Koppelen aan" picker lists the candidate\'s documents, and the save payload carries the pick', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'e1', title: 'Verpleegkunde', school: 'ROC' }
    render(<EducationTab items={[item]} onEdit={onEdit} documents={documents} />)
    await user.click(screen.getByTitle(i18n.t('common:edit')))
    // ALWAYS-SEARCHABLE-1: the document_id picker is the house CreatableSelect, named
    // by its own label ("Gekoppeld document") — open it and pick doc2 by document name.
    await user.click(screen.getByRole('button', { name: i18n.t('candidates:addFields.linkedDocument') }))
    await user.click(await screen.findByRole('button', { name: 'ander.pdf' }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    // §13: assert the save PAYLOAD carries the picked document_id.
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ document_id: 'doc2' }))
  })
})

describe('CertificationsTab · DOC-GELDIGHEID-1 linked-document icons + edit-form picker', () => {
  const documents = [
    { id: 'doc1', name: 'vca.pdf', url: '/api/candidates/c1/documents/doc1/download', type: 'Certificaat' },
    { id: 'doc2', name: 'ander.pdf', url: '/api/candidates/c1/documents/doc2/download' },
  ]

  it('renders no link icons when the entry has no linked document', () => {
    const item = { id: 'c1', name: 'VCA Basis' }
    render(<CertificationsTab items={[item]} documents={documents} />)
    expect(screen.queryByTitle(i18n.t('candidates:documents.preview'))).toBeNull()
  })

  it('renders preview + download icons once the entry links a document (by document_id)', () => {
    const item = { id: 'c1', name: 'VCA Basis', document_id: 'doc1' }
    render(<CertificationsTab items={[item]} documents={documents} />)
    expect(screen.getByTitle(i18n.t('candidates:documents.preview'))).toBeInTheDocument()
    expect(screen.getByTitle(i18n.t('candidates:documents.download'))).toBeInTheDocument()
  })

  it('resolves the linked document via the reverse link (certification_id) when document_id is absent', () => {
    const item = { id: 'c1', name: 'VCA Basis' }
    const withReverse = [{ id: 'doc9', name: 'vca.pdf', url: '/x', certification_id: 'c1' }]
    render(<CertificationsTab items={[item]} documents={withReverse} />)
    expect(screen.getByTitle(i18n.t('candidates:documents.preview'))).toBeInTheDocument()
  })

  it('jumping to Documenten calls the provided callback', async () => {
    const user = userEvent.setup()
    const onJumpToDocuments = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', document_id: 'doc1' }
    render(<CertificationsTab items={[item]} documents={documents} onJumpToDocuments={onJumpToDocuments} />)
    await user.click(screen.getByTitle(/jumpToDocuments|Naar documenten/))
    expect(onJumpToDocuments).toHaveBeenCalledTimes(1)
  })

  it('the edit-form "Koppelen aan" picker save payload carries the picked document_id', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', org: 'SSVV' }
    render(<CertificationsTab items={[item]} onEdit={onEdit} documents={documents} />)
    await user.click(screen.getByTitle(i18n.t('common:edit')))
    // ALWAYS-SEARCHABLE-1: the house CreatableSelect, named by its own label.
    await user.click(screen.getByRole('button', { name: i18n.t('candidates:addFields.linkedDocument') }))
    await user.click(await screen.findByRole('button', { name: 'ander.pdf' }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ document_id: 'doc2' }))
  })
})
