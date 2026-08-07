/**
 * NoteAssistSection — NOTE-ASSIST-1 F3. §13: assert the REQUEST body per mode
 * (never only that a callback fired), the per-mode apply semantics, and that a
 * failure shows the server's own message while applying nothing.
 *
 * DEFAULT-VALUE-1 (Danny 07-08): every button/label carries a Dutch
 * `defaultValue` (no i18n instance in this test tree, so that IS what renders —
 * confirms the same behaviour a REAL app sees for a key that hasn't landed in
 * the shipped locale JSON yet). Assertions below match that Dutch text on
 * purpose, not the English mode names.
 *
 * The mock is reset INLINE at the top of each test, never via a shared
 * `beforeEach` — a `beforeEach` hook combined with a rejecting mock in this
 * Vitest version misattributes the rejection as an unhandled test failure
 * (reproduced in isolation; the component itself is correct — see the apply/
 * failure assertions below, which pass once the mock reset moves inline).
 *
 * K0-B: the header's NoteKoiosModeToggle and a non-empty 'actions' result's
 * NoteActionsResultsPanel are stubbed here — both have their OWN dedicated
 * test files (mirrors how NoteComposer.test.tsx stubs THIS section as a
 * child); this file stays focused on the improve/summarize request+apply
 * behaviour it already covered before K0-B landed.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteAssistSection from './NoteAssistSection'
import { assistNote } from './noteAssistApi'

vi.mock('./noteAssistApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./noteAssistApi')>()
  return { ...actual, assistNote: vi.fn() }
})
vi.mock('./NoteKoiosModeToggle', () => ({ default: () => <div data-testid="mode-toggle-stub" /> }))
vi.mock('./NoteActionsResultsPanel', () => ({ default: () => <div data-testid="actions-panel-stub" /> }))

describe('NoteAssistSection · request per mode', () => {
  it('POSTs {text, language, mode: "improve"} when Verbeteren is clicked', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'text', text: 'Better.' })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} language="en" />)
    await user.click(screen.getByRole('button', { name: 'Verbeteren' }))
    expect(assistNote).toHaveBeenCalledWith({ text: '<p>Original</p>', language: 'en', mode: 'improve' }, expect.anything())
  })

  it('POSTs mode: "summarize" when Samenvatten is clicked', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'text', text: 'Summary.' })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    expect(assistNote).toHaveBeenCalledWith(expect.objectContaining({ mode: 'summarize' }), expect.anything())
  })

  it('POSTs mode: "actions" when Actiepunten is clicked', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'actions', items: [] })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    expect(assistNote).toHaveBeenCalledWith(expect.objectContaining({ mode: 'actions' }), expect.anything())
  })

  it('always renders the K0 Wizard/Auto mode switch in the header, even before any assist run', () => {
    vi.mocked(assistNote).mockReset()
    render(<NoteAssistSection body="" onApply={vi.fn()} />)
    expect(screen.getByTestId('mode-toggle-stub')).toBeInTheDocument()
  })

  it('is genuinely enabled the moment the note has text — no hidden gate beyond hasText', () => {
    vi.mocked(assistNote).mockReset()
    render(<NoteAssistSection body="<p>Real note text</p>" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Verbeteren' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Samenvatten' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Actiepunten' })).toBeEnabled()
    // No "needs text" hint once there IS text.
    expect(screen.queryByText('Schrijf eerst tekst in de notitie')).toBeNull()
  })

  it('disables every mode button while the note body is empty, with a VISIBLE (non-hover-only) reason', () => {
    vi.mocked(assistNote).mockReset()
    render(<NoteAssistSection body="" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Verbeteren' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Samenvatten' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actiepunten' })).toBeDisabled()
    // Danny 07-08: disabled must never be SILENT — a plain visible text line,
    // not just a hover-only title attribute.
    expect(screen.getByText('Schrijf eerst tekst in de notitie')).toBeInTheDocument()
  })
})

describe('NoteAssistSection · Overnemen (apply) semantics', () => {
  it('improve REPLACES the body on Overnemen, never auto-applies before the click', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'text', text: 'Rewritten.' })
    const onApply = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Verbeteren' }))
    await screen.findByText('Rewritten.')
    // Never auto-applied — only the explicit click below calls onApply.
    expect(onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Overnemen' }))
    expect(onApply).toHaveBeenCalledWith('<p>Rewritten.</p>')
  })

  it('summarize APPENDS below the existing body on Overnemen', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'text', text: 'Summary.' })
    const onApply = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    await screen.findByText('Summary.')
    await user.click(screen.getByRole('button', { name: 'Overnemen' }))
    expect(onApply).toHaveBeenCalledWith('<p>Original</p><p>Summary.</p>')
  })

  it('actions with zero items shows a calm "no items" notice and no apply button', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'actions', items: [] })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    await screen.findByText('Geen actiepunten gevonden')
    expect(screen.queryByRole('button', { name: 'Overnemen' })).toBeNull()
  })

  it('a NON-empty actions result hands off to NoteActionsResultsPanel (K0-B execute flow), not the plain Overnemen list', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({
      kind: 'actions',
      items: [{ title: 'Bel terug', type: 'task', due_date: '2026-08-10', note_excerpt: null }],
    })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    expect(await screen.findByTestId('actions-panel-stub')).toBeInTheDocument()
    // The plain review-list idiom (Overnemen button) is improve/summarize-only now.
    expect(screen.queryByRole('button', { name: 'Overnemen' })).not.toBeInTheDocument()
  })
})

describe('NoteAssistSection · failure', () => {
  it('shows the server\'s own message on a 402 budget response and applies nothing', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockRejectedValue({ response: { status: 402, data: { message: 'Budget op.' } } })
    const onApply = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Verbeteren' }))
    expect(await screen.findByText('Budget op.')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
    // The section itself stays visible/usable — never disappears on failure.
    expect(screen.getByRole('button', { name: 'Verbeteren' })).toBeInTheDocument()
  })

  it('shows the server\'s own message on an unrecognisable-actions 422', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockRejectedValue({ response: { status: 422, data: { message: 'Koios kon geen actiepunten herkennen.' } } })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    expect(await screen.findByText('Koios kon geen actiepunten herkennen.')).toBeInTheDocument()
  })
})
