/**
 * InterviewWorkflowPicker — the shared vacancy/application interview-workflow
 * field (INTERVIEW-WORKFLOW-1, Appendix D/E). Key-echo i18n mock (no
 * QueryClientProvider needed — this component takes options/loading/error as
 * props, it never fetches itself).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewWorkflowPicker from './InterviewWorkflowPicker'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }) }))

const options = [
  { value: 'wf-1', label: 'Kelly · Kelly-Helpende' },
  { value: 'wf-2', label: 'Kelly · Kelly-Verpleegkundige' },
]

describe('InterviewWorkflowPicker · grouped options + clear (VAC-CLEAR-1)', () => {
  it('renders the folder-prefixed option labels and emits the picked id', async () => {
    const onChange = vi.fn()
    render(<InterviewWorkflowPicker value={null} onChange={onChange} options={options} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'aiagent.workflow.placeholder' }))
    await user.click(screen.getByRole('button', { name: 'Kelly · Kelly-Helpende' }))
    expect(onChange).toHaveBeenCalledWith('wf-1')
  })

  it('clears a picked value back to empty', async () => {
    const onChange = vi.fn()
    render(<InterviewWorkflowPicker value="wf-1" onChange={onChange} options={options} />)
    const user = userEvent.setup()
    // CreatableSelect composes the clear button's title via ICU interpolation
    // (t('clearField', { field: clearLabel })) — the mock above echoes that as
    // `clearField:{"field":"<clearLabel>"}`.
    await user.click(screen.getByTitle('clearField:{"field":"aiagent.workflow.none"}'))
    expect(onChange).toHaveBeenCalledWith('')
  })
})

describe('InterviewWorkflowPicker · presence gate (§3 no fake affordances)', () => {
  it('renders disabled with the honest notice, and never mounts an interactive control', () => {
    render(<InterviewWorkflowPicker value={null} onChange={vi.fn()} options={options} disabled notice="Beschikbaar zodra de workflow-koppeling aan de backend is" />)
    expect(screen.getByText('Beschikbaar zodra de workflow-koppeling aan de backend is')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('InterviewWorkflowPicker · four UI states', () => {
  it('shows the load-error notice', () => {
    render(<InterviewWorkflowPicker value={null} onChange={vi.fn()} options={[]} error />)
    // Own key (verdict finding 5): a failed WORKFLOW load must not read as a
    // failed AGENT load — a shared `aiagent.loadError` would blur that.
    expect(screen.getByText('aiagent.workflow.loadError')).toBeInTheDocument()
  })

  it('shows the empty-list notice once loaded with nothing to pick', () => {
    render(<InterviewWorkflowPicker value={null} onChange={vi.fn()} options={[]} />)
    expect(screen.getByText('aiagent.workflow.empty')).toBeInTheDocument()
  })

  // Verdict finding 3: a linked id must never trigger the "no workflows exist"
  // notice — the fallback option below proves workflows DO exist.
  it('never shows the empty-list notice once a workflow is actually linked', () => {
    render(<InterviewWorkflowPicker value="wf-1" onChange={vi.fn()} options={[]}
      linkedRef={{ id: 'wf-1', name: 'Zorgintake', folder: null, agent: null }} />)
    expect(screen.queryByText('aiagent.workflow.empty')).not.toBeInTheDocument()
  })
})

describe('InterviewWorkflowPicker · linked-but-missing fallback (verdict finding 2)', () => {
  it('seeds a fallback option from the nested ref when the linked workflow is missing from options', () => {
    render(<InterviewWorkflowPicker value="wf-9" onChange={vi.fn()} options={options}
      linkedRef={{ id: 'wf-9', name: 'Zorgintake', folder: { id: 'f1', name: 'Kelly' }, agent: null }} />)
    // The trigger shows the resolved name, never the raw id.
    expect(screen.getByRole('button', { name: 'Kelly · Zorgintake' })).toBeInTheDocument()
    expect(screen.queryByText('wf-9')).not.toBeInTheDocument()
  })

  // Verdict finding 4: an inactive workflow is filtered out of `options` (the
  // hook's own active-only rule) but `describe()` still resolves it against the
  // FULL fetched list — the trigger states the truth with the inactive marker
  // and the warning idiom, rather than falling through to the raw id.
  it('resolves a linked-but-inactive workflow via describe(), with the inactive marker + warning', () => {
    const describeInactive = (id: string) => (id === 'wf-9' ? { label: 'Kelly · Zorgintake', inactive: true } : null)
    render(<InterviewWorkflowPicker value="wf-9" onChange={vi.fn()} options={options} describe={describeInactive} />)
    expect(screen.getByRole('button', { name: 'Kelly · Zorgintake aiagent.workflow.inactiveSuffix' })).toBeInTheDocument()
    expect(screen.getByText('aiagent.workflow.inactiveWarning')).toBeInTheDocument()
  })
})
