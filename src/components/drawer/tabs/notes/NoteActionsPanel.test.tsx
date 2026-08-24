/**
 * NoteActionsPanel — ASSIST-SIDEPANEEL-1 punt 4. §13: proves the batch
 * "Uitvoeren" sends only PROPOSED items, a per-item "Bevestigen" re-sends
 * only that one item confirmed, an inline title/date edit reaches the
 * request VERBATIM, and per created.type the panel links to the right page.
 */
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteActionsPanel from './NoteActionsPanel'
import type { NoteActionPanelItem } from './NoteActionsPanel'
import { executeRichTextActions } from '@/components/ui/richtext/assistActionsExecuteApi'

// NoteActionsPanel is a controlled component (its render always reflects the
// `items` PROP) — mirrors how NoteComposer actually hosts it. This thin
// stateful wrapper is what makes onItemsChange's result visible in these
// tests, exactly like the real composer re-rendering with the merged state.
function Controlled({ initial, noteId, candidateId, autoRun }: { initial: NoteActionPanelItem[]; noteId?: string; candidateId?: string; autoRun?: boolean }) {
  const [items, setItems] = useState(initial)
  return <NoteActionsPanel items={items} onItemsChange={setItems} noteId={noteId} candidateId={candidateId} autoRun={autoRun} />
}

// K-159 extras mount in edit mode — stub the users query (no QueryClient here).
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/pages/tasks/shared', () => ({ AddLinkRow: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
vi.mock('@/components/ui/richtext/assistActionsExecuteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/richtext/assistActionsExecuteApi')>()
  return { ...actual, executeRichTextActions: vi.fn() }
})

const baseItem = (over: Partial<NoteActionPanelItem> = {}): NoteActionPanelItem => ({
  title: 'Bel terug', type: 'task', due_date: '2026-08-25', note_excerpt: null, status: 'proposed', ...over,
})

afterEach(() => vi.clearAllMocks())

describe('NoteActionsPanel · batch Uitvoeren', () => {
  it('sends only PROPOSED items, never an already-executed sibling', async () => {
    const user = userEvent.setup()
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'pending', reason: 'Wacht op jouw bevestiging.' }])
    const items = [baseItem(), baseItem({ title: 'Al gedaan', status: 'executed', created: { type: 'task', id: 'run-1' } })]
    render(<NoteActionsPanel items={items} onItemsChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Uitvoeren' }))
    expect(executeRichTextActions).toHaveBeenCalledWith(
      [expect.objectContaining({ title: 'Bel terug', confirmed: undefined })],
      {},
    )
  })

  it('merges the response back — a returned pending status shows the Bevestigen button', async () => {
    const user = userEvent.setup()
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'pending', reason: 'Wacht op jouw bevestiging.' }])
    render(<Controlled initial={[baseItem()]} />)
    await user.click(screen.getByRole('button', { name: 'Uitvoeren' }))
    expect(await screen.findByText('Bevestigen')).toBeInTheDocument()
    expect(await screen.findByText('Wacht op jouw bevestiging.')).toBeInTheDocument()
  })
})

describe('NoteActionsPanel · per-item Bevestigen', () => {
  it('re-sends ONLY that one item with confirmed:true', async () => {
    const user = userEvent.setup()
    vi.mocked(executeRichTextActions)
      .mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'pending', reason: 'Wacht op jouw bevestiging.' }])
      .mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'run-9' }])
    render(<Controlled initial={[baseItem()]} noteId="note-1" />)
    await user.click(screen.getByRole('button', { name: 'Uitvoeren' }))
    await screen.findByText('Bevestigen')
    await user.click(screen.getByRole('button', { name: 'Bevestigen' }))
    expect(executeRichTextActions).toHaveBeenLastCalledWith(
      [expect.objectContaining({ title: 'Bel terug', confirmed: true })],
      { note_id: 'note-1' },
    )
  })
})

describe('NoteActionsPanel · inline edit reaches the request verbatim', () => {
  it('an edited title is what gets sent on the next Uitvoeren', async () => {
    const user = userEvent.setup()
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Terugbellen om 14u', type: 'task', status: 'executed', run_id: 'run-2' }])
    render(<Controlled initial={[baseItem()]} />)
    await user.click(screen.getByRole('button', { name: 'Bewerken' }))
    const titleInput = screen.getByLabelText('Titel')
    fireEvent.change(titleInput, { target: { value: 'Terugbellen om 14u' } })
    await user.click(screen.getByRole('button', { name: 'Uitvoeren' }))
    expect(executeRichTextActions).toHaveBeenCalledWith(
      [expect.objectContaining({ title: 'Terugbellen om 14u' })],
      {},
    )
  })
})

describe('NoteActionsPanel · created-record links per type', () => {
  it('a task creates a /tasks deep link', () => {
    render(<NoteActionsPanel items={[baseItem({ status: 'executed', created: { type: 'task', id: 'abc' } })]} onItemsChange={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Open in nieuw scherm' })).toHaveAttribute('href', expect.stringContaining('tasks?open=abc'))
  })

  it('a calllist creates an /outreach deep link', () => {
    render(<NoteActionsPanel items={[baseItem({ type: 'whatsapp', status: 'executed', created: { type: 'calllist', id: 'xyz' } })]} onItemsChange={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Open in nieuw scherm' })).toHaveAttribute('href', expect.stringContaining('outreach?open=xyz'))
  })

  it('an appointment falls back to the candidate drawer when a candidateId is supplied', () => {
    render(<NoteActionsPanel items={[baseItem({ type: 'appointment', status: 'executed', created: { type: 'appointment', id: 'apt-1' } })]}
      onItemsChange={vi.fn()} candidateId="cand-7" />)
    expect(screen.getByRole('link', { name: 'Open in nieuw scherm' })).toHaveAttribute('href', expect.stringContaining('candidates?open=cand-7'))
  })

  it('an appointment renders no link at all without a candidateId', () => {
    render(<NoteActionsPanel items={[baseItem({ type: 'appointment', status: 'executed', created: { type: 'appointment', id: 'apt-1' } })]} onItemsChange={vi.fn()} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('NoteActionsPanel · K0 auto mode (Danny punt 10)', () => {
  it('autoRun fires the batch call by itself, without any "Uitvoeren" click', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'pending', reason: 'Wacht op jouw bevestiging.' }])
    render(<Controlled initial={[baseItem()]} autoRun />)
    expect(await screen.findByText('Bevestigen')).toBeInTheDocument()
    expect(executeRichTextActions).toHaveBeenCalledTimes(1)
  })

  it('wizard mode (autoRun omitted) never calls execute on its own', () => {
    render(<NoteActionsPanel items={[baseItem()]} onItemsChange={vi.fn()} />)
    expect(executeRichTextActions).not.toHaveBeenCalled()
  })
})

describe('NoteActionsPanel · nothing to show', () => {
  it('renders nothing at all when there are no items', () => {
    const { container } = render(<NoteActionsPanel items={[]} onItemsChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
