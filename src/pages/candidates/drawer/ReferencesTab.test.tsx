/**
 * ReferencesTab — KAND-REFERENTIES-1 regression tests. Real i18n (nl) runs here,
 * mirroring SectionTabs.test.tsx/BackgroundTab.test.tsx — the new i18n keys are
 * not yet in the locale files (reported to the manager, house rule: never edit
 * src/i18n/locales/**), so every label renders via its t(key, { defaultValue })
 * fallback until the manager applies them. Only the Tiptap RichTextEditor is
 * stubbed, same as its siblings.
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

describe('ReferencesTab · read display', () => {
  it('shows the empty state when there are no references', () => {
    render(<ReferencesTab items={[]} />)
    expect(screen.getByText('Nog geen referenties.')).toBeInTheDocument()
  })

  it('renders name, relation/employer and phone/email on compact secondary lines', () => {
    const item = { id: 'r1', name: 'Jan Jansen', relation: 'Manager', employer: 'Zorggroep X', phone: '0612345678', email: 'jan@example.com' }
    render(<ReferencesTab items={[item]} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Manager · Zorggroep X')).toBeInTheDocument()
    expect(screen.getByText('0612345678 · jan@example.com')).toBeInTheDocument()
  })

  it('renders the note through SafeHtml, not a bare textarea, in read mode', () => {
    const item = { id: 'r1', name: 'Jan Jansen', note: '<p>Reageert <strong>snel</strong></p>' }
    render(<ReferencesTab items={[item]} />)
    expect(screen.getByText('Reageert')).toBeInTheDocument()
    expect(screen.getByText('snel').tagName).toBe('STRONG')
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

describe('ReferencesTab · add/edit/remove wiring (generic AddableSection contract)', () => {
  it('the add form submits name/relation/employer/phone/email/note to onAdd', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ReferencesTab items={[]} onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    await user.type(screen.getByPlaceholderText('Naam'), 'Jan Jansen')
    await user.type(screen.getByPlaceholderText('Relatie'), 'Manager')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Jan Jansen', relation: 'Manager' }))
  })

  it('the row pencil pre-fills the edit form and onEdit receives the merged values', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'r1', name: 'Jan Jansen', relation: 'Manager', note: '<p>Oud</p>' }
    render(<ReferencesTab items={[item]} onEdit={onEdit} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByDisplayValue('Jan Jansen')).toBeInTheDocument()
    await user.click(screen.getByTitle('Opslaan'))
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ name: 'Jan Jansen', note: '<p>Oud</p>' }))
  })

  it('the trash button calls onRemove with the row index', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const item = { id: 'r1', name: 'Jan Jansen' }
    render(<ReferencesTab items={[item]} onRemove={onRemove} />)
    await user.click(screen.getByTitle('Verwijderen'))
    expect(onRemove).toHaveBeenCalledWith(0)
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
    const item = { id: 'r1', name: 'Jan Jansen' }
    render(<ReferencesTab items={[item]} onVerify={onVerify} />)
    const btn = screen.getByTitle('Verifiëren')
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(onVerify).toHaveBeenCalledWith(0)
  })

  it('shows the verified badge with a formatted date instead of the action once verified_at is set', () => {
    const item = { id: 'r1', name: 'Jan Jansen', verified_at: '2026-08-01T10:00:00Z' }
    render(<ReferencesTab items={[item]} onVerify={vi.fn()} />)
    expect(screen.getByText(/Geverifieerd/)).toBeInTheDocument()
    expect(screen.getByText(/01-08-2026/)).toBeInTheDocument()
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })

  it('renders no verify action at all for an unpersisted (temp id) row, even with onVerify supplied', () => {
    const item = { id: -12345, name: 'Nieuwe referent' }
    render(<ReferencesTab items={[item]} onVerify={vi.fn()} />)
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })

  it('renders no verify action when onVerify is not supplied (no fake affordance)', () => {
    const item = { id: 'r1', name: 'Jan Jansen' }
    render(<ReferencesTab items={[item]} />)
    expect(screen.queryByTitle('Verifiëren')).toBeNull()
  })
})
