/**
 * DocumentLinkPicker — the OPTIONAL "Koppelen aan" grouped select (DOC-ENTRY-LINK-1
 * / DOC-LANG-SKILL-LINK-1). No dedicated i18next instance is set up in these tests
 * (mirrors DocumentsSection.test.tsx) — labels render as their raw t() keys, which
 * is enough to assert group/option structure and the emitted "kind:id" value.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

describe('DocumentLinkPicker · DOC-LANG-SKILL-LINK-1 languages/skills optgroups', () => {
  const languages = [{ id: 'lang1', language: 'Engels' }, { id: 'lang2', name: 'Duits' }]
  const skills = [{ id: 'skill1', name: 'Heftruck rijden' }]

  it('renders the Talen optgroup with one option per language, falling back to name when language is absent', () => {
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} languages={languages} skills={[]} />,
    )
    const select = screen.getByRole('combobox', { name: 'link' })
    const group = within(select).getByRole('group', { name: 'sections.languages' })
    expect(within(group).getByRole('option', { name: 'Engels' })).toHaveValue('language:lang1')
    expect(within(group).getByRole('option', { name: 'Duits' })).toHaveValue('language:lang2')
  })

  it('renders the Vaardigheden optgroup with one option per skill', () => {
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()} educations={[]} certifications={[]} languages={[]} skills={skills} />,
    )
    const select = screen.getByRole('combobox', { name: 'link' })
    const group = within(select).getByRole('group', { name: 'sections.skills' })
    expect(within(group).getByRole('option', { name: 'Heftruck rijden' })).toHaveValue('skill:skill1')
  })

  it('renders all four groups together (education/certification/language/skill) without dropping any', () => {
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={vi.fn()}
        educations={[{ id: 'e1', title: 'Verpleegkunde' }]} certifications={[{ id: 'c1', name: 'VCA Basis' }]}
        languages={languages} skills={skills} />,
    )
    expect(screen.getAllByRole('group')).toHaveLength(4)
  })

  it('emits the "skill:<id>" composite value on change', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DocumentLinkPicker ariaLabel="link" value="" onChange={onChange} educations={[]} certifications={[]} languages={[]} skills={skills} />,
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'link' }), 'skill:skill1')
    expect(onChange).toHaveBeenCalledWith('skill:skill1')
  })
})
