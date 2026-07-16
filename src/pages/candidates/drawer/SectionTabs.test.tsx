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
import { ExperienceTab, EducationTab, CertificationsTab, resolveEducationStartDate } from './SectionTabs'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

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

    await user.click(screen.getAllByTitle('Bewerken').at(-1)!) // last = the AddableSection ROW edit; the description ProseField pencil renders first (inside the row content)
    expect(screen.getByDisplayValue('01-01-2009')).toBeInTheDocument()
  })

  it('leaves the start date genuinely empty when neither a start nor an issue date exists', async () => {
    const user = userEvent.setup()
    const item = { id: 'e2', title: 'Onbekend', inProgress: true }
    render(<EducationTab items={[item]} onEdit={vi.fn()} />)
    await user.click(screen.getAllByTitle('Bewerken').at(-1)!) // last = the AddableSection ROW edit; the description ProseField pencil renders first (inside the row content)
    // The start-date field (react-datepicker) has no display value to assert against —
    // confirm no stray date leaked in instead.
    expect(screen.queryByDisplayValue(/\d{2}-\d{2}-\d{4}/)).toBeNull()
  })
})

describe('EducationTab · "Nog in opleiding" checkbox label (C-11 regression guard)', () => {
  it('keeps its own label text stable through check → uncheck → recheck', async () => {
    const user = userEvent.setup()
    render(<EducationTab items={[]} onAdd={vi.fn()} />)
    await user.click(screen.getByText(/Toevoegen/))
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

describe('CertificationsTab · description = rich-text pattern with its own pencil (C-13c)', () => {
  it('renders the saved description through SafeHtml, not a bare textarea', () => {
    const item = { id: 'c1', name: 'VCA Basis', desc: '<p>Basisveiligheid <strong>VOL</strong></p>' }
    render(<CertificationsTab items={[item]} />)
    expect(screen.getByText('Basisveiligheid')).toBeInTheDocument()
    expect(screen.getByText('VOL').tagName).toBe('STRONG')
    expect(screen.queryByRole('textbox')).toBeNull() // no bare <textarea> in read mode
  })

  it('edits the description via its OWN pencil (independent of the row-level edit) and saves only {desc}', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', org: 'SSVV', desc: '<p>Basisveiligheid</p>' }
    render(<CertificationsTab items={[item]} onEdit={onEdit} />)

    await user.click(screen.getByTestId('prose-edit'))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Basisveiligheid</p>')
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p>Edited</p>')
    await user.click(screen.getByTestId('prose-save'))

    expect(onEdit).toHaveBeenCalledWith(0, { desc: '<p>Edited</p>' })
    // The row-level pencil (name/org/dates) is untouched by this flow — both it and
    // the description's own pencil share the 'Bewerken' title, so there are two.
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(2)
  })

  it('cancel discards the draft without calling onEdit', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', desc: '<p>Basisveiligheid</p>' }
    render(<CertificationsTab items={[item]} onEdit={onEdit} />)
    await user.click(screen.getByTestId('prose-edit'))
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p>Discarded</p>')
    await user.click(screen.getByTestId('prose-cancel'))
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Basisveiligheid')).toBeInTheDocument()
  })
})

describe('ExperienceTab · description = rich-text pattern with its own pencil (C-14)', () => {
  it('shows the description via SafeHtml and edits it through its own pencil', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'x1', title: 'Verpleegkundige', company: 'Yesway', desc: '<p>Zorgtaken</p>' }
    render(<ExperienceTab items={[item]} onEdit={onEdit} />)

    expect(screen.getByText('Zorgtaken')).toBeInTheDocument()
    await user.click(screen.getByTestId('prose-edit'))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Zorgtaken</p>')
    await user.click(screen.getByTestId('prose-save'))
    expect(onEdit).toHaveBeenCalledWith(0, { desc: '<p>Zorgtaken</p>' })
  })

  it('no longer offers the description as a plain textarea field on the row-level edit form', async () => {
    const user = userEvent.setup()
    const item = { id: 'x1', title: 'Verpleegkundige', company: 'Yesway' }
    const { container } = render(<ExperienceTab items={[item]} onEdit={vi.fn()} />)
    // Two pencils share the 'Bewerken' title (the row-level one + the description's
    // own, ProseField) — click the row-level one specifically (not data-testid=prose-edit).
    const rowPencil = screen.getAllByTitle('Bewerken').find(el => el.dataset.testid !== 'prose-edit')
    await user.click(rowPencil as HTMLElement)
    // The row form (title/company/location/dates/current) must not include a bare
    // <textarea> for description anymore — that moved to its own rich-text pencil,
    // and AddableSection swaps renderItem (incl. ProseField) out while this form is open.
    expect(container.querySelectorAll('textarea')).toHaveLength(0)
  })
})
