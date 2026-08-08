/**
 * LanguagesSection —
 * (1) G34 regression: the taal/gesproken/schriftelijk pickers are the house
 *     `CreatableSelect` (allowCreate={false}), never a native <select>. Pins the
 *     onEditSave payload — a persisted row now also carries its `id` (see the
 *     component's LangSavePayload comment), a new row still does not.
 * (2) TAAL-DOC-LINK-1 (Danny 08-08 "Talen: kan ik nog geen document koppelen"): a
 *     language row can link a proof document. These assert the REAL request
 *     (method + route + body), because the candidate-level PATCH is NOT the path:
 *     measured live 08-08, `PATCH /candidates/{id}` answers 200 while silently
 *     dropping `document_id` on a language row — only the per-item relation route
 *     `PATCH /candidates/{id}/languages/{row}` persists it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguagesSection from './LanguagesSection'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/useLanguageLookups', () => ({
  useLanguageLookups: () => ({ languages: ['Nederlands', 'Engels'], levels: ['Basis', 'Vloeiend'] }),
}))

// The shared axios client — `patch` is what the link assertions read. `get` and
// getActiveTenantId keep the document-type lookup inside DocPreviewModal quiet.
const { patch, downloadFiles } = vi.hoisted(() => ({
  patch: vi.fn(() => Promise.resolve({ data: {} })),
  downloadFiles: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/api', () => ({
  default: { patch, get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrapList: () => ({ rows: [] }),
  getActiveTenantId: () => 'demo',
}))
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: downloadFiles }))

const doc = { id: 'd1', name: 'taalcertificaat.pdf', url: '/api/candidates/c1/documents/d1/download' }
const candidate = {
  id: 'c1',
  languages: [{ id: 'l1', language: 'Nederlands', spoken: 'Vloeiend', written: 'Vloeiend' }],
  documents: [doc],
} as unknown as Candidate

beforeEach(() => vi.clearAllMocks())

describe('LanguagesSection · pickers are the house CreatableSelect, not a native <select>', () => {
  it('renders no native <select> once editing', async () => {
    const user = userEvent.setup()
    const { container } = render(<LanguagesSection c={candidate} onEditSave={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    expect(container.querySelector('select')).toBeNull()
  })

  it('changing the language picker on the existing row and saving submits the SAME shape as before', async () => {
    const user = userEvent.setup()
    const onEditSave = vi.fn()
    render(<LanguagesSection c={candidate} onEditSave={onEditSave} />)
    await user.click(screen.getByTitle('common:edit'))

    // Row 1's language trigger currently shows the picked value "Nederlands".
    await user.click(screen.getByRole('button', { name: 'Nederlands' }))
    await user.click(await screen.findByRole('button', { name: 'Engels' }))
    await user.click(screen.getByTitle('common:save'))

    // The persisted row's id rides along so the drawer's optimistic merge keeps it
    // (without it every linked document dropped off the chips until a full refetch).
    expect(onEditSave).toHaveBeenCalledWith({
      languages: [{ id: 'l1', language: 'Engels', spoken: 'Vloeiend', written: 'Vloeiend' }],
    })
  })

  it('adding a fresh row and picking all three levels calls onEditSave with the full row', async () => {
    const user = userEvent.setup()
    const onEditSave = vi.fn()
    render(<LanguagesSection c={{ id: 'c1', languages: [] } as unknown as Candidate} onEditSave={onEditSave} />)
    // Outside edit mode, the "+ Taal" trigger enters edit AND seeds one fresh row.
    // The always-visible "+ Taal" button shares its accessible name with the fresh
    // row's own (still-empty) language picker trigger — the picker is the LAST match.
    await user.click(screen.getByRole('button', { name: 'addFields.language' }))

    const langTriggers = screen.getAllByRole('button', { name: 'addFields.language' })
    await user.click(langTriggers[langTriggers.length - 1])
    await user.click(await screen.findByRole('button', { name: 'Nederlands' }))
    await user.click(screen.getByRole('button', { name: 'addFields.spokenLevel' }))
    await user.click(await screen.findByRole('button', { name: 'Vloeiend' }))
    await user.click(screen.getByRole('button', { name: 'addFields.writtenLevel' }))
    await user.click(await screen.findByRole('button', { name: 'Basis' }))
    await user.click(screen.getByTitle('common:save'))

    // A brand-new row has no id yet — the payload carries none (never an empty one).
    expect(onEditSave).toHaveBeenCalledWith({
      languages: [{ language: 'Nederlands', spoken: 'Vloeiend', written: 'Basis' }],
    })
  })
})

describe('LanguagesSection · TAAL-DOC-LINK-1 document link', () => {
  it('picking a document PATCHes the per-item language relation with document_id (never the candidate payload)', async () => {
    const user = userEvent.setup()
    const onEditSave = vi.fn()
    render(<LanguagesSection c={candidate} onEditSave={onEditSave} />)
    await user.click(screen.getByTitle('common:edit'))

    await user.click(screen.getByRole('button', { name: /addFields\.linkedDocument/ }))
    await user.click(await screen.findByRole('button', { name: 'taalcertificaat.pdf' }))
    await user.click(screen.getByTitle('common:save'))

    // The REAL request: the relation route, with the document id in the body.
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith('/candidates/c1/languages/l1', { document_id: 'd1' }, { quietStatuses: [422] })
    // …and the bulk language payload is unchanged — it never carries the link.
    expect(onEditSave).toHaveBeenCalledWith({
      languages: [{ id: 'l1', language: 'Nederlands', spoken: 'Vloeiend', written: 'Vloeiend' }],
    })
  })

  it('clearing an existing link PATCHes document_id: null', async () => {
    const user = userEvent.setup()
    const linked = {
      id: 'c1', documents: [doc],
      languages: [{ id: 'l1', language: 'Nederlands', spoken: 'Vloeiend', written: 'Vloeiend', document_id: 'd1' }],
    } as unknown as Candidate
    render(<LanguagesSection c={linked} onEditSave={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    // The picker's own clear affordance (clearLabel-composed name, so it is not the
    // bare "clear" the taal/niveau pickers show).
    await user.click(screen.getByTitle('clearField'))
    await user.click(screen.getByTitle('common:save'))

    expect(patch).toHaveBeenCalledWith('/candidates/c1/languages/l1', { document_id: null }, { quietStatuses: [422] })
  })

  it('saving without touching the link fires NO relation PATCH at all', async () => {
    const user = userEvent.setup()
    render(<LanguagesSection c={candidate} onEditSave={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('common:save'))
    expect(patch).not.toHaveBeenCalled()
  })

  it('offers no document picker on a NOT-yet-persisted row (no id a relation PATCH could target)', async () => {
    const user = userEvent.setup()
    render(<LanguagesSection c={{ id: 'c1', languages: [], documents: [doc] } as unknown as Candidate} onEditSave={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'addFields.language' }))
    expect(screen.queryByRole('button', { name: /addFields\.linkedDocument/ })).toBeNull()
  })

  it('offers no document picker when the candidate has no documents (no picker resolving to nothing)', async () => {
    const user = userEvent.setup()
    render(<LanguagesSection c={{ id: 'c1', languages: candidate.languages, documents: [] } as unknown as Candidate} onEditSave={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    expect(screen.queryByRole('button', { name: /addFields\.linkedDocument/ })).toBeNull()
  })

  it('shows preview + download actions on a linked language chip, and downloads the in-app stream url', async () => {
    const user = userEvent.setup()
    const linked = {
      id: 'c1', documents: [doc],
      languages: [{ id: 'l1', language: 'Nederlands', spoken: 'Vloeiend', written: 'Vloeiend', document_id: 'd1' }],
    } as unknown as Candidate
    render(<LanguagesSection c={linked} onEditSave={vi.fn()} />)
    await user.click(screen.getByLabelText('documents.download'))
    expect(downloadFiles).toHaveBeenCalledWith([{ url: '/api/candidates/c1/documents/d1/download', name: 'taalcertificaat.pdf' }])
    // The preview opens the shared house modal (never a fork) on the same document.
    await user.click(screen.getByLabelText('documents.preview'))
    expect(await screen.findByText('taalcertificaat.pdf')).toBeInTheDocument()
  })

  it('renders no document actions on an UNLINKED language chip', () => {
    render(<LanguagesSection c={candidate} onEditSave={vi.fn()} />)
    expect(screen.queryByLabelText('documents.preview')).toBeNull()
    expect(screen.queryByLabelText('documents.download')).toBeNull()
  })
})

/**
 * DOC-1-EIGENAAR-1 (Danny 08-08 punt 6). MEASURED live: a document that already hangs
 * on another entry is refused with 422 — so it must not be offered here either. This
 * row's own document stays in the list, and a pick on one row disappears from the
 * other rows' lists straight away (both would otherwise 422 on save).
 */
describe('LanguagesSection · DOC-1-EIGENAAR-1 only still-free documents are offered', () => {
  const free = { id: 'd-free', name: 'vrij.pdf' }
  const taken = { id: 'd-taken', name: 'bezet.pdf', skill_id: 's9' }

  it('leaves out a document another entry already claims', async () => {
    const user = userEvent.setup()
    const c = {
      id: 'c1', documents: [free, taken],
      languages: [{ id: 'l1', language: 'Nederlands', spoken: '', written: '' }],
    } as unknown as Candidate
    render(<LanguagesSection c={c} onEditSave={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    // The trigger's accessible name is the sr-only field label + its own text.
    await user.click(screen.getByRole('button', { name: /addFields\.linkedDocumentFor/ }))
    expect(screen.queryByRole('button', { name: 'bezet.pdf' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'vrij.pdf' })).toBeInTheDocument()
  })

  it('keeps THIS row’s own linked document in its list, so the pick stays switchable', async () => {
    const user = userEvent.setup()
    const own = { id: 'd-own', name: 'eigen.pdf', language_id: 'l1' }
    const c = {
      id: 'c1', documents: [free, own],
      languages: [{ id: 'l1', language: 'Nederlands', spoken: '', written: '', document_id: 'd-own' }],
    } as unknown as Candidate
    render(<LanguagesSection c={c} onEditSave={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByRole('button', { name: /eigen\.pdf/ }))
    expect(await screen.findByRole('button', { name: 'vrij.pdf' })).toBeInTheDocument()
  })

  it('a pick on one row disappears from the OTHER row’s list immediately (no double-claim)', async () => {
    const user = userEvent.setup()
    const c = {
      id: 'c1', documents: [free],
      languages: [
        { id: 'l1', language: 'Nederlands', spoken: '', written: '' },
        { id: 'l2', language: 'Engels', spoken: '', written: '' },
      ],
    } as unknown as Candidate
    render(<LanguagesSection c={c} onEditSave={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    // Both rows still offer vrij.pdf; pick it on row 1.
    expect(screen.getAllByRole('button', { name: /addFields\.linkedDocumentFor/ })).toHaveLength(2)
    await user.click(screen.getAllByRole('button', { name: /addFields\.linkedDocumentFor/ })[0])
    await user.click(await screen.findByRole('button', { name: 'vrij.pdf' }))
    // Row 2 now has nothing left to offer, so its picker is gone entirely — only
    // row 1's own (now showing "vrij.pdf") remains.
    expect(screen.getAllByRole('button', { name: /addFields\.linkedDocumentFor/ })).toHaveLength(1)
  })
})
