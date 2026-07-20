/**
 * ScheduleModal — Event trigger (BIRTHDAY-FLOW-2). Real i18n is NOT initialized in
 * this test's import graph (mirrors WorkflowHistoryView.test.tsx), so `t()` returns
 * the raw key — assertions target those keys, not translated text.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScheduleModal, scheduleLabel } from './ScheduleModal'
import { WORKFLOW_EVENT_KEYS } from './eventCatalog'

// The webhook (AI-agent) picker fetches GET /ai/agents on mount — stub it so the
// test never makes a real network call; keep the real unwrap/unwrapList (importActual).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: { get: vi.fn().mockResolvedValue({ data: { data: [{ id: 'a1', name: 'Michelle' }, { id: 'a2', name: 'Kees' }] } }) },
  }
})

describe('ScheduleModal · event trigger', () => {
  it('selecting the event type reveals the event picker with the catalogue options', () => {
    render(<ScheduleModal onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.event'))
    const select = screen.getByLabelText('scheduleModal.eventLabel') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toEqual([...WORKFLOW_EVENT_KEYS])
  })

  it('Save on the event type calls onSave with trigger_type-ready shape { event: <key> }', () => {
    const onSave = vi.fn()
    render(<ScheduleModal onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.event'))
    fireEvent.click(screen.getByText('scheduleModal.save'))
    expect(onSave).toHaveBeenCalledWith('Event', { schedule_type: 'event', event: WORKFLOW_EVENT_KEYS[0] })
  })

  it('reopening on an existing Event trigger preselects its stored event key', () => {
    render(<ScheduleModal trigger="Event" scheduleConfig={{ event: 'candidate.birthday' }} onSave={vi.fn()} onClose={vi.fn()} />)
    const select = screen.getByLabelText('scheduleModal.eventLabel') as HTMLSelectElement
    expect(select.value).toBe('candidate.birthday')
  })
})

describe('scheduleLabel · event trigger', () => {
  it('renders the event summary key with the translated event name interpolated', () => {
    // t() is uninitialized here, so it returns the key itself for both the outer
    // and the inner (event-name) lookup — this still proves the RIGHT keys are hit.
    const t = ((key: string) => key) as never
    const label = scheduleLabel(t, 'nl', 'Event', { event: 'candidate.birthday' })
    expect(label).toBe('scheduleModal.label.event')
  })
})

// AI-AGENTS-3: the webhook trigger's AI-agent flavor — a fifth trigger type whose
// config carries only the chosen agent's NAME (backend matches trigger_config.agent
// by name, never id).
describe('ScheduleModal · webhook (AI-agent) trigger', () => {
  it('selecting the webhook type reveals the agent picker with the fetched agents', async () => {
    render(<ScheduleModal onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.webhook'))
    const select = await screen.findByLabelText('scheduleModal.agentLabel') as HTMLSelectElement
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toEqual(['', 'Michelle', 'Kees'])
  })

  it('Save on the webhook type calls onSave with trigger_type-ready shape { agent: <name> }', async () => {
    const onSave = vi.fn()
    render(<ScheduleModal onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.webhook'))
    const select = await screen.findByLabelText('scheduleModal.agentLabel') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'Michelle' } })
    fireEvent.click(screen.getByText('scheduleModal.save'))
    expect(onSave).toHaveBeenCalledWith('Webhook', { schedule_type: 'webhook', agent: 'Michelle' })
  })

  it('reopening on an existing Webhook(agent) trigger preselects its stored agent name', async () => {
    render(<ScheduleModal trigger="Webhook" scheduleConfig={{ agent: 'Kees' }} onSave={vi.fn()} onClose={vi.fn()} />)
    const select = await screen.findByLabelText('scheduleModal.agentLabel') as HTMLSelectElement
    expect(select.value).toBe('Kees')
  })
})

describe('scheduleLabel · webhook trigger', () => {
  it('renders the plain webhook label when no agent is chosen yet (legacy generic-webhook flavor)', () => {
    const t = ((key: string) => key) as never
    expect(scheduleLabel(t, 'nl', 'Webhook', null)).toBe('scheduleModal.label.webhook')
  })

  it('renders the agent-named webhook summary key when an agent is set', () => {
    const t = ((key: string) => key) as never
    expect(scheduleLabel(t, 'nl', 'Webhook', { agent: 'Michelle' })).toBe('scheduleModal.label.webhookAgent')
  })
})
