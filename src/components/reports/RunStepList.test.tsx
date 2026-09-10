import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RunStepList from './RunStepList'
import type { RunStep } from '@/types/reports'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string; n?: number; count?: number; time?: string }) => opts?.defaultValue ?? k, i18n: { language: 'nl' } }) }))
vi.mock('@/lib/formatters', () => ({ formatSeconds: (ms: number) => String((ms / 1000).toFixed(1)).replace('.', ',') }))
vi.mock('@/components/layout/workflow/useModuleCatalog', () => ({ useModuleCatalog: () => ({ catalog: {} }) }))
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

// i18n is not initialised in tests, so t() returns the raw key — assertions
// check for the keys (e.g. 'runs.drawer.input').
const steps: RunStep[] = [
  { label: 'HTTP',   status: 'success', input: { url: '/x' }, output: { id: 1 } },
  { label: 'Filter', status: 'success', message: 'passed' }, // no I/O → not expandable
]

describe('RunStepList', () => {
  it('renders each step label', () => {
    render(<RunStepList steps={steps} />)
    expect(screen.getByText('HTTP')).toBeInTheDocument()
    expect(screen.getByText('Filter')).toBeInTheDocument()
  })

  it('reveals INPUT and OUTPUT only after expanding a step with I/O', () => {
    render(<RunStepList steps={steps} />)
    expect(screen.queryByText('runs.drawer.input')).toBeNull()
    fireEvent.click(screen.getByText('HTTP'))
    expect(screen.getByText('runs.drawer.input')).toBeInTheDocument()
    expect(screen.getByText('runs.drawer.output')).toBeInTheDocument()
  })

  it('does not expand a step without input/output', () => {
    render(<RunStepList steps={steps} />)
    fireEvent.click(screen.getByText('Filter'))
    expect(screen.queryByText('runs.drawer.input')).toBeNull()
  })

  it('shows the no-data placeholder for an empty bundle', () => {
    render(<RunStepList steps={[{ label: 'S', status: 'success', input: { a: 1 }, output: null }]} />)
    fireEvent.click(screen.getByText('S'))
    expect(screen.getByText('runs.drawer.noData')).toBeInTheDocument()
  })
})

// WF-DRYRUN-FE-1: a dry-run-skipped step (whatsapp_send etc.) reads as a
// DISTINCT chip, never the generic StatusBadge fallback a plain unknown status
// would get — and its "Dry-run: niet verzonden" message renders per the
// existing generic step.message treatment.
describe('RunStepList · WF-DRYRUN-FE-1 skipped rows', () => {
  it('renders a skipped step from step_results with its dry-run message', () => {
    const skipped = [
      { label: 'WhatsApp versturen', status: 'skipped', message: 'Dry-run: niet verzonden' },
      { label: 'Kandidaat bijwerken', status: 'success' },
    ]
    render(<RunStepList steps={skipped} />)
    // No real i18next instance runs in this file (mirrors the rest of this
    // suite) — t()'s own `defaultValue` option resolves instead of the raw key.
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(screen.getByText('Dry-run: niet verzonden')).toBeInTheDocument()
    // The real outcome next to it still reads as a normal success badge.
    expect(screen.getByText('success')).toBeInTheDocument()
  })
})

// RUN-MESSAGES-1 (Danny 10-09): a send step lists the messages it wrote, with an honest
// status per row and a deep link to the thread; zero recipients says so.
describe('RunStepList · RUN-MESSAGES-1', () => {
  it('lists a send step\'s messages with status chips and deep-links a row to its record', () => {
    const step: RunStep = { label: 'WhatsApp sturen', status: 'completed', ok: true,
      output: { whatsapp_sent: 0, whatsapp_queued: 1, whatsapp_skipped: [], whatsapp_errors: [] },
      messages: [{ recipient_label: 'Niels Groen', channel: 'wa_web', status: 'queued', outbox_id: 'ob-1', preview: 'Hoi Niels, kun je morgen?', conversation_id: 'cv-1', subject: { type: 'candidate', id: 'c-1' } }] }
    render(<RunStepList steps={[step]} />)
    expect(screen.getByText(/runs\.drawer\.messages\.title/)).toBeInTheDocument()
    // This suite's t() mock returns the defaultValue, i.e. the raw status; the real catalogue labels it.
    expect(screen.getByText('queued')).toBeInTheDocument()
    expect(screen.getByText('Hoi Niels, kun je morgen?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Niels Groen' }))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c-1', 'communication')
  })

  it('says "no recipients" when the engine counted none, and stays silent on a step without send counters', () => {
    render(<RunStepList steps={[
      { label: 'WhatsApp sturen', status: 'completed', ok: true, output: { whatsapp_sent: 0, whatsapp_queued: 0, whatsapp_skipped: [], whatsapp_errors: [], no_recipients: true }, messages: [] },
      { label: 'Kandidaten ophalen', status: 'completed', ok: true, output: { rows: 3 } },
    ]} />)
    expect(screen.getByText(/runs\.drawer\.messages\.noRecipients/)).toBeInTheDocument()
    expect(screen.getAllByText(/runs\.drawer\.messages\.title/)).toHaveLength(1)
  })
})
