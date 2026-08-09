/**
 * ReferencesTab — REFERENTIE-VELDEN-1 regression tests. Real i18n (nl) runs
 * here — `useDateFormat` (imported transitively) pulls in the real @/i18n
 * side-effect init, so `t()` resolves genuine Dutch text where a key exists,
 * else its own `t(key, { defaultValue })` fallback (mirrors
 * SectionTabs.test.tsx/BackgroundTab.test.tsx — new keys reported to the
 * manager, house rule: never edit src/i18n/locales/**). Only the Tiptap
 * RichTextEditor is stubbed, same as its siblings. `useReferenceRelations` is
 * mocked directly (own hook, own test — a thin useCachedLookup wrapper, same
 * convention WorkPermitBlock.test.tsx uses for useWorkPermitTypes) so these
 * tests never depend on a real network call.
 *
 * §13 scope note: BackgroundTab.tsx's `TO_API.references` mapper passes every
 * field below through unchanged — ReferenceResource's own keys already match this
 * form's field keys 1:1 — except that the nullable FKs (`relation_id`,
 * `document_id`, `work_experience_id`) turn an emptied picker into `null` rather
 * than `''`. So the onAdd/onEdit payloads asserted here are the request body, with
 * that one documented exception; the real axios calls are asserted in
 * BackgroundTab.test.tsx (DOC-ENTRY-LINK-1 and REF-ERVARING-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReferencesTab from './ReferencesTab'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

// Own hook, own test (useReferenceRelations.test.ts) — mocked directly here so
// this component's tests don't depend on its network call. Ids are
// deliberately NOT the seeded slugs (proves the save path sends the row id,
// never the label/slug — the hook's own file header contract).
vi.mock('@/lib/useReferenceRelations', () => ({
  useReferenceRelations: () => ({
    referenceRelations: [
      { id: 'rel-uuid-1', value: 'manager', label: 'Manager' },
      { id: 'rel-uuid-2', value: 'collega', label: 'Collega' },
    ],
  }),
}))

describe('ReferencesTab · read display', () => {
  it('shows the empty state when there are no references', () => {
    render(<ReferencesTab items={[]} />)
    expect(screen.getByText('Nog geen referenties.')).toBeInTheDocument()
  })

  it('composes the read-mode name from first/middle/last name and shows relation/function/employer + both numbers', () => {
    const item = {
      id: 'r1', first_name: 'Jan', middle_name: 'van der', last_name: 'Berg',
      function: 'Teamleider', relation: { id: 'rel-uuid-1', label: 'Manager' },
      employer: 'Zorggroep X', phone: '0201234567', mobile: '0612345678', email: 'jan@example.com',
    }
    render(<ReferencesTab items={[item]} />)
    expect(screen.getByText('Jan van der Berg')).toBeInTheDocument()
    expect(screen.getByText('Manager · Teamleider · Zorggroep X')).toBeInTheDocument()
    expect(screen.getByText('0201234567 · 0612345678 · jan@example.com')).toBeInTheDocument()
  })

  it('renders the note through SafeHtml, not a bare textarea, in read mode', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', note: '<p>Reageert <strong>snel</strong></p>' }
    render(<ReferencesTab items={[item]} />)
    expect(screen.getByText('Reageert')).toBeInTheDocument()
    expect(screen.getByText('snel').tagName).toBe('STRONG')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  // A row without a nested {id,label} falls back to resolving the picked id
  // against the loaded lookup — mirrors EducationTab's `localLevel` fallback
  // for a row just added/edited THIS session, before the server echoes a
  // fresh nested object back.
  it('resolves the relation label from the loaded lookup when only relation_id is present', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', relation_id: 'rel-uuid-2' }
    render(<ReferencesTab items={[item]} />)
    expect(screen.getByText('Collega')).toBeInTheDocument()
  })

  // The nested {id,label} the API returns wins over the loaded lookup — no
  // second fetch / matching needed to show a stored relation's label, even one
  // the current tenant lookup no longer carries (renamed/deleted since).
  it('renders a stored relation label straight from the nested object, without matching against the loaded lookup', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', relation_id: 'unknown-id', relation: { id: 'unknown-id', label: 'Oud-collega (verwijderd)' } }
    render(<ReferencesTab items={[item]} />)
    expect(screen.getByText('Oud-collega (verwijderd)')).toBeInTheDocument()
  })
})

describe('ReferencesTab · reference-letter document link (DOC-EDU-1 mirror)', () => {
  it('shows no link icons when nothing resolves', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} />)
    expect(screen.queryByTitle('Voorbeeld')).toBeNull()
  })

  it('resolves the linked document from the row\'s own nested `document` object', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', document: { id: 'doc9', name: 'brief.pdf', url: '/x' } }
    render(<ReferencesTab items={[item]} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
    expect(screen.getByTitle('Downloaden')).toBeInTheDocument()
  })

  it('resolves the linked document by cross-referencing document_id against the candidate\'s documents list', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', document_id: 'doc1' }
    render(<ReferencesTab items={[item]} documents={[{ id: 'doc1', name: 'brief.pdf' }]} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
  })

  it('resolves the linked document via the reverse reference_id on a candidate document', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} documents={[{ id: 'doc1', name: 'brief.pdf', reference_id: 'r1' }]} />)
    expect(screen.getByTitle('Voorbeeld')).toBeInTheDocument()
  })

  it('only shows the "jump to documents" icon when onJumpToDocuments is supplied, and calls it on click', async () => {
    const user = userEvent.setup()
    const onJumpToDocuments = vi.fn()
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', document_id: 'doc1' }
    render(<ReferencesTab items={[item]} documents={[{ id: 'doc1', name: 'brief.pdf' }]} onJumpToDocuments={onJumpToDocuments} />)
    const jumpBtn = screen.getByTitle('Naar documenten')
    await user.click(jumpBtn)
    expect(onJumpToDocuments).toHaveBeenCalledTimes(1)
  })
})

describe('ReferencesTab · add/edit/remove wiring (generic AddableSection contract)', () => {
  it('the add form submits every field to onAdd, including relation_id as a real id (never the label) and document_id (never the filename)', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ReferencesTab items={[]} onAdd={onAdd} documents={[{ id: 'doc1', name: 'brief.pdf' }]} />)
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))

    await user.type(screen.getByPlaceholderText('Voornaam'), 'Jan')
    await user.type(screen.getByPlaceholderText('Achternaam'), 'Jansen')
    await user.type(screen.getByPlaceholderText('Tussenvoegsel'), 'van der')
    await user.type(screen.getByPlaceholderText('Functie'), 'Teamleider')
    await user.type(screen.getByPlaceholderText('Werkgever'), 'Zorggroep X')
    await user.type(screen.getByPlaceholderText('Telefoon'), '0201234567')
    await user.type(screen.getByPlaceholderText('Mobiel'), '0612345678')
    await user.type(screen.getByPlaceholderText('E-mailadres'), 'jan@example.com')

    // ALWAYS-SEARCHABLE-1: pick-only searchable dropdowns, never a plain <select>.
    await user.click(screen.getByRole('button', { name: 'Relatie' }))
    await user.click(await screen.findByRole('button', { name: 'Manager' }))
    await user.click(screen.getByRole('button', { name: 'Referentiebrief' }))
    await user.click(await screen.findByRole('button', { name: 'brief.pdf' }))

    await user.click(screen.getByTitle('Opslaan'))

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      first_name: 'Jan', last_name: 'Jansen', middle_name: 'van der', function: 'Teamleider',
      relation_id: 'rel-uuid-1', employer: 'Zorggroep X', phone: '0201234567', mobile: '0612345678',
      email: 'jan@example.com', document_id: 'doc1',
    }))
  })

  it('the row pencil pre-fills the split name fields and onEdit receives the merged values', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', note: '<p>Oud</p>' }
    render(<ReferencesTab items={[item]} onEdit={onEdit} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jansen')).toBeInTheDocument()
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ first_name: 'Jan', last_name: 'Jansen', note: '<p>Oud</p>' }))
  })

  it('the trash button calls onRemove with the row index', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} onRemove={onRemove} />)
    await user.click(screen.getByTitle('Verwijderen'))
    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('is a pick-only searchable dropdown for relation/document — no native <select>', async () => {
    const user = userEvent.setup()
    const { container } = render(<ReferencesTab items={[]} onAdd={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })
})

/**
 * KAND-REFERENTIES-1: the verify action ↔ badge swap. BackgroundTab.test.tsx
 * covers the actual verify REQUEST (§13); this component only owns the
 * affordance — show the action, call the handler, or show the badge instead.
 */
describe('ReferencesTab · verify action ↔ verified badge', () => {
  it('shows a verify action for a persisted, unverified row and calls onVerify with its index', async () => {
    const user = userEvent.setup()
    const onVerify = vi.fn()
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} onVerify={onVerify} />)
    const btn = screen.getByTitle('Verifiëren')
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(onVerify).toHaveBeenCalledWith(0)
  })

  it('shows the verified badge with a formatted date instead of the action once verified_at is set', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', verified_at: '2026-08-01T10:00:00Z' }
    render(<ReferencesTab items={[item]} onVerify={vi.fn()} />)
    expect(screen.getByText(/Geverifieerd/)).toBeInTheDocument()
    expect(screen.getByText(/01-08-2026/)).toBeInTheDocument()
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })

  it('renders no verify action at all for an unpersisted (temp id) row, even with onVerify supplied', () => {
    const item = { id: -12345, first_name: 'Nieuwe referent' }
    render(<ReferencesTab items={[item]} onVerify={vi.fn()} />)
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })

  it('renders no verify action when onVerify is not supplied (no fake affordance)', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} />)
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })
})

/**
 * REF-ERVARING-1 (Danny 08-08, punt 4) — a reference belongs to a concrete work
 * experience (the referee was the manager AT that employer). The backend shipped
 * the field (commit d6eb75cb) and it was MEASURED live 09-08 before this was
 * built: PATCH /candidates/{c}/references/{r} persists `work_experience_id`
 * (200 + a fresh GET echoes it plus a nested `work_experience`), a foreign
 * candidate's experience is rejected 422, and unlinking is the same PATCH with
 * null — the full probe log lives in referenceExperienceLink.tsx's header. The
 * earlier "not possible yet" gate is deleted: its notice had become untrue (§11,
 * never two truths).
 *
 * §13 split: the exact PATCH body for linking AND unlinking is asserted where the
 * request actually fires — BackgroundTab.test.tsx ("REF-ERVARING-1 …"). This file
 * owns the presentation: which picker is offered, what the read line says, and
 * what the form hands back.
 */
describe('ReferencesTab · work-experience link (REF-ERVARING-1)', () => {
  // Two shapes on purpose: mapCandidate's camelCase (title/company/start/end) and
  // the raw API snake_case — both must resolve, since the list holds mapped rows
  // while a freshly POSTed one comes back straight from ReferenceResource.
  const experiences = [
    { id: 'exp-1', title: 'Helpende', company: 'Revalidatiekliniek Zuid', start: '2023-08-06', end: '2024-06-30', current: false },
    { id: 'exp-2', function_title: 'Verzorgende', employer: 'Woonzorg Centrum', start_date: '2024-08-06', end_date: null, current: true },
  ]
  // The picker's visible name is the (still unreported) i18n key until the manager
  // lands it in the locale files — match either form so the test survives that
  // change instead of silently pinning the untranslated state (§5).
  const PICKER = /workExperience|Werkervaring/i

  it('reads a linked experience as one line: employer · function · period in DD-MM-YYYY', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', work_experience_id: 'exp-1' }
    render(<ReferencesTab items={[item]} experiences={experiences} />)
    expect(screen.getByText('Revalidatiekliniek Zuid · Helpende · 06-08-2023 – 30-06-2024')).toBeInTheDocument()
  })

  it('shows "heden" instead of an empty end date for a running experience', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', work_experience_id: 'exp-2' }
    render(<ReferencesTab items={[item]} experiences={experiences} />)
    expect(screen.getByText('Woonzorg Centrum · Verzorgende · 06-08-2024 – heden')).toBeInTheDocument()
  })

  it('shows "heden" for an experience that simply has no end date, current flag or not', () => {
    const open = [{ id: 'exp-3', title: 'Helpende', company: 'Thuiszorg Noord', start: '2025-01-15', end: null, current: false }]
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', work_experience_id: 'exp-3' }
    render(<ReferencesTab items={[item]} experiences={open} />)
    expect(screen.getByText('Thuiszorg Noord · Helpende · 15-01-2025 – heden')).toBeInTheDocument()
  })

  it('resolves the link straight from the row\'s own nested work_experience object', () => {
    const item = {
      id: 'r1', first_name: 'Jan', last_name: 'Jansen', work_experience_id: 'exp-9',
      work_experience: { id: 'exp-9', function_title: 'Helpende', employer: 'Oud Werk', start_date: '2019-03-01', end_date: '2020-03-01' },
    }
    render(<ReferencesTab items={[item]} experiences={experiences} />)
    expect(screen.getByText('Oud Werk · Helpende · 01-03-2019 – 01-03-2020')).toBeInTheDocument()
  })

  // The measured detail: the PATCH response never refreshes the nested object, so
  // a just-cleared row still carries the OLD one. The id decides, never the stale nest.
  it('reads as unlinked once the id is cleared, even while a stale nested object is still attached', () => {
    const item = {
      id: 'r1', first_name: 'Jan', last_name: 'Jansen', work_experience_id: '',
      work_experience: { id: 'exp-1', function_title: 'Helpende', employer: 'Revalidatiekliniek Zuid' },
    }
    render(<ReferencesTab items={[item]} experiences={experiences} />)
    expect(screen.queryByText(/Revalidatiekliniek Zuid/)).toBeNull()
  })

  it('offers a searchable, pick-only picker of THIS candidate\'s experiences and hands the id back to onAdd', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const { container } = render(<ReferencesTab items={[]} onAdd={onAdd} experiences={experiences} />)
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    // ALWAYS-SEARCHABLE-1: the house CreatableSelect, never a native <select>.
    expect(container.querySelectorAll('select')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: PICKER }))
    await user.click(await screen.findByRole('button', { name: 'Woonzorg Centrum · Verzorgende · 06-08-2024 – heden' }))
    await user.type(screen.getByPlaceholderText('Achternaam'), 'Jansen')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ work_experience_id: 'exp-2' }))
  })

  // Unlink mirrors the reference-letter link exactly: the row's own pencil, the
  // picker's clear (X), save — BackgroundTab turns the emptied value into null.
  it('clearing the picker in the row editor hands back an empty work_experience_id (→ PATCH null)', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen', work_experience_id: 'exp-1' }
    render(<ReferencesTab items={[item]} onEdit={onEdit} experiences={experiences} />)
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Wissen'))
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ work_experience_id: '' }))
  })

  // An optimistic experience (negative temp id) has no server-side row yet — offering
  // it would PATCH an id the API rejects with 422.
  it('never offers a not-yet-persisted experience as a link target', async () => {
    const user = userEvent.setup()
    render(<ReferencesTab items={[]} onAdd={vi.fn()} experiences={[{ id: -1712, title: 'Helpende', company: 'Nieuw', start: '2025-01-01' }]} />)
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    expect(screen.queryByRole('button', { name: PICKER })).toBeNull()
  })
})

/**
 * REF-ERVARING-1, the honest empty case: a candidate with zero work experiences
 * gets a calm explanation, never a picker with nothing in it (§3 — an empty
 * dropdown is a dead button).
 */
describe('ReferencesTab · no work experiences to link', () => {
  it('offers no picker at all in the add form', async () => {
    const user = userEvent.setup()
    render(<ReferencesTab items={[]} onAdd={vi.fn()} experiences={[]} />)
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    expect(screen.queryByRole('button', { name: /workExperience|Werkervaring/i })).toBeNull()
  })

  it('explains the absence once per tab when there are references to link', () => {
    const items = [
      { id: 'r1', first_name: 'Jan', last_name: 'Jansen' },
      { id: 'r2', first_name: 'Ans', last_name: 'de Vries' },
    ]
    render(<ReferencesTab items={items} experiences={[]} />)
    expect(screen.getAllByTestId('reference-no-experiences')).toHaveLength(1)
  })

  it('stays quiet when there is nothing to link yet (no references at all)', () => {
    render(<ReferencesTab items={[]} experiences={[]} />)
    expect(screen.queryByTestId('reference-no-experiences')).toBeNull()
  })

  it('drops the explanation as soon as the candidate has a linkable experience', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} experiences={[{ id: 'exp-1', title: 'Helpende', company: 'Zorggroep X' }]} />)
    expect(screen.queryByTestId('reference-no-experiences')).toBeNull()
  })
})
