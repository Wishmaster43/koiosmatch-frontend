/**
 * LanguagesSection —
 * (1) G34 regression: the taal/gesproken/schriftelijk pickers are the house
 *     `CreatableSelect` (allowCreate={false}), never a native <select>.
 * (2) ENT1-03 (FE-BE contract audit 09-09): language + levels + document link persist
 *     through the PER-ITEM routes — POST/PATCH/DELETE /candidates/{c}/languages[/{id}]
 *     with `spoken_level`/`written_level` — never the candidate-level PATCH, which
 *     dropped `languages` silently (200, nothing stored). Every assertion reads the
 *     REAL request (method + route + body) and the drawer merge gets the RETURNED
 *     levels, never the typed ones.
 * (3) TAAL-DOC-LINK-1 (Danny 08-08 "Talen: kan ik nog geen document koppelen"): the
 *     proof-document link rides in the same per-item body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguagesSection from './LanguagesSection'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/useLanguageLookups', () => ({
  useLanguageLookups: () => ({ languages: ['Nederlands', 'Engels'], levels: ['Basis', 'Vloeiend'] }),
}))

// The shared axios client — the per-item writes are what the assertions read. `get`
// keeps the document-type lookup inside DocPreviewModal quiet; unwrap stays REAL.
const { patch, post, del, downloadFiles, notifyError } = vi.hoisted(() => ({
  patch: vi.fn(),
  post: vi.fn(),
  del: vi.fn(() => Promise.resolve({ data: null })),
  downloadFiles: vi.fn(() => Promise.resolve()),
  notifyError: vi.fn(),
}))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { patch, post, delete: del, get: vi.fn(() => Promise.resolve({ data: { data: [] } })) }, getActiveTenantId: () => 'demo' }
})
vi.mock('@/lib/notify', () => ({ notifyError }))
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: downloadFiles }))

const doc = { id: 'd1', name: 'taalcertificaat.pdf', url: '/api/candidates/c1/documents/d1/download' }
const candidate = {
  id: 'c1',
  languages: [{ id: 'l1', language: 'Nederlands', spoken: 'Vloeiend', written: 'Vloeiend' }],
  documents: [doc],
} as unknown as Candidate

// The measured per-item response: the resource row (id + wire level names).
const serverRow = (over: Record<string, unknown> = {}) =>
  ({ data: { id: 'l1', language: 'Nederlands', spoken_level: 'Vloeiend', written_level: 'Vloeiend', document_id: null, ...over } })

beforeEach(() => {
  vi.clearAllMocks()
  patch.mockResolvedValue(serverRow())
  post.mockResolvedValue({ data: { id: 'l-new', language: 'Nederlands', spoken_level: 'Vloeiend', written_level: 'Basis', document_id: null } })
})

describe('LanguagesSection · pickers are the house CreatableSelect, not a native <select>', () => {
  it('renders no native <select> once editing', async () => {
    const user = userEvent.setup()
    const { container } = render(<LanguagesSection c={candidate} onSaved={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    expect(container.querySelector('select')).toBeNull()
  })
})

describe('LanguagesSection · per-item routes (ENT1-03)', () => {
  it('changing an existing row PATCHes /candidates/{c}/languages/{id} with the wire level names and merges the RETURNED row', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    patch.mockResolvedValue(serverRow({ language: 'Engels', spoken_level: 'Basis' }))
    render(<LanguagesSection c={candidate} onSaved={onSaved} />)
    await user.click(screen.getByTitle('common:edit'))

    await user.click(screen.getByRole('button', { name: 'Nederlands' }))
    await user.click(await screen.findByRole('button', { name: 'Engels' }))
    await user.click(screen.getByTitle('common:save'))

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/candidates/c1/languages/l1',
      { language: 'Engels', spoken_level: 'Vloeiend', written_level: 'Vloeiend', document_id: null }, { quietStatuses: [422] }))
    expect(post).not.toHaveBeenCalled()
    // The drawer merge carries the server's levels (spoken Basis came BACK, not typed).
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ languages: [
      expect.objectContaining({ id: 'l1', language: 'Engels', spoken: 'Basis', written: 'Vloeiend', spoken_level: 'Basis' }),
    ] }))
  })

  it('a fresh row POSTs /candidates/{c}/languages and the merge carries the new id', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<LanguagesSection c={{ id: 'c1', languages: [] } as unknown as Candidate} onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: 'addFields.language' }))

    const langTriggers = screen.getAllByRole('button', { name: 'addFields.language' })
    await user.click(langTriggers[langTriggers.length - 1])
    await user.click(await screen.findByRole('button', { name: 'Nederlands' }))
    await user.click(screen.getByRole('button', { name: 'addFields.spokenLevel' }))
    await user.click(await screen.findByRole('button', { name: 'Vloeiend' }))
    await user.click(screen.getByRole('button', { name: 'addFields.writtenLevel' }))
    await user.click(await screen.findByRole('button', { name: 'Basis' }))
    await user.click(screen.getByTitle('common:save'))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/c1/languages',
      { language: 'Nederlands', spoken_level: 'Vloeiend', written_level: 'Basis', document_id: null }, { quietStatuses: [422] }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ languages: [expect.objectContaining({ id: 'l-new', spoken: 'Vloeiend', written: 'Basis' })] }))
  })

  it('removing a row DELETEs its per-item route and drops it from the merge', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<LanguagesSection c={candidate} onSaved={onSaved} />)
    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('common:remove'))
    await user.click(screen.getByTitle('common:save'))

    await waitFor(() => expect(del).toHaveBeenCalledWith('/candidates/c1/languages/l1', { quietStatuses: [422] }))
    expect(patch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ languages: [] }))
  })

  it('saving without touching anything sends NO request at all', async () => {
    const user = userEvent.setup()
    render(<LanguagesSection c={candidate} onSaved={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('common:save'))
    expect(patch).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('a refused write keeps the editor open with the server reason, and the merge keeps the previous row', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    patch.mockRejectedValue({ response: { status: 422, data: { message: 'Niveau bestaat niet.' } } })
    render(<LanguagesSection c={candidate} onSaved={onSaved} />)
    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByRole('button', { name: 'Nederlands' }))
    await user.click(await screen.findByRole('button', { name: 'Engels' }))
    await user.click(screen.getByTitle('common:save'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Niveau bestaat niet.'))
    // Still editing (the save button is the edit-mode footer), the typed value kept.
    expect(screen.getByTitle('common:save')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Engels' })).toBeInTheDocument()
    expect(onSaved).toHaveBeenCalledWith({ languages: [expect.objectContaining({ id: 'l1', language: 'Nederlands' })] })
  })
})

/**
 * KAND-ACHTERGROND-VERPLICHT-1 (2026-08-17): `language` is required on create
 * (CandidateLanguageController::rules) — a row with content but no language is never
 * silently dropped: the Taal column carries the asterisk and Save blocks (no request)
 * until the language is picked.
 */
describe('LanguagesSection · language is required (KAND-ACHTERGROND-VERPLICHT-1)', () => {
  it('marks the Taal column required, blocks Save on a row with content but no language, then POSTs once it is picked', async () => {
    const user = userEvent.setup()
    render(<LanguagesSection c={{ id: 'c1', languages: [] } as unknown as Candidate} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'addFields.language' }))

    const captionLabel = screen.getAllByText('addFields.language').find(el => el.tagName === 'LABEL')
    expect(captionLabel).toBeDefined()
    expect(captionLabel!.textContent).toContain('*')

    await user.click(screen.getByRole('button', { name: 'addFields.spokenLevel' }))
    await user.click(await screen.findByRole('button', { name: 'Vloeiend' }))

    await user.click(screen.getByTitle('common:save'))
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    const langTriggers = screen.getAllByRole('button', { name: 'addFields.language' })
    await user.click(langTriggers[langTriggers.length - 1])
    await user.click(await screen.findByRole('button', { name: 'Nederlands' }))
    await user.click(screen.getByTitle('common:save'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/c1/languages',
      { language: 'Nederlands', spoken_level: 'Vloeiend', written_level: null, document_id: null }, { quietStatuses: [422] }))
  })

  it('still discards a row with NOTHING filled at all as a harmless no-op (no request)', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<LanguagesSection c={{ id: 'c1', languages: [] } as unknown as Candidate} onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: 'addFields.language' }))
    await user.click(screen.getByTitle('common:save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ languages: [] }))
    expect(post).not.toHaveBeenCalled()
  })
})

describe('LanguagesSection · TAAL-DOC-LINK-1 document link', () => {
  it('picking a document rides in the per-item PATCH body as document_id', async () => {
    const user = userEvent.setup()
    patch.mockResolvedValue(serverRow({ document_id: 'd1' }))
    render(<LanguagesSection c={candidate} onSaved={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))

    await user.click(screen.getByRole('button', { name: /addFields\.linkedDocument/ }))
    await user.click(await screen.findByRole('button', { name: 'taalcertificaat.pdf' }))
    await user.click(screen.getByTitle('common:save'))

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    expect(patch).toHaveBeenCalledWith('/candidates/c1/languages/l1', expect.objectContaining({ document_id: 'd1' }), { quietStatuses: [422] })
  })

  it('clearing an existing link PATCHes document_id: null', async () => {
    const user = userEvent.setup()
    const linked = {
      id: 'c1', documents: [doc],
      languages: [{ id: 'l1', language: 'Nederlands', spoken: 'Vloeiend', written: 'Vloeiend', document_id: 'd1' }],
    } as unknown as Candidate
    render(<LanguagesSection c={linked} onSaved={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('clearField'))
    await user.click(screen.getByTitle('common:save'))

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/candidates/c1/languages/l1', expect.objectContaining({ document_id: null }), { quietStatuses: [422] }))
  })

  it('offers no document picker on a NOT-yet-persisted row (no id a relation PATCH could target)', async () => {
    const user = userEvent.setup()
    render(<LanguagesSection c={{ id: 'c1', languages: [], documents: [doc] } as unknown as Candidate} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'addFields.language' }))
    expect(screen.queryByRole('button', { name: /addFields\.linkedDocument/ })).toBeNull()
  })

  it('offers no document picker when the candidate has no documents (no picker resolving to nothing)', async () => {
    const user = userEvent.setup()
    render(<LanguagesSection c={{ id: 'c1', languages: candidate.languages, documents: [] } as unknown as Candidate} onSaved={vi.fn()} />)
    await user.click(screen.getByTitle('common:edit'))
    expect(screen.queryByRole('button', { name: /addFields\.linkedDocument/ })).toBeNull()
  })
})
