/**
 * SectionTabs — Achtergrond tab regression tests (candidate-100% wave, part 2).
 * Real i18n (nl) runs here — SectionTabs imports useDateFormat, which pulls in
 * the real @/i18n side-effect init, so `t()` resolves genuine Dutch text instead
 * of raw keys (consistent with how the app renders these strings for real).
 * Only the Tiptap RichTextEditor is stubbed (its own internals are out of scope
 * here — mirrors src/pages/customers/drawer/EditableRichTextField.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceTab, EducationTab, CertificationsTab, resolveEducationStartDate, resolveLinkedDocument } from './SectionTabs'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
// DOC-ENTRY-LINK-1: stub the shared preview modal (its own pdf.js internals are out
// of scope here, mirrors DocumentsSection.test.tsx) but keep the passed `doc` visible
// so a test can assert WHICH document the preview icon actually opened.
vi.mock('@/components/drawer/DocPreviewModal', () => ({
  default: ({ doc }: { doc?: { name?: string } }) => <div data-testid="preview-modal">{doc?.name}</div>,
}))
// Asserted as a REQUEST-shaped call (§13: url + name), never just "a click fired".
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: vi.fn() }))
import { downloadFilesSequentially } from '@/lib/downloadFiles'

describe('resolveEducationStartDate (C-12 mapping)', () => {
  it('uses the explicit camelCase start date when present', () => {
    expect(resolveEducationStartDate({ start: '2020-01-01', issued: '2021-01-01', inProgress: true })).toBe('2020-01-01')
  })

  it('falls back to the snake_case start_date', () => {
    expect(resolveEducationStartDate({ start_date: '2020-06-15' })).toBe('2020-06-15')
  })

  it('falls back to the issue/diploma date ONLY when in progress and no start exists (legacy rows)', () => {
    expect(resolveEducationStartDate({ inProgress: true, issued: '2009-01-01' })).toBe('2009-01-01')
    expect(resolveEducationStartDate({ in_progress: true, issue_date: '2009-02-02' })).toBe('2009-02-02')
  })

  it('does NOT fall back to the issue date when not in progress (a finished row with no start just has no start)', () => {
    expect(resolveEducationStartDate({ issued: '2009-01-01' })).toBeUndefined()
  })

  it('returns undefined when nothing is set', () => {
    expect(resolveEducationStartDate({})).toBeUndefined()
  })
})

describe('EducationTab · read/edit start-date parity (C-12)', () => {
  it('the edit form pre-fills the SAME start date the read line falls back to', async () => {
    const user = userEvent.setup()
    // Legacy row: in progress, has a diploma/issue date, but NO explicit start date —
    // the read line falls back to it ("01-01-2009 – heden"); the pencil must show the
    // same date, not an empty field (that mismatch was C-12).
    const item = { id: 'e1', title: 'Verpleegkunde', school: 'ROC', inProgress: true, issue_date: '2009-01-01' }
    render(<EducationTab items={[item]} onEdit={vi.fn()} />)
    expect(screen.getByText(/01-01-2009/)).toBeInTheDocument()

    // One pencil per entry (DRAWER-ONE-PENCIL-1, Danny 05-08) — the row-level edit form.
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByDisplayValue('01-01-2009')).toBeInTheDocument()
  })

  it('leaves the start date genuinely empty when neither a start nor an issue date exists', async () => {
    const user = userEvent.setup()
    const item = { id: 'e2', title: 'Onbekend', inProgress: true }
    render(<EducationTab items={[item]} onEdit={vi.fn()} />)
    await user.click(screen.getByTitle('Bewerken'))
    // The start-date field (react-datepicker) has no display value to assert against —
    // confirm no stray date leaked in instead.
    expect(screen.queryByDisplayValue(/\d{2}-\d{2}-\d{4}/)).toBeNull()
  })
})

describe('EducationTab · "Nog in opleiding" checkbox label (C-11 regression guard)', () => {
  it('keeps its own label text stable through check → uncheck → recheck', async () => {
    const user = userEvent.setup()
    render(<EducationTab items={[]} onAdd={vi.fn()} />)
    // Icon-only add trigger (28-07): the label is now its accessible name.
    await user.click(screen.getByRole('button', { name: /Toevoegen/ }))
    const checkbox = screen.getByRole('checkbox')

    expect(screen.getByText('Nog in opleiding')).toBeInTheDocument()
    await user.click(checkbox)
    expect(screen.getByText('Nog in opleiding')).toBeInTheDocument()
    await user.click(checkbox)
    expect(screen.getByText('Nog in opleiding')).toBeInTheDocument()
  })
})

describe('CertificationsTab · compact display (C-13a/b)', () => {
  it('keeps organisation on the same compact secondary line as the dates (no orphan org line)', () => {
    const item = { id: 'c1', name: 'VCA Basis', org: 'SSVV', issued: '2023-01-01', expires: '2026-01-01' }
    render(<CertificationsTab items={[item]} />)
    const node = screen.getByText(/SSVV/)
    expect(node.textContent).toMatch(/SSVV.*01-01-2023.*01-01-2026/)
  })

  it('shows the licence number in a muted, monospace line', () => {
    const item = { id: 'c1', name: 'VCA Basis', license: 'LIC-12345' }
    render(<CertificationsTab items={[item]} />)
    const el = screen.getByText(/LIC-12345/)
    expect(el).toHaveStyle({ fontFamily: 'JetBrains Mono, monospace' })
  })

  it('hides the licence line entirely when there is none', () => {
    const item = { id: 'c1', name: 'VCA Basis' }
    render(<CertificationsTab items={[item]} />)
    expect(screen.queryByText(/licentienummer/i)).toBeNull()
  })
})

describe('CertificationsTab · description read-only, edited via the ONE row pencil (C-13c, DRAWER-ONE-PENCIL-1)', () => {
  it('renders the saved description through SafeHtml, not a bare textarea, with no field-level pencil of its own', () => {
    const item = { id: 'c1', name: 'VCA Basis', desc: '<p>Basisveiligheid <strong>VOL</strong></p>' }
    render(<CertificationsTab items={[item]} />)
    expect(screen.getByText('Basisveiligheid')).toBeInTheDocument()
    expect(screen.getByText('VOL').tagName).toBe('STRONG')
    expect(screen.queryByRole('textbox')).toBeNull() // no bare <textarea> in read mode
    // No onEdit passed → AddableSection renders no row pencil either (no fake affordance).
    expect(screen.queryByTitle('Bewerken')).toBeNull()
  })

  it('edits the description through the ONE row-level pencil — the save payload carries the edited desc html', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', org: 'SSVV', desc: '<p>Basisveiligheid</p>' }
    render(<CertificationsTab items={[item]} onEdit={onEdit} />)

    // Exactly ONE 'Bewerken' pencil now — the description no longer has its own (the fix).
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(1)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Basisveiligheid</p>')
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p>Edited</p>')
    await user.click(screen.getByTitle('Opslaan'))

    // §13: assert the REQUEST payload, not just that the callback fired — the edited
    // desc html rides along in the SAME row-level save (merged with the other fields).
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ desc: '<p>Edited</p>' }))
  })

  it('cancel discards the draft without calling onEdit', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', desc: '<p>Basisveiligheid</p>' }
    render(<CertificationsTab items={[item]} onEdit={onEdit} />)
    await user.click(screen.getByTitle('Bewerken'))
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p>Discarded</p>')
    await user.click(screen.getByTitle('Annuleren'))
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Basisveiligheid')).toBeInTheDocument()
  })
})

describe('ExperienceTab · description read-only, edited via the ONE row pencil (C-14, DRAWER-ONE-PENCIL-1)', () => {
  it('shows the description via SafeHtml and edits it through the single row-level pencil', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'x1', title: 'Verpleegkundige', company: 'Yesway', desc: '<p>Zorgtaken</p>' }
    render(<ExperienceTab items={[item]} onEdit={onEdit} />)

    expect(screen.getByText('Zorgtaken')).toBeInTheDocument()
    // Exactly ONE 'Bewerken' pencil — the description no longer has its own (the fix).
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(1)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Zorgtaken</p>')
    await user.click(screen.getByTitle('Opslaan'))
    // §13: assert the REQUEST payload — the row save carries the (unchanged) desc html
    // merged alongside the other row fields, not a separate partial-desc call.
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ desc: '<p>Zorgtaken</p>' }))
  })

  it('renders the description as a rich-text field INSIDE the row-level edit form (one pencil owns it all)', async () => {
    const user = userEvent.setup()
    const item = { id: 'x1', title: 'Verpleegkundige', company: 'Yesway', desc: '<p>Zorgtaken</p>' }
    render(<ExperienceTab items={[item]} onEdit={vi.fn()} />)
    await user.click(screen.getByTitle('Bewerken'))
    // The row form (title/company/location/dates/current) now ALSO renders the
    // description — mocked as the `rte` textarea — inside the SAME form.
    expect(screen.getByTestId('rte')).toBeInTheDocument()
  })
})

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
    expect(screen.queryByTitle('Voorbeeld')).toBeNull()
    expect(screen.queryByTitle('Downloaden')).toBeNull()
  })

  it('renders preview + download icons once the entry links a document (by document_id)', () => {
    const item = { id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }
    render(<EducationTab items={[item]} documents={documents} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
    expect(screen.getByTitle('Downloaden')).toBeInTheDocument()
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
    await user.click(screen.getByTitle('Voorbeeld'))
    expect(screen.getByTestId('preview-modal')).toHaveTextContent('diploma.pdf')
  })

  it('download calls the shared downloadFilesSequentially helper with the linked document\'s own url + name', async () => {
    const user = userEvent.setup()
    vi.mocked(downloadFilesSequentially).mockClear()
    const item = { id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }
    render(<EducationTab items={[item]} documents={documents} />)
    await user.click(screen.getByTitle('Downloaden'))
    expect(downloadFilesSequentially).toHaveBeenCalledWith([{ url: documents[0].url, name: documents[0].name }])
  })

  it('the edit-form "Koppelen aan" picker lists the candidate\'s documents, and the save payload carries the pick', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'e1', title: 'Verpleegkunde', school: 'ROC' }
    render(<EducationTab items={[item]} onEdit={onEdit} documents={documents} />)
    await user.click(screen.getByTitle('Bewerken'))
    // The document_id select is the ONLY combobox in this row's edit form (every
    // other field is a text/date/checkbox/richtext input).
    await user.selectOptions(screen.getByRole('combobox'), 'doc2')
    await user.click(screen.getByTitle('Opslaan'))
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
    expect(screen.queryByTitle('Voorbeeld')).toBeNull()
  })

  it('renders preview + download icons once the entry links a document (by document_id)', () => {
    const item = { id: 'c1', name: 'VCA Basis', document_id: 'doc1' }
    render(<CertificationsTab items={[item]} documents={documents} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
    expect(screen.getByTitle('Downloaden')).toBeInTheDocument()
  })

  it('resolves the linked document via the reverse link (certification_id) when document_id is absent', () => {
    const item = { id: 'c1', name: 'VCA Basis' }
    const withReverse = [{ id: 'doc9', name: 'vca.pdf', url: '/x', certification_id: 'c1' }]
    render(<CertificationsTab items={[item]} documents={withReverse} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
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
    await user.click(screen.getByTitle('Bewerken'))
    await user.selectOptions(screen.getByRole('combobox'), 'doc2')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ document_id: 'doc2' }))
  })
})
