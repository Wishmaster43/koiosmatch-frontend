/**
 * DocumentLinkPicker — the OPTIONAL "Koppelen aan" grouped picker (DOC-ENTRY-LINK-1
 * / DOC-LANG-SKILL-LINK-1). G34: now the house SelectMenu, never a native <select> —
 * group headers become a "<Group> · <label>" prefix on each flattened option
 * (SelectMenu has no <optgroup> equivalent). No dedicated i18next instance is set up
 * in these tests (mirrors DocumentsSection.test.tsx) — labels render as their raw
 * t() keys, which is enough to assert the emitted "kind:id" value.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentLinkPicker from './DocumentLinkPicker'

describe('DocumentLinkPicker · empty state (no fake affordance)', () => {
  it('renders nothing when educations/certifications/languages/skills are all empty', () => {
    const { container } = render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('still renders nothing when languages/skills are explicitly empty arrays', () => {
    const { container } = render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} languages={[]} skills={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('DocumentLinkPicker · G34 is no longer a native <select>', () => {
  it('renders the house SelectMenu trigger button instead', () => {
    const { container } = render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()}
        educations={[{ id: 'e1', title: 'Verpleegkunde' }]} certifications={[]} />,
    )
    expect(container.querySelector('select')).toBeNull()
    expect(screen.getByRole('button', { name: /link/ })).toBeInTheDocument()
  })
})

describe('DocumentLinkPicker · DOC-LANG-SKILL-LINK-1 grouped options', () => {
  const languages = [{ id: 'lang1', language: 'Engels' }, { id: 'lang2', name: 'Duits' }]
  const skills = [{ id: 'skill1', name: 'Heftruck rijden' }]

  it('offers one prefixed option per language, falling back to name when language is absent', async () => {
    const user = userEvent.setup()
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} languages={languages} skills={[]} />,
    )
    await user.click(screen.getByRole('button', { name: /link/ }))
    expect(screen.getByRole('button', { name: 'sections.languages · Engels' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'sections.languages · Duits' })).toBeInTheDocument()
  })

  it('offers one prefixed option per skill', async () => {
    const user = userEvent.setup()
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} languages={[]} skills={skills} />,
    )
    await user.click(screen.getByRole('button', { name: /link/ }))
    expect(screen.getByRole('button', { name: 'sections.skills · Heftruck rijden' })).toBeInTheDocument()
  })

  it('offers all four groups together (education/certification/language/skill) without dropping any', async () => {
    const user = userEvent.setup()
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()}
        educations={[{ id: 'e1', title: 'Verpleegkunde' }]} certifications={[{ id: 'c1', name: 'VCA Basis' }]}
        languages={languages} skills={skills} />,
    )
    await user.click(screen.getByRole('button', { name: /link/ }))
    expect(screen.getByRole('button', { name: 'sections.education · Verpleegkunde' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'sections.certifications · VCA Basis' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'sections.languages · Engels' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'sections.skills · Heftruck rijden' })).toBeInTheDocument()
  })

  it('emits the "skill:<id>" composite value on pick — same value shape as the old native <select>', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={onChange} educations={[]} certifications={[]} languages={[]} skills={skills} />,
    )
    await user.click(screen.getByRole('button', { name: /link/ }))
    await user.click(screen.getByRole('button', { name: 'sections.skills · Heftruck rijden' }))
    expect(onChange).toHaveBeenCalledWith('skill:skill1')
  })
})

// REFERENTIE-VELDEN-1: same "kind:id" mechanic, extended to references — the
// candidate's own referees, labelled by their composed referent name (never a
// bare internal id).
describe('DocumentLinkPicker · REFERENTIE-VELDEN-1 reference group', () => {
  const references = [
    { id: 'ref1', first_name: 'Jan', middle_name: 'de', last_name: 'Vries' },
    { id: 'ref2', first_name: 'Anna', last_name: 'Bakker' },
  ]

  it('renders nothing when references is the only populated list but is empty', () => {
    const { container } = render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} references={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers one prefixed option per reference, composed from first/middle/last name', async () => {
    const user = userEvent.setup()
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} references={references} />,
    )
    await user.click(screen.getByRole('button', { name: /link/ }))
    expect(screen.getByRole('button', { name: 'sections.references · Jan de Vries' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'sections.references · Anna Bakker' })).toBeInTheDocument()
  })

  it('emits the "reference:<id>" composite value on pick', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={onChange} educations={[]} certifications={[]} references={references} />,
    )
    await user.click(screen.getByRole('button', { name: /link/ }))
    await user.click(screen.getByRole('button', { name: 'sections.references · Anna Bakker' }))
    expect(onChange).toHaveBeenCalledWith('reference:ref2')
  })
})

/**
 * DOC-1-EIGENAAR-1 (Danny 08-08 punt 6). MEASURED live: PATCHing a second document
 * onto an entry that already carries one answers 200 and silently releases the first,
 * so an occupied entry must not be offered as a link target. The entry this document
 * currently hangs on (derived from `value`) stays offered — otherwise the recruiter
 * can no longer see, switch or clear their own pick.
 */
describe('DocumentLinkPicker · DOC-1-EIGENAAR-1 occupied entries are not offered', () => {
  const educations = [{ id: 'e1', title: 'Verpleegkunde', document_id: 'other-doc' }, { id: 'e2', title: 'Anatomie', document_id: null }]
  const certifications = [{ id: 'c1', name: 'VCA Basis', document_id: 'taken' }]

  it('leaves out an education that already carries another document', async () => {
    const user = userEvent.setup()
    render(<DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={educations} certifications={[]} />)
    await user.click(screen.getByRole('button', { name: /link/ }))
    expect(screen.queryByRole('button', { name: 'sections.education · Verpleegkunde' })).toBeNull()
    expect(screen.getByRole('button', { name: 'sections.education · Anatomie' })).toBeInTheDocument()
  })

  it('KEEPS the entry this very document is linked to, so the pick stays switchable', async () => {
    const user = userEvent.setup()
    render(<DocumentLinkPicker ariaLabel="link" value="education:e1" onChange={vi.fn()} educations={educations} certifications={[]} />)
    await user.click(screen.getByRole('button', { name: /link/ }))
    expect(screen.getByRole('button', { name: 'sections.education · Verpleegkunde' })).toBeInTheDocument()
  })

  it('never un-hides an occupied entry of ANOTHER kind that happens to share the id', async () => {
    const user = userEvent.setup()
    // value points at education e1 — the occupied certification c1 must stay hidden.
    render(<DocumentLinkPicker ariaLabel="link" value="education:e1" onChange={vi.fn()} educations={educations} certifications={certifications} />)
    await user.click(screen.getByRole('button', { name: /link/ }))
    expect(screen.queryByRole('button', { name: 'sections.certifications · VCA Basis' })).toBeNull()
  })

  it('renders nothing at all when every entry is already occupied (no empty picker)', () => {
    const { container } = render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()}
        educations={[{ id: 'e1', title: 'Verpleegkunde', document_id: 'other-doc' }]} certifications={certifications} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
