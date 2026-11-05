/** BackgroundTab · document links and reference experience round-trips (split from BackgroundTab.test.tsx; real i18n nl). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackgroundTab from './BackgroundTab'
import type { Candidate } from '@/types/candidate'

// Resolve (never reject) empty lists: useSkillLevels/useLanguageLookups build on
// the shared useCachedLookup, which chains an un-caught `.finally()` on the raw
// request promise — a rejection there surfaces as an unhandled rejection warning
// unrelated to anything under test here.
vi.mock('@/lib/api', () => ({
  getActiveTenantId: () => 'demo',
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notify: vi.fn() }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

import api from '@/lib/api'

const candidate = (): Candidate => ({ id: 1, experiences: [], educations: [], certifications: [], skills: [], languages: [] } as unknown as Candidate)

/**
 * DOC-ENTRY-LINK-1: the "Koppelen aan" edit-form picker (BackgroundTab's own
 * TO_API mapping) round-trips document_id into the real PATCH body — §13:
 * assert the REQUEST, not merely that onEdit-style state updated.
 */
describe('BackgroundTab · DOC-ENTRY-LINK-1 document_id round-trips through the entry PATCH', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } })
  })

  it('education: relinking to a different document PATCHes the education route with the new document_id', async () => {
    const user = userEvent.setup()
    const c = {
      ...candidate(),
      educations: [{ id: 'e1', title: 'Verpleegkunde', school: 'ROC', document_id: 'doc1' }],
      documents: [{ id: 'doc1', name: 'oud.pdf' }, { id: 'doc2', name: 'nieuw.pdf' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Opleiding' }))
    await user.click(screen.getByTitle('Bewerken'))
    // ALWAYS-SEARCHABLE-1 (Danny 08-08): the document_id picker is the house
    // CreatableSelect — open it by its currently-picked value ("oud.pdf"); level_id
    // (KAND-NIVEAU-1) is the OTHER combobox in this form and stays untouched here.
    await user.click(screen.getByRole('button', { name: 'oud.pdf' }))
    await user.click(await screen.findByRole('button', { name: 'nieuw.pdf' }))
    await user.click(screen.getByTitle('Opslaan'))
    expect(api.patch).toHaveBeenCalledWith('/candidates/1/educations/e1', expect.objectContaining({ document_id: 'doc2' }), { quietStatuses: [422] })
  })

  it('certification: relinking PATCHes the certification route with the new document_id', async () => {
    const user = userEvent.setup()
    const c = {
      ...candidate(),
      certifications: [{ id: 'c1', name: 'VCA Basis', document_id: 'doc1' }],
      documents: [{ id: 'doc1', name: 'oud.pdf' }, { id: 'doc2', name: 'nieuw.pdf' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Certificeringen' }))
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByRole('button', { name: 'oud.pdf' }))
    await user.click(await screen.findByRole('button', { name: 'nieuw.pdf' }))
    await user.click(screen.getByTitle('Opslaan'))
    expect(api.patch).toHaveBeenCalledWith('/candidates/1/certifications/c1', expect.objectContaining({ document_id: 'doc2' }), { quietStatuses: [422] })
  })

  it('unlinking (via the picker\'s own clear affordance) PATCHes document_id: null, never an empty string', async () => {
    const user = userEvent.setup()
    const c = {
      ...candidate(),
      educations: [{ id: 'e1', title: 'Verpleegkunde', document_id: 'doc1' }],
      documents: [{ id: 'doc1', name: 'oud.pdf' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Opleiding' }))
    await user.click(screen.getByTitle('Bewerken'))
    // ALWAYS-SEARCHABLE-1: unset via CreatableSelect's own `clearable` X — the
    // house replacement for the old native select's blank "unset" option.
    await user.click(screen.getByTitle('Wissen'))
    await user.click(screen.getByTitle('Opslaan'))
    expect(api.patch).toHaveBeenCalledWith('/candidates/1/educations/e1', expect.objectContaining({ document_id: null }), { quietStatuses: [422] })
  })
})

/**
 * DOC-1-EIGENAAR-1 (Danny 08-08 punt 6). MEASURED live 08-08: PATCHing an entry with a
 * `document_id` that already hangs elsewhere answers 422 "Dit document is al aan een
 * ander onderdeel gekoppeld." — so a claimed document must not be offered at all. The
 * row's OWN document stays in the list, otherwise the current pick becomes invisible.
 * Asserted through the REAL edit form of all four claimable sections (§13).
 */
describe('BackgroundTab · DOC-1-EIGENAAR-1 the picker only offers still-free documents', () => {
  // vrij.pdf is unclaimed; bezet.pdf already hangs on ANOTHER entry (reverse FK), and
  // eigen.pdf is the one the row under test holds itself.
  const documents = [
    { id: 'doc-free', name: 'vrij.pdf' },
    { id: 'doc-taken', name: 'bezet.pdf', certification_id: 'other-cert' },
    { id: 'doc-own', name: 'eigen.pdf' },
  ]

  const openEditor = async (tab: string, c: Candidate) => {
    const user = userEvent.setup()
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: tab }))
    await user.click(screen.getByTitle('Bewerken'))
    // The document picker's trigger shows the row's current pick ("eigen.pdf").
    await user.click(screen.getByRole('button', { name: 'eigen.pdf' }))
    return user
  }

  it('education: hides a document another entry already claims, keeps the free one and its own', async () => {
    await openEditor('Opleiding', {
      ...candidate(),
      educations: [{ id: 'e1', title: 'Verpleegkunde', document_id: 'doc-own' }],
      documents,
    } as unknown as Candidate)
    expect(screen.queryByRole('button', { name: 'bezet.pdf' })).toBeNull()
    expect(screen.getByRole('button', { name: 'vrij.pdf' })).toBeInTheDocument()
  })

  it('certification: same rule', async () => {
    await openEditor('Certificeringen', {
      ...candidate(),
      certifications: [{ id: 'c1', name: 'VCA Basis', document_id: 'doc-own' }],
      documents,
    } as unknown as Candidate)
    expect(screen.queryByRole('button', { name: 'bezet.pdf' })).toBeNull()
    expect(screen.getByRole('button', { name: 'vrij.pdf' })).toBeInTheDocument()
  })

  it('skill: same rule (and the picker is fed at all — documents used to never reach it)', async () => {
    await openEditor('Vaardigheden', {
      ...candidate(),
      skills: [{ id: 's1', name: 'BHV', level: '', document_id: 'doc-own' }],
      documents,
    } as unknown as Candidate)
    expect(screen.queryByRole('button', { name: 'bezet.pdf' })).toBeNull()
    expect(screen.getByRole('button', { name: 'vrij.pdf' })).toBeInTheDocument()
  })

  it('reference: same rule', async () => {
    await openEditor('Referenties', {
      ...candidate(),
      references: [{ id: 'r1', first_name: 'Jan', last_name: 'de Vries', document_id: 'doc-own' }],
      documents,
    } as unknown as Candidate)
    expect(screen.queryByRole('button', { name: 'bezet.pdf' })).toBeNull()
    expect(screen.getByRole('button', { name: 'vrij.pdf' })).toBeInTheDocument()
  })

  it('hides a document a SIBLING row in the same section claimed, per row', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={{
      ...candidate(),
      certifications: [
        { id: 'c1', name: 'VCA Basis', document_id: 'doc-own' },
        { id: 'c2', name: 'BIG', document_id: 'doc-free' },
      ],
      documents,
    } as unknown as Candidate} />)
    await user.click(screen.getByRole('tab', { name: 'Certificeringen' }))
    // Edit the FIRST row: vrij.pdf is taken by its sibling, so it must not be offered.
    await user.click(screen.getAllByTitle('Bewerken')[0])
    await user.click(screen.getByRole('button', { name: 'eigen.pdf' }))
    expect(screen.queryByRole('button', { name: 'vrij.pdf' })).toBeNull()
  })

  it('drops the picker entirely when the candidate has no documents (no empty dropdown)', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={{
      ...candidate(),
      certifications: [{ id: 'c1', name: 'VCA Basis' }],
      documents: [],
    } as unknown as Candidate} />)
    await user.click(screen.getByRole('tab', { name: 'Certificeringen' }))
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.queryByPlaceholderText('Gekoppeld document')).toBeNull()
  })
})

/**
 * REF-ERVARING-1 (Danny 08-08 punt 4) — the reference ↔ work-experience link, now
 * that the backend carries it (commit d6eb75cb). MEASURED live 09-08 against
 * koiosmatch-api.test (X-Tenant: yesway): `PATCH /candidates/{c}/references/{r}`
 * with a `work_experience_id` of THIS candidate's own experience answers 200 and a
 * fresh GET echoes the id plus a nested `work_experience`; another candidate's
 * experience is rejected 422 (IDOR-safe); `null` unlinks. The full probe log lives
 * in referenceExperienceLink.tsx's header — every probe row was deleted again.
 *
 * §13: these assert the REQUEST (route + body), not merely that a callback fired —
 * ReferencesTab.test.tsx owns the presentation side.
 */
describe('BackgroundTab · REF-ERVARING-1 work_experience_id round-trips through the reference PATCH', () => {
  // The picker's visible name is its (still unreported) i18n key until the manager
  // lands it in the locale files — match either form (§5).
  const PICKER = /workExperience|Werkervaring/i
  const experiences = [{ id: 'exp-1', title: 'Helpende', company: 'Zorggroep X', start: '2023-08-06', end: null, current: true }]

  beforeEach(() => {
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } })
  })

  it('linking a reference to a work experience PATCHes the reference route with the experience id', async () => {
    const user = userEvent.setup()
    const c = {
      ...candidate(),
      experiences,
      references: [{ id: 'r1', first_name: 'Jan', last_name: 'Jansen' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Referenties' }))
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByRole('button', { name: PICKER }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep X · Helpende · 06-08-2023 – heden' }))
    await user.click(screen.getByTitle('Opslaan'))
    expect(api.patch).toHaveBeenCalledWith('/candidates/1/references/r1', expect.objectContaining({ work_experience_id: 'exp-1' }), { quietStatuses: [422] })
  })

  it('unlinking (the picker\'s own clear affordance) PATCHes work_experience_id: null, never an empty string', async () => {
    const user = userEvent.setup()
    const c = {
      ...candidate(),
      experiences,
      references: [{ id: 'r1', first_name: 'Jan', last_name: 'Jansen', work_experience_id: 'exp-1' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Referenties' }))
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Wissen'))
    await user.click(screen.getByTitle('Opslaan'))
    expect(api.patch).toHaveBeenCalledWith('/candidates/1/references/r1', expect.objectContaining({ work_experience_id: null }), { quietStatuses: [422] })
  })

  it('sends work_experience_id: null for a reference that was never linked (no empty string reaches the API)', async () => {
    const user = userEvent.setup()
    const c = {
      ...candidate(),
      experiences,
      references: [{ id: 'r1', first_name: 'Jan', last_name: 'Jansen' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Referenties' }))
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Opslaan'))
    expect(api.patch).toHaveBeenCalledWith('/candidates/1/references/r1', expect.objectContaining({ work_experience_id: null }), { quietStatuses: [422] })
  })
})
