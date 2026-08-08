/**
 * AssistActionsResultsPanel — §13: proves nothing executes without the
 * explicit "Uitvoeren" click, that the per-item confirm/forbidden/executed
 * states render honestly, and that an executed item's run_id opens the
 * SHARED RunDetailDrawer (fetched fresh via GET /workflow-runs/{id}) — never
 * a second hand-built run view. Promoted from the note domain
 * (CMFE-KOIOS-CONSISTENCY-1, Danny 09-08) — same assertions, `noteId` prop
 * replaced by an explicit `source` object.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssistActionsResultsPanel from './AssistActionsResultsPanel'
import { executeRichTextActions, fetchWorkflowRun } from './assistActionsExecuteApi'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
// AssistActionItemCard (rendered by this panel) now calls useDateFormat for the
// appointment start preview. useDateFormat (@/lib/datetime) imports `@/i18n`,
// which needs a REAL react-i18next (initReactI18next) to initialise — stub
// the whole hook (repo precedent: RejectionSummary.test.tsx) so nothing here
// touches the real singleton.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (d: unknown) => (d ? String(d) : '—'), formatDateTime: (d: unknown) => (d ? String(d) : '—') }),
  useLocale: () => 'nl-NL',
}))
vi.mock('./assistActionsExecuteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./assistActionsExecuteApi')>()
  return { ...actual, executeRichTextActions: vi.fn(), fetchWorkflowRun: vi.fn() }
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
const source = { note_id: 'note-1' }

afterEach(() => vi.clearAllMocks())

describe('AssistActionsResultsPanel · before Uitvoeren', () => {
  it('shows the plain preview list and sends NO execute request until the user clicks', () => {
    render(<AssistActionsResultsPanel items={items} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByText('Bel terug')).toBeInTheDocument()
    expect(executeRichTextActions).not.toHaveBeenCalled()
  })

  it('"Als tekst toevoegen" calls onApplyAsText — no execute call at all', async () => {
    const user = userEvent.setup()
    const onApplyAsText = vi.fn()
    render(<AssistActionsResultsPanel items={items} source={source} onApplyAsText={onApplyAsText} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Als tekst toevoegen'))
    expect(onApplyAsText).toHaveBeenCalledTimes(1)
    expect(executeRichTextActions).not.toHaveBeenCalled()
  })

  it('"Verwerpen" calls onDiscard — no execute call at all', async () => {
    const user = userEvent.setup()
    const onDiscard = vi.fn()
    render(<AssistActionsResultsPanel items={items} source={source} onApplyAsText={vi.fn()} onDiscard={onDiscard} />)
    await user.click(screen.getByText('Verwerpen'))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(executeRichTextActions).not.toHaveBeenCalled()
  })
})

describe('AssistActionsResultsPanel · Uitvoeren', () => {
  it('sends the batch unconfirmed and renders one card per returned status', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([
      { title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1', template_key: 'koios_create_task' },
      { title: 'Stuur bevestiging', type: 'whatsapp', status: 'pending' },
    ])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={items} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)

    await user.click(screen.getByText('Uitvoeren'))

    expect(executeRichTextActions).toHaveBeenCalledWith(
      [
        { title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, message: null, start: null },
        { title: 'Stuur bevestiging', type: 'whatsapp', due_date: null, note_excerpt: null, message: null, start: null },
      ],
      { note_id: 'note-1' },
    )
    expect(await screen.findByText('Uitgevoerd')).toBeInTheDocument()
    expect(screen.getByText('Bevestigen')).toBeInTheDocument()
  })

  it('a pending item\'s Bevestigen re-POSTs just that item with confirmed:true', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[items[0]]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    await screen.findByText('Bevestigen')

    vi.mocked(executeRichTextActions).mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r9' }])
    await user.click(screen.getByText('Bevestigen'))

    expect(executeRichTextActions).toHaveBeenLastCalledWith(
      [{ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, message: null, start: null, confirmed: true }],
      { note_id: 'note-1' },
    )
    expect(await screen.findByText('Uitgevoerd')).toBeInTheDocument()
  })

  it('a forbidden item shows the honest why-tooltip, with no confirm button', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Stuur bevestiging', type: 'whatsapp', status: 'forbidden' }])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[items[1]]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))

    const forbidden = await screen.findByText('Geen rechten')
    expect(forbidden.closest('span')).toHaveAttribute('title', expect.stringContaining('WhatsApp'))
    expect(screen.queryByText('Bevestigen')).not.toBeInTheDocument()
  })

  // CMBE 5961c673: a server-supplied reason wins over the FE's static fallback.
  it('a forbidden item with a server reason shows THAT reason, not the static fallback', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([
      { title: 'Stuur bevestiging', type: 'whatsapp', status: 'forbidden', reason: 'Deze actie is uitgeschakeld voor jouw rol.' },
    ])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[items[1]]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))

    const forbidden = await screen.findByText('Geen rechten')
    expect(forbidden.closest('span')).toHaveAttribute('title', 'Deze actie is uitgeschakeld voor jouw rol.')
  })

  // wizard_required is a K3 selection-decision status not reachable from a
  // plain field's own item types today — handled defensively for forward
  // compat, mirrored on the 'unsupported' test below.
  it('a wizard_required item carries its server reason as a tooltip, and still shows Bevestigen', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([
      { title: 'Bel terug', type: 'task', status: 'wizard_required', reason: 'Selectiebeslissing — bevestiging per item is verplicht (AI-verordening).' },
    ])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[items[0]]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))

    const confirmBtn = await screen.findByText('Bevestigen')
    expect(confirmBtn.closest('span')).toHaveAttribute('title', expect.stringContaining('Selectiebeslissing'))
  })

  // Draft message (whatsapp/email) rides through from assist into the card as
  // a one-line preview, full text reachable via the title tooltip.
  it('a whatsapp item with a draft message shows a one-line preview with the full text as its tooltip', async () => {
    const draftItem = { title: 'Stuur bevestiging', type: 'whatsapp' as const, due_date: null, note_excerpt: null, message: 'Hoi, hierbij een korte update over je sollicitatie.' }
    vi.mocked(executeRichTextActions).mockResolvedValue([{ ...draftItem, status: 'pending' }])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[draftItem]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))

    const draft = await screen.findByText('Hoi, hierbij een korte update over je sollicitatie.')
    expect(draft).toHaveAttribute('title', 'Hoi, hierbij een korte update over je sollicitatie.')
  })

  it('an unsupported item renders an honest muted label, no confirm button', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'unsupported' }])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[items[0]]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    expect(await screen.findByText('Nog niet ondersteund')).toBeInTheDocument()
    expect(screen.queryByText('Bevestigen')).not.toBeInTheDocument()
  })

  it('an executed item opens the shared RunDetailDrawer via a fresh GET /workflow-runs/{id}', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1' }])
    vi.mocked(fetchWorkflowRun).mockResolvedValue({ id: 'r1', workflow_id: 'w1', workflow_name: 'Koios: maak taak', status: 'running' })
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[items[0]]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    await user.click(await screen.findByText('Uitgevoerd'))

    expect(fetchWorkflowRun).toHaveBeenCalledWith('r1')
    await waitFor(() => expect(screen.getByTestId('run-drawer')).toHaveAttribute('data-run-id', 'r1'))
    expect(screen.getByText('Koios: maak taak')).toBeInTheDocument()
  })

  it('"Klaar" resets back to the plain preview list', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const user = userEvent.setup()
    render(<AssistActionsResultsPanel items={[items[0]]} source={source} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    await user.click(screen.getByText('Uitvoeren'))
    await screen.findByText('Bevestigen')

    await user.click(screen.getByText('Klaar'))
    expect(screen.getByText('Uitvoeren')).toBeInTheDocument()
    expect(screen.queryByText('Bevestigen')).not.toBeInTheDocument()
  })

  it('works with no source at all (a field with no linkage, e.g. a task/match description)', () => {
    render(<AssistActionsResultsPanel items={items} onApplyAsText={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByText('Bel terug')).toBeInTheDocument()
  })
})
