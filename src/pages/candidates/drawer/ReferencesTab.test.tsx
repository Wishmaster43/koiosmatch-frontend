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
 * §13 scope note: BackgroundTab.tsx's `TO_API.references` mapper (out of scope
 * for this change — already modified in the working tree by another pass) is a
 * STRAIGHT PASSTHROUGH for every field below — ReferenceResource's own keys
 * already match this form's field keys 1:1, no FE→BE renaming happens between
 * onAdd's payload and the POST/PATCH body (mirrors the old contract's shape).
 * Asserting the exact onAdd/onEdit payload here is therefore equivalent to
 * asserting the request body; the actual axios call assertion (mirrors
 * BackgroundTab.test.tsx's own DOC-ENTRY-LINK-1 describe block) is the
 * responsibility of whoever finalises BackgroundTab.test.tsx.
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
 * REF-ERVARING-1 (Danny 08-08, punt 4) — "a reference must be linkable to a work
 * experience". MEASURED live first (koiosmatch-api.test, X-Tenant: yesway): the
 * backend has no such field in either direction, and POST/PATCH on
 * /candidates/{id}/references answer 201/200 while SILENTLY dropping
 * work_experience_id (see ReferenceExperienceGate's header for the full probe).
 *
 * §13 honesty note: the two tests the task asked for — "the real request shape"
 * and "unlinking really sends an empty/null field" — CANNOT exist, because there
 * is no field to send; writing them would assert a contract the server does not
 * have (exactly the green-but-dead test class §13 warns about, bulk-ontkoppelen
 * 2026-07-17). What IS asserted instead: the honest gate is there, it is NOT an
 * interactive control, and the save path never sends a key the API silently drops.
 */
describe('ReferencesTab · work-experience link is honestly gated (no backend field)', () => {
  it('shows the honest notice once per tab — not once per reference row', () => {
    const items = [
      { id: 'r1', first_name: 'Jan', last_name: 'Jansen' },
      { id: 'r2', first_name: 'Ans', last_name: 'de Vries' },
    ]
    render(<ReferencesTab items={items} />)
    expect(screen.getAllByTestId('reference-experience-gate')).toHaveLength(1)
  })

  it('renders no notice at all when there are no references yet (nothing to link)', () => {
    render(<ReferencesTab items={[]} />)
    expect(screen.queryByTestId('reference-experience-gate')).toBeNull()
  })

  // The gate is a NOTICE, never a disabled-looking control: no button, no
  // searchable dropdown, nothing a recruiter could read as "clickable later".
  it('the gate is inert — it contains no button and no dropdown trigger', () => {
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} />)
    const gate = screen.getByTestId('reference-experience-gate')
    expect(gate.querySelectorAll('button')).toHaveLength(0)
    expect(gate.querySelectorAll('select')).toHaveLength(0)
    expect(gate.querySelectorAll('input')).toHaveLength(0)
  })

  // The measured trap: PATCH .../references/{item} returns 200 for an unknown
  // key and drops it. So the save path must never carry one — a green request
  // test on such a key would prove nothing about persistence.
  it('never sends an experience-link key in the add payload', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ReferencesTab items={[]} onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    await user.type(screen.getByPlaceholderText('Achternaam'), 'Jansen')
    await user.click(screen.getByTitle('Opslaan'))

    const payload = onAdd.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(payload)).not.toContain('work_experience_id')
    expect(Object.keys(payload)).not.toContain('experience_id')
    expect(Object.keys(payload)).not.toContain('candidate_experience_id')
  })

  // Same for the edit path — the row form offers no experience field, so onEdit's
  // merged payload cannot smuggle one into the PATCH body either.
  it('never sends an experience-link key in the edit payload', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'r1', first_name: 'Jan', last_name: 'Jansen' }
    render(<ReferencesTab items={[item]} onEdit={onEdit} />)
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Opslaan'))

    const payload = onEdit.mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(payload)).not.toContain('work_experience_id')
    expect(Object.keys(payload)).not.toContain('experience_id')
  })
})
