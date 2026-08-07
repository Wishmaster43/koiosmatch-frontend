/**
 * NoteActionsResultsPanel — §13: proves nothing executes without the explicit
 * "Uitvoeren" click, that the per-item confirm/forbidden/executed states
 * render honestly, and that an executed item's run_id opens the SHARED
 * RunDetailDrawer (fetched fresh via GET /workflow-runs/{id}) — never a
 * second hand-built run view.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteActionsResultsPanel from './NoteActionsResultsPanel'
import { executeNoteActions, fetchWorkflowRun } from './noteActionsExecuteApi'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
vi.mock('./noteActionsExecuteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./noteActionsExecuteApi')>()
  return { ...actual, executeNoteActions: vi.fn(), fetchWorkflowRun: vi.fn() }
})
// RunDetailDrawer has its own dedicated tests (§3A reuse) — stubbed here so this
// file only proves this panel opens it with the right fetched row.
vi.mock('@/components/reports/RunDetailDrawer', () => ({
  default: ({ run, onClose }: { run: { id?: string; workflow_name?: string }; onClose: () => void }) => (
    <div data-testid="run-drawer" data-run-id={run.id}>
      {run.workflow_name}
      <button onClick={onClose}>close-drawer</button>
    </div>
  ),
}))

const items = [
  { title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null },
  { title: 'Stuur bevestiging', type: 'whatsapp' as const, due_date: null, note_excerpt: null },
]

afterEach(() => vi.clearAllMocks())

describe('NoteActionsResultsPanel · before Uitvoeren', () => {
  it('shows the plain preview list and sends NO execute request until the user clicks', () => {
    render(<NoteActionsResultsPanel items={items} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByText('Bel terug')).toBeInTheDocument()
    expect(executeNoteActions).not.toHaveBeenCalled()
  })

  it('"Als tekst toevoegen" calls onApplyAsText — no execute call at all', async () => {
    const user = userEvent.setup()
    const onApplyAsText = vi.fn()
    render(<NoteActionsResultsPanel items={items} noteId="note-1" onApplyAsText={onApplyAsText} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Als tekst toevoegen'))
    expect(onApplyAsText).toHaveBeenCalledTimes(1)
    expect(executeNoteActions).not.toHaveBeenCalled()
  })

  it('"Verwerpen" calls onDiscard — no execute call at all', async () => {
    const user = userEvent.setup()
    const onDiscard = vi.fn()
    render(<NoteActionsResultsPanel items={items} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={onDiscard} />)
    await user.click(screen.getByText('Verwerpen'))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(executeNoteActions).not.toHaveBeenCalled()
  })
})

describe('NoteActionsResultsPanel · Uitvoeren', () => {
  it('sends the batch unconfirmed and renders one card per returned status', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([
      { title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1', template_key: 'koios_create_task' },
      { title: 'Stuur bevestiging', type: 'whatsapp', status: 'pending' },
    ])
    const user = userEvent.setup()
    render(<NoteActionsResultsPanel items={items} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)

    await user.click(screen.getByText('Uitvoeren'))

    expect(executeNoteActions).toHaveBeenCalledWith(
      [
        { title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null },
        { title: 'Stuur bevestiging', type: 'whatsapp', due_date: null, note_excerpt: null },
      ],
      { note_id: 'note-1' },
    )
    expect(await screen.findByText('Uitgevoerd')).toBeInTheDocument()
    expect(screen.getByText('Bevestigen')).toBeInTheDocument()
  })

  it('a pending item\'s Bevestigen re-POSTs just that item with confirmed:true', async () => {
    vi.mocked(executeNoteActions).mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const user = userEvent.setup()
    render(<NoteActionsResultsPanel items={[items[0]]} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    await screen.findByText('Bevestigen')

    vi.mocked(executeNoteActions).mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r9' }])
    await user.click(screen.getByText('Bevestigen'))

    expect(executeNoteActions).toHaveBeenLastCalledWith(
      [{ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, confirmed: true }],
      { note_id: 'note-1' },
    )
    expect(await screen.findByText('Uitgevoerd')).toBeInTheDocument()
  })

  it('a forbidden item shows the honest why-tooltip, with no confirm button', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([{ title: 'Stuur bevestiging', type: 'whatsapp', status: 'forbidden' }])
    const user = userEvent.setup()
    render(<NoteActionsResultsPanel items={[items[1]]} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))

    const forbidden = await screen.findByText('Geen rechten')
    expect(forbidden.closest('span')).toHaveAttribute('title', expect.stringContaining('WhatsApp'))
    expect(screen.queryByText('Bevestigen')).not.toBeInTheDocument()
  })

  it('an unsupported item renders an honest muted label, no confirm button', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'unsupported' }])
    const user = userEvent.setup()
    render(<NoteActionsResultsPanel items={[items[0]]} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    expect(await screen.findByText('Nog niet ondersteund')).toBeInTheDocument()
    expect(screen.queryByText('Bevestigen')).not.toBeInTheDocument()
  })

  it('an executed item opens the shared RunDetailDrawer via a fresh GET /workflow-runs/{id}', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1' }])
    vi.mocked(fetchWorkflowRun).mockResolvedValue({ id: 'r1', workflow_id: 'w1', workflow_name: 'Koios: maak taak', status: 'running' })
    const user = userEvent.setup()
    render(<NoteActionsResultsPanel items={[items[0]]} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    await user.click(await screen.findByText('Uitgevoerd'))

    expect(fetchWorkflowRun).toHaveBeenCalledWith('r1')
    await waitFor(() => expect(screen.getByTestId('run-drawer')).toHaveAttribute('data-run-id', 'r1'))
    expect(screen.getByText('Koios: maak taak')).toBeInTheDocument()
  })

  it('"Klaar" resets back to the plain preview list', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const user = userEvent.setup()
    render(<NoteActionsResultsPanel items={[items[0]]} noteId="note-1" onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    await screen.findByText('Bevestigen')

    await user.click(screen.getByText('Klaar'))
    expect(screen.getByText('Uitvoeren')).toBeInTheDocument()
    expect(screen.queryByText('Bevestigen')).not.toBeInTheDocument()
  })
})
