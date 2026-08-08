/**
 * BackgroundTab — Achtergrond tab sub-tab regression tests (Danny
 * kandidaten-ronde-2, punt B). Real i18n (nl) runs here — SectionTabs (imported
 * transitively) pulls in the real @/i18n side-effect init, so `t()` resolves
 * genuine Dutch text (mirrors SectionTabs.test.tsx). Only the Tiptap
 * RichTextEditor is stubbed; the lookup hooks' own GETs (skills/languages) are
 * covered by mocking `@/lib/api` so no real network call fires.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackgroundTab from './BackgroundTab'
import type { Candidate } from '@/types/candidate'

// Resolve (never reject) empty lists: useSkillLevels/useLanguageLookups build on
// the shared useCachedLookup, which chains an un-caught `.finally()` on the raw
// request promise — a rejection there surfaces as an unhandled rejection warning
// unrelated to anything under test here.
vi.mock('@/lib/api', () => ({
  getActiveTenantId: () => 'demo',
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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
import { notifyError } from '@/lib/notify'

const candidate = (): Candidate => ({ id: 1, experiences: [], educations: [], certifications: [], skills: [], languages: [] } as unknown as Candidate)

describe('BackgroundTab · sub-tabs (kandidaten-ronde-2, punt B)', () => {
  it('renders exactly one sub-tab per section, sorted alphabetically by translated label', () => {
    render(<BackgroundTab c={candidate()} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    // Dutch alphabetical order: Certificeringen · Ervaring · Opleiding · Referenties
    // (KAND-REFERENTIES-1, defaultValue-rendered until the key lands in nl.json) ·
    // Talen · Vaardigheden.
    expect(tabs).toEqual(['Certificeringen', 'Ervaring', 'Opleiding', 'Referenties', 'Talen', 'Vaardigheden'])
  })

  it('defaults the open sub-tab to Ervaring, not the first alphabetically (Certificeringen)', () => {
    render(<BackgroundTab c={candidate()} />)
    expect(screen.getByRole('tab', { name: 'Ervaring' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Nog geen ervaringen.')).toBeInTheDocument()
    expect(screen.queryByText('Nog geen certificeringen.')).toBeNull()
  })

  it('Talen renders as its own sub-tab (moved here, same LanguagesSection)', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Talen' }))
    expect(screen.getByText('Nog geen talen.')).toBeInTheDocument()
    // Switching away hides the previously-default Ervaring content.
    expect(screen.queryByText('Nog geen ervaringen.')).toBeNull()
  })

  it('Certificeringen renders on its own sub-tab', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Certificeringen' }))
    expect(screen.getByText('Nog geen certificeringen.')).toBeInTheDocument()
  })

  it('Referenties renders on its own sub-tab (KAND-REFERENTIES-1)', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Referenties' }))
    expect(screen.getByText('Nog geen referenties.')).toBeInTheDocument()
  })
})

/**
 * KAND-REFERENTIES-1: BackgroundTab owns the actual verify REQUEST (§13 — assert
 * method/route, never only that a callback fired) — ReferencesTab.test.tsx covers
 * the presentational badge/action swap in isolation with a stub onVerify.
 */
describe('BackgroundTab · references verify wiring (KAND-REFERENTIES-1)', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
  })

  it('verify POSTs the real route and merges the returned verified_at into the row', async () => {
    const user = userEvent.setup()
    // This file's own `unwrap` mock is the identity function (see the vi.mock
    // block above) — so the resolved value IS the already-unwrapped item, not an
    // axios-response envelope.
    vi.mocked(api.post).mockResolvedValue({ id: 'r1', verified_at: '2026-08-01T10:00:00Z', verified_by: 'u1' })
    const c = {
      ...candidate(),
      references: [{ id: 'r1', first_name: 'Jan', last_name: 'Jansen', relation: { id: 'rel-1', label: 'Manager' }, employer: 'Zorggroep X' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Referenties' }))
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()

    await user.click(screen.getByTitle('Verifiëren'))
    expect(api.post).toHaveBeenCalledWith('/candidates/1/references/r1/verify')
    await waitFor(() => expect(screen.getByText(/Geverifieerd/)).toBeInTheDocument())
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })

  it('does not offer verify for an unpersisted (temp id) row', async () => {
    const user = userEvent.setup()
    // The add flow's own POST never needs to resolve for this assertion — just
    // must not reject synchronously (undefined has no .then otherwise). Identity
    // `unwrap` (see the vi.mock block above) means this value IS the "item".
    vi.mocked(api.post).mockResolvedValue({})
    const c = { ...candidate(), references: [] } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Referenties' }))
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    await user.type(screen.getByPlaceholderText('Voornaam'), 'Piet')
    await user.type(screen.getByPlaceholderText('Achternaam'), 'Pietersen')
    fireEvent.click(screen.getByTitle('Opslaan'))
    // The optimistic row (negative temp id) renders with no verify action at all.
    expect(screen.getByText('Piet Pietersen')).toBeInTheDocument()
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })
})

// Bug-class fix (optimistic-revert audit): onAdd/onEdit/onRemove used to fail
// soft — a rejected request left the optimistic write sitting on screen with
// only a toast, so the recruiter believed it had saved. These tests assert the
// actual rendered value snaps back after a rejected request, not merely that a
// toast fired (§13). Skills is the simplest sub-tab (no ProseField description,
// so a single 'Bewerken' pencil per row) — used throughout to keep the DOM
// queries unambiguous.
describe('BackgroundTab · ops() optimistic-revert (onAdd/onEdit/onRemove)', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.delete).mockReset()
    vi.mocked(notifyError).mockClear()
  })

  it('onAdd: drops the orphaned temp row when the POST rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValue(new Error('network'))
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Vaardigheden' }))
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    await user.type(screen.getByPlaceholderText('Vaardigheid'), 'Excel')
    // fireEvent (not userEvent): the mocked POST rejects on the SAME microtask
    // tick as the click — awaiting a userEvent click gives that catch handler
    // enough ticks to run before control returns, so the optimistic row would
    // already be gone by the time we could observe it. A plain synchronous
    // fireEvent.click lets us assert the optimistic state BEFORE the promise
    // settles, then waitFor drains the microtask queue for the revert.
    fireEvent.click(screen.getByTitle('Opslaan'))

    // Optimistic row appears immediately.
    expect(screen.getByText('Excel')).toBeInTheDocument()
    // The old bug: a rejected POST left this orphan row on screen forever.
    await waitFor(() => expect(screen.queryByText('Excel')).toBeNull())
    expect(notifyError).toHaveBeenCalled()
  })

  it('onEdit: restores the exact previous row when the PATCH rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockRejectedValue(new Error('network'))
    const c = { ...candidate(), skills: [{ id: 's1', name: 'Excel', level: '' }] } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Vaardigheden' }))
    expect(screen.getByText('Excel')).toBeInTheDocument()

    await user.click(screen.getByTitle('Bewerken'))
    const input = screen.getByDisplayValue('Excel')
    await user.clear(input)
    await user.type(input, 'Excel Advanced')
    // fireEvent (see onAdd comment above): keeps the optimistic write observable
    // before the mocked-rejected PATCH's catch handler runs.
    fireEvent.click(screen.getByTitle('Opslaan'))

    // Optimistic edit shows immediately.
    expect(screen.getByText('Excel Advanced')).toBeInTheDocument()
    // The old bug: a rejected PATCH left the edited value on screen forever.
    await waitFor(() => expect(screen.getByText('Excel')).toBeInTheDocument())
    expect(screen.queryByText('Excel Advanced')).toBeNull()
    expect(notifyError).toHaveBeenCalled()
  })

  it('onRemove: re-inserts the removed row at its original index when the DELETE rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(api.delete).mockRejectedValue(new Error('network'))
    const c = {
      ...candidate(),
      skills: [{ id: 's1', name: 'Excel', level: '' }, { id: 's2', name: 'Word', level: '' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Vaardigheden' }))
    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.getByText('Word')).toBeInTheDocument()

    // fireEvent (see onAdd comment above): keeps the optimistic removal
    // observable before the mocked-rejected DELETE's catch handler runs.
    fireEvent.click(screen.getAllByTitle('Verwijderen')[0])
    // Optimistic remove: gone immediately.
    expect(screen.queryByText('Excel')).toBeNull()
    // The old bug: a rejected DELETE left the row permanently gone with only a toast.
    await waitFor(() => expect(screen.getByText('Excel')).toBeInTheDocument())
    // The OTHER row was never part of this mutation — a whole-list snapshot
    // restore would still leave it untouched here, but a bulk-loop scenario
    // (mirrors useEntityDocuments.remove) is exactly what surgical re-insert guards.
    expect(screen.getByText('Word')).toBeInTheDocument()
    expect(notifyError).toHaveBeenCalled()
  })
})

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
 * DOC-1-EIGENAAR-1 punt 5 (het vangnet): even with a correct picker the 422 can still
 * happen (a second tab, a stale list). The recruiter must then read the SERVER's own
 * reason, never a generic "actie mislukt" — and api.ts's dev diagnostic toast is
 * silenced for 422 so it cannot bury it (quietStatuses, asserted above).
 */
describe('BackgroundTab · a 422 surfaces the server’s readable reason', () => {
  it('shows the backend guard’s message instead of the generic fallback', async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.patch).mockRejectedValue({
      response: { status: 422, data: { message: 'Dit document is al aan een ander onderdeel gekoppeld.', errors: { document_id: ['Dit document is al aan een ander onderdeel gekoppeld.'] } } },
    })
    vi.mocked(notifyError).mockClear()
    render(<BackgroundTab c={{
      ...candidate(),
      certifications: [{ id: 'c1', name: 'VCA Basis' }],
      documents: [{ id: 'doc-free', name: 'vrij.pdf' }],
    } as unknown as Candidate} />)
    await user.click(screen.getByRole('tab', { name: 'Certificeringen' }))
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByRole('button', { name: 'Gekoppeld document' }))
    await user.click(await screen.findByRole('button', { name: 'vrij.pdf' }))
    await user.click(screen.getByTitle('Opslaan'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Dit document is al aan een ander onderdeel gekoppeld.'))
  })
})
