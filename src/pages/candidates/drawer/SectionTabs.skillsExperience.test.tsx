/** SectionTabs · skills and experience linked-document icons (split from SectionTabs.test.tsx; real i18n nl). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceTab, SkillsTab } from './SectionTabs'

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
import api from '@/lib/api'

/**
 * DOC-LANG-SKILL-LINK-1: SkillsTab grows the same three subtle icons + edit-form
 * "Koppelen aan" picker as Education/Certifications (DOC-EDU-1/DOC-GELDIGHEID-1)
 * now that the backend carries document_id on candidate_skills. Mirrors those
 * describe blocks exactly.
 */
describe('SkillsTab · DOC-LANG-SKILL-LINK-1 linked-document icons + edit-form picker', () => {
  const documents = [
    { id: 'doc1', name: 'certificaat.pdf', url: '/api/candidates/c1/documents/doc1/download', type: 'Certificaat' },
    { id: 'doc2', name: 'ander.pdf', url: '/api/candidates/c1/documents/doc2/download' },
  ]

  it('renders no link icons when the entry has no linked document (calm by default)', () => {
    const item = { id: 's1', name: 'Heftruck rijden', level: 'Gevorderd' }
    render(<SkillsTab items={[item]} documents={documents} />)
    expect(screen.queryByTitle('Voorbeeld')).toBeNull()
    expect(screen.queryByTitle('Downloaden')).toBeNull()
  })

  it('renders preview + download icons once the entry links a document (by document_id)', () => {
    const item = { id: 's1', name: 'Heftruck rijden', document_id: 'doc1' }
    render(<SkillsTab items={[item]} documents={documents} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
    expect(screen.getByTitle('Downloaden')).toBeInTheDocument()
  })

  it('resolves the linked document via the reverse link (skill_id) when document_id is absent', () => {
    const item = { id: 's1', name: 'Heftruck rijden' }
    const withReverse = [{ id: 'doc9', name: 'certificaat.pdf', url: '/x', skill_id: 's1' }]
    render(<SkillsTab items={[item]} documents={withReverse} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
  })

  // LOOKUP-ICON-1: useSkillLevels now returns full {value,label,icon,color}
  // objects — the skill level's tenant icon shows next to the level text.
  it('shows the skill level\'s tenant icon next to the level text', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/skill-levels?active=1'
        ? Promise.resolve({ data: { data: [{ name: 'Gevorderd', icon: 'star' }] } })
        : Promise.resolve({ data: { data: [] } }),
    )
    const item = { id: 's1', name: 'Heftruck rijden', level: 'Gevorderd' }
    render(<SkillsTab items={[item]} documents={documents} />)
    const levelNode = await screen.findByText(/Gevorderd/)
    expect(levelNode.querySelector('svg')).toBeInTheDocument()
  })

  it('never crashes and shows no link icons for a legacy plain-string skill (no id to link by)', () => {
    // Legacy skills predate the id-based candidate_skills table and render as bare
    // strings — SkillsTab's renderItem already defends against this (typeof check).
    const legacySkill = 'Heftruck rijden' as unknown as Record<string, unknown>
    render(<SkillsTab items={[legacySkill]} documents={documents} />)
    expect(screen.getByText('Heftruck rijden')).toBeInTheDocument()
    expect(screen.queryByTitle('Voorbeeld')).toBeNull()
  })

  it('the jump icon is absent without an onJumpToDocuments callback, and present + wired with one', async () => {
    const user = userEvent.setup()
    const onJumpToDocuments = vi.fn()
    const item = { id: 's1', name: 'Heftruck rijden', document_id: 'doc1' }
    const { rerender } = render(<SkillsTab items={[item]} documents={documents} />)
    expect(screen.queryByTitle(/jumpToDocuments|Naar documenten/)).toBeNull()

    rerender(<SkillsTab items={[item]} documents={documents} onJumpToDocuments={onJumpToDocuments} />)
    await user.click(screen.getByTitle(/jumpToDocuments|Naar documenten/))
    expect(onJumpToDocuments).toHaveBeenCalledTimes(1)
  })

  it('preview opens the shared DocPreviewModal with the resolved linked document', async () => {
    const user = userEvent.setup()
    const item = { id: 's1', name: 'Heftruck rijden', document_id: 'doc1' }
    render(<SkillsTab items={[item]} documents={documents} />)
    expect(screen.queryByTestId('preview-modal')).toBeNull()
    await user.click(screen.getByTitle('Voorbeeld'))
    expect(screen.getByTestId('preview-modal')).toHaveTextContent('certificaat.pdf')
  })

  it('download calls the shared downloadFilesSequentially helper with the linked document\'s own url + name', async () => {
    const user = userEvent.setup()
    vi.mocked(downloadFilesSequentially).mockClear()
    const item = { id: 's1', name: 'Heftruck rijden', document_id: 'doc1' }
    render(<SkillsTab items={[item]} documents={documents} />)
    await user.click(screen.getByTitle('Downloaden'))
    expect(downloadFilesSequentially).toHaveBeenCalledWith([{ url: documents[0].url, name: documents[0].name }])
  })

  it('the edit-form "Koppelen aan" picker lists the candidate\'s documents, and the save payload carries the pick', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 's1', name: 'Heftruck rijden', level: 'Gevorderd' }
    render(<SkillsTab items={[item]} onEdit={onEdit} documents={documents} />)
    await user.click(screen.getByTitle('Bewerken'))
    // ALWAYS-SEARCHABLE-1: the document_id picker is the house CreatableSelect, named
    // by its own label ("Gekoppeld document") — distinct from the level picker
    // (already showing its picked value "Gevorderd").
    await user.click(screen.getByRole('button', { name: 'Gekoppeld document' }))
    await user.click(await screen.findByRole('button', { name: 'ander.pdf' }))
    await user.click(screen.getByTitle('Opslaan'))
    // §13: assert the save PAYLOAD carries the picked document_id.
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ document_id: 'doc2' }))
  })
})

/**
 * DOC-ERV-1: a work-experience row surfaces the same read-only preview/download/
 * jump icons as Education/Certifications/Skills once it carries a linked proof
 * document — but there is NO "Koppelen aan" edit-form picker here (this task
 * only adds the read-side display, no new persistence path).
 */
describe('ExperienceTab · DOC-ERV-1 linked-document icons (read-only)', () => {
  const documents = [
    { id: 'doc1', name: 'werkgeversverklaring.pdf', url: '/api/candidates/c1/documents/doc1/download', type: 'Werkgeversverklaring' },
    { id: 'doc2', name: 'ander.pdf', url: '/api/candidates/c1/documents/doc2/download' },
  ]

  it('renders no link icons when the entry has no linked document (calm by default)', () => {
    const item = { id: 'e1', title: 'Verpleegkundige', company: 'Ziekenhuis X' }
    render(<ExperienceTab items={[item]} documents={documents} />)
    expect(screen.queryByTitle('Voorbeeld')).toBeNull()
    expect(screen.queryByTitle('Downloaden')).toBeNull()
  })

  it('renders preview + download icons once the entry links a document (by document_id)', () => {
    const item = { id: 'e1', title: 'Verpleegkundige', document_id: 'doc1' }
    render(<ExperienceTab items={[item]} documents={documents} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
    expect(screen.getByTitle('Downloaden')).toBeInTheDocument()
  })

  it('resolves the linked document via the reverse link (experience_id) when document_id is absent', () => {
    const withReverse = [{ id: 'doc9', name: 'werkgeversverklaring.pdf', experience_id: 'e1' }]
    const item = { id: 'e1', title: 'Verpleegkundige' }
    render(<ExperienceTab items={[item]} documents={withReverse} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
  })

  it('the jump icon is absent without an onJumpToDocuments callback, and present + wired with one', async () => {
    const user = userEvent.setup()
    const onJumpToDocuments = vi.fn()
    const item = { id: 'e1', title: 'Verpleegkundige', document_id: 'doc1' }
    const { rerender } = render(<ExperienceTab items={[item]} documents={documents} />)
    expect(screen.queryByTitle(/jumpToDocuments|Naar documenten/)).toBeNull()

    rerender(<ExperienceTab items={[item]} documents={documents} onJumpToDocuments={onJumpToDocuments} />)
    await user.click(screen.getByTitle(/jumpToDocuments|Naar documenten/))
    expect(onJumpToDocuments).toHaveBeenCalledTimes(1)
  })

  it('preview opens the shared DocPreviewModal with the resolved linked document', async () => {
    const user = userEvent.setup()
    const item = { id: 'e1', title: 'Verpleegkundige', document_id: 'doc1' }
    render(<ExperienceTab items={[item]} documents={documents} />)
    expect(screen.queryByTestId('preview-modal')).toBeNull()
    await user.click(screen.getByTitle('Voorbeeld'))
    expect(screen.getByTestId('preview-modal')).toHaveTextContent('werkgeversverklaring.pdf')
  })

  it('download calls the shared downloadFilesSequentially helper with the linked document\'s own url + name', async () => {
    const user = userEvent.setup()
    vi.mocked(downloadFilesSequentially).mockClear()
    const item = { id: 'e1', title: 'Verpleegkundige', document_id: 'doc1' }
    render(<ExperienceTab items={[item]} documents={documents} />)
    await user.click(screen.getByTitle('Downloaden'))
    expect(downloadFilesSequentially).toHaveBeenCalledWith([{ url: documents[0].url, name: documents[0].name }])
  })
})
