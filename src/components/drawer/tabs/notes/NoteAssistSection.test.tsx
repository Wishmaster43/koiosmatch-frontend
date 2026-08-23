/**
 * NoteAssistSection — ASSIST-SIDEPANEEL-1 (K-155/K-157). §13: assert the
 * REQUEST body per mode (process/summarize_process, with known_items),
 * the per-mode apply semantics for the TEXT half, and that the ITEMS half is
 * handed to the host via onItems the moment a combined result lands —
 * independent of the text's own Overnemen/Verwerpen.
 *
 * DEFAULT-VALUE-1 (Danny 07-08): every button/label carries a Dutch
 * `defaultValue` (no i18n instance in this test tree, so that IS what renders).
 *
 * The mock is reset INLINE at the top of each test (repo precedent — see the
 * file's own prior version for the Vitest quirk this works around).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteAssistSection from './NoteAssistSection'
import { assistRichText as assistNote } from '@/components/ui/richtext/richTextAssistApi'

vi.mock('@/components/ui/richtext/richTextAssistApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/richtext/richTextAssistApi')>()
  return { ...actual, assistRichText: vi.fn() }
})
vi.mock('./NoteKoiosModeToggle', () => ({ default: () => <div data-testid="mode-toggle-stub" /> }))

describe('NoteAssistSection · request per mode', () => {
  it('POSTs {text, language, mode: "process"} when Verwerken is clicked', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'combined', text: 'Better.', items: [] })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} language="en" />)
    await user.click(screen.getByRole('button', { name: 'Verwerken' }))
    expect(assistNote).toHaveBeenCalledWith({ text: '<p>Original</p>', language: 'en', mode: 'process', knownItems: undefined }, expect.anything())
  })

  it('POSTs mode: "summarize_process" when Samenvatten is clicked', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'combined', text: 'Summary.', items: [] })
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    expect(assistNote).toHaveBeenCalledWith(expect.objectContaining({ mode: 'summarize_process' }), expect.anything())
  })

  it('sends the panel\'s current items as known_items (dedupe)', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'combined', text: 'Better.', items: [] })
    const known = [{ title: 'Bel terug', type: 'task' }]
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} knownItems={known} />)
    await user.click(screen.getByRole('button', { name: 'Verwerken' }))
    expect(assistNote).toHaveBeenCalledWith(expect.objectContaining({ knownItems: known }), expect.anything())
  })

  it('always renders the K0 Wizard/Auto mode switch in the header, even before any assist run', () => {
    vi.mocked(assistNote).mockReset()
    render(<NoteAssistSection body="" onApply={vi.fn()} />)
    expect(screen.getByTestId('mode-toggle-stub')).toBeInTheDocument()
  })

  it('is genuinely enabled the moment the note has text — no hidden gate beyond hasText', () => {
    vi.mocked(assistNote).mockReset()
    render(<NoteAssistSection body="<p>Real note text</p>" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Verwerken' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Samenvatten' })).toBeEnabled()
    expect(screen.queryByText('Schrijf eerst tekst in de notitie')).toBeNull()
  })

  it('disables both mode buttons while the note body is empty, with a VISIBLE (non-hover-only) reason', () => {
    vi.mocked(assistNote).mockReset()
    render(<NoteAssistSection body="" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Verwerken' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Samenvatten' })).toBeDisabled()
    expect(screen.getByText('Schrijf eerst tekst in de notitie')).toBeInTheDocument()
  })
})

describe('NoteAssistSection · Overnemen (apply) semantics for the text half', () => {
  it('process REPLACES the body on Overnemen, never auto-applies before the click', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'combined', text: 'Rewritten.', items: [] })
    const onApply = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Verwerken' }))
    await screen.findByText('Rewritten.')
    expect(onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Overnemen' }))
    expect(onApply).toHaveBeenCalledWith('<p>Rewritten.</p>')
  })

  it('summarize_process APPENDS below the existing body on Overnemen', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockResolvedValue({ kind: 'combined', text: 'Summary.', items: [] })
    const onApply = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    await screen.findByText('Summary.')
    await user.click(screen.getByRole('button', { name: 'Overnemen' }))
    expect(onApply).toHaveBeenCalledWith('<p>Original</p><p>Summary.</p>')
  })
})

describe('NoteAssistSection · items hand-off (onItems)', () => {
  it('hands the combined result\'s items to the host the moment they arrive — not gated by Overnemen', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    const items = [{ title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null }]
    vi.mocked(assistNote).mockResolvedValue({ kind: 'combined', text: 'Rewritten.', items })
    const onItems = vi.fn()
    const onApply = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={onApply} onItems={onItems} />)
    await user.click(screen.getByRole('button', { name: 'Verwerken' }))
    await screen.findByText('Rewritten.')
    expect(onItems).toHaveBeenCalledWith(items)
    // The text still needs its own explicit Overnemen — items are independent.
    expect(onApply).not.toHaveBeenCalled()
  })

  it('discarding the text preview does not re-fire onItems', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    const items = [{ title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null }]
    vi.mocked(assistNote).mockResolvedValue({ kind: 'combined', text: 'Rewritten.', items })
    const onItems = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={vi.fn()} onItems={onItems} />)
    await user.click(screen.getByRole('button', { name: 'Verwerken' }))
    await screen.findByText('Rewritten.')
    expect(onItems).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Verwerpen' }))
    expect(onItems).toHaveBeenCalledTimes(1)
  })
})

describe('NoteAssistSection · failure', () => {
  it('shows the server\'s own message on a 402 budget response and applies nothing', async () => {
    vi.mocked(assistNote).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistNote).mockRejectedValue({ response: { status: 402, data: { message: 'Budget op.' } } })
    const onApply = vi.fn()
    render(<NoteAssistSection body="<p>Original</p>" onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Verwerken' }))
    expect(await screen.findByText('Budget op.')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Verwerken' })).toBeInTheDocument()
  })
})
