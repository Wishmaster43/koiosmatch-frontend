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
import { EducationTab, CertificationsTab, resolveEducationStartDate } from './SectionTabs'

// KAND-NIVEAU-1: EducationTab now also fires useEducationLevels' GET (built on the
// shared useCachedLookup) — resolve it with an empty list so no real network call
// fires and the hook's fallback seed renders (mirrors BackgroundTab.test.tsx's
// identical mock, added there for the same reason with useSkillLevels).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
  // useCachedLookup (behind useEducationLevels/useSkillLevels) keys its cache by
  // the active tenant — stub it so those hooks resolve instead of throwing.
  getActiveTenantId: () => 'test-tenant',
}))

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
import api from '@/lib/api'

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

describe('EducationTab · education level (KAND-NIVEAU-1)', () => {
  it('offers the tenant education levels (GET /education-levels) as a pick-only dropdown, and the save payload carries the picked level_id', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/education-levels?active=1'
        ? Promise.resolve({ data: { data: [{ id: 'lvl-1', name: 'MBO-4' }, { id: 'lvl-2', name: 'HBO' }] } })
        : Promise.resolve({ data: { data: [] } }),
    )
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<EducationTab items={[]} onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: /Toevoegen/ }))
    // KAND-ACHTERGROND-VERPLICHT-1: `title` (Diploma) is required — fill it first,
    // otherwise Save is now correctly blocked client-side and onAdd never fires.
    await user.type(screen.getByPlaceholderText('Diploma *'), 'Verpleegkunde')
    // ALWAYS-SEARCHABLE-1: the level_id picker is now the house CreatableSelect — an
    // empty picker's trigger is named by its own label ("Niveau"). Open it and wait
    // for the lookup GET to resolve and its portalled options to render.
    await user.click(screen.getByRole('button', { name: 'Niveau' }))
    await user.click(await screen.findByRole('button', { name: 'HBO' }))
    await user.click(screen.getByTitle('Opslaan'))
    // §13: assert the save PAYLOAD carries the picked level_id.
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ level_id: 'lvl-2' }))
  })

  it('shows the picked education level as a soft chip next to the diploma title', () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    // Nested {id,name,color} shape (EducationResource) — resolves without a second lookup.
    // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup's own colour), not a UI colour choice
    const item = { id: 'e1', title: 'Verpleegkunde', school: 'ROC', level_id: 'lvl-1', level: { id: 'lvl-1', name: 'MBO-4', color: '#2563EB' } }
    render(<EducationTab items={[item]} />)
    expect(screen.getByText('MBO-4')).toBeInTheDocument()
  })

  it('renders no level chip when the entry has no level set', () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    const item = { id: 'e1', title: 'Verpleegkunde', school: 'ROC' }
    render(<EducationTab items={[item]} />)
    expect(screen.queryByText('MBO-4')).toBeNull()
  })

  // LOOKUP-ICON-1: the tenant education-level icon (lucide slug or emoji) rides
  // inside the level chip, next to the label — never replacing it (§6).
  it('shows the education level\'s tenant icon next to the chip label', () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    const item = { id: 'e1', title: 'Verpleegkunde', school: 'ROC', level_id: 'lvl-1',
      // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup's own colour), not a UI colour choice
      level: { id: 'lvl-1', name: 'MBO-4', color: '#2563EB', icon: 'star' } }
    render(<EducationTab items={[item]} />)
    // lucide's GraduationCap renders as an <svg> — assert it landed inside the chip.
    const chip = screen.getByText('MBO-4').closest('span')
    expect(chip?.querySelector('svg')).toBeInTheDocument()
  })

  // ALWAYS-SEARCHABLE-1 (Danny 08-08): AddForm's `options` field (level_id AND
  // document_id) is now the house CreatableSelect — never a native <select> again.
  it('renders no native <select> in the edit form (level_id + document_id both go through CreatableSelect)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    const user = userEvent.setup()
    const { container } = render(<EducationTab items={[]} onAdd={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Toevoegen/ }))
    expect(container.querySelector('select')).toBeNull()
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
    expect(el).toHaveInlineStyle({ fontFamily: 'JetBrains Mono, monospace' })
  })

  it('hides the licence line entirely when there is none', () => {
    const item = { id: 'c1', name: 'VCA Basis' }
    render(<CertificationsTab items={[item]} />)
    expect(screen.queryByText(/licentienummer/i)).toBeNull()
  })
})
