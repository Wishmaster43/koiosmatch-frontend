/**
 * ScheduleModal — Event trigger (BIRTHDAY-FLOW-2). Real i18n is NOT initialized in
 * this test's import graph (mirrors WorkflowHistoryView.test.tsx), so `t()` returns
 * the raw key — assertions target those keys, not translated text.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScheduleModal, scheduleLabel } from './ScheduleModal'
import { WORKFLOW_EVENT_KEYS } from './eventCatalog'
import api from '@/lib/api'

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
  it('selecting the event type reveals the searchable picker with the FULL catalogue', () => {
    // TRIGGER-POPUP-2: the picker is a searchable combobox now — opening it must
    // list every dispatched event key (Danny 23-07 "alle events erbij").
    render(<ScheduleModal onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.event'))
    const input = screen.getByLabelText('scheduleModal.eventLabel') as HTMLInputElement
    expect(input).toBeInTheDocument()
    fireEvent.focus(input)
    const options = screen.getAllByRole('option').map(o => o.getAttribute('data-event-key'))
    expect(options).toEqual([...WORKFLOW_EVENT_KEYS])
  })

  it('typing in the picker filters the catalogue and clicking an option selects it', () => {
    const onSave = vi.fn()
    render(<ScheduleModal onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.event'))
    const input = screen.getByLabelText('scheduleModal.eventLabel') as HTMLInputElement
    fireEvent.focus(input)
    // Raw-key search works too (i18n is not initialized here, so labels are raw keys).
    fireEvent.change(input, { target: { value: 'match.created' } })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    fireEvent.click(options[0])
    fireEvent.click(screen.getByText('scheduleModal.save'))
    expect(onSave).toHaveBeenCalledWith('Event', { schedule_type: 'event', event: 'match.created' })
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
    // Closed combobox shows the selected event's label (raw i18n key in tests).
    const input = screen.getByLabelText('scheduleModal.eventLabel') as HTMLInputElement
    expect(input.value).toBe('triggers.events.candidate_birthday')
  })

  // BUG 2: the modal is wrapped in useFocusTrap, which attaches its own NATIVE
  // Escape listener to close the WHOLE modal. Escape while the combobox's own
  // popover is open must close only the popover, never discard the unsaved
  // trigger config by closing the modal underneath it.
  it('BUG 2 regression: Escape inside the event picker closes only the picker, never the whole modal', () => {
    const onClose = vi.fn()
    render(<ScheduleModal onSave={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.event'))
    const input = screen.getByLabelText('scheduleModal.eventLabel') as HTMLInputElement
    fireEvent.focus(input)
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)

    fireEvent.keyDown(input, { key: 'Escape' })

    // The picker's own dropdown closed…
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    // …but the surrounding modal must still be open and onClose must NOT fire.
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// BUG 3: the interval field is a controlled STRING (`intVal`); an emptied field
// becomes '' and `+''` is 0. The native `min={1}` does nothing outside a real
// form submit, so Save must be disabled instead.
describe('ScheduleModal · interval frequency', () => {
  it('BUG 3 regression: Save is disabled once the interval is cleared to empty/zero', () => {
    const onSave = vi.fn()
    render(<ScheduleModal onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.scheduled'))
    fireEvent.click(screen.getByText('scheduleModal.freq.interval'))
    const saveBtn = screen.getByText('scheduleModal.save') as HTMLButtonElement
    expect(saveBtn).not.toBeDisabled()

    // The number input still carries the bare 'scheduleModal.every' aria-label;
    // the unit picker (now CreatableSelect) shares the SAME label text but its
    // combined accessible name is "<label> <current value>", so it never
    // matches this exact query — getAllByLabelText resolves to just the input.
    const intervalInput = screen.getAllByLabelText('scheduleModal.every')
      .find(el => el.tagName === 'INPUT') as HTMLInputElement
    fireEvent.change(intervalInput, { target: { value: '' } })

    expect(saveBtn).toBeDisabled()
    fireEvent.click(saveBtn)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('re-enables Save once a valid interval (>= 1) is entered again', () => {
    const onSave = vi.fn()
    render(<ScheduleModal onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.scheduled'))
    fireEvent.click(screen.getByText('scheduleModal.freq.interval'))
    // See the regression test above: only the number input matches this exact label.
    const intervalInput = screen.getAllByLabelText('scheduleModal.every')
      .find(el => el.tagName === 'INPUT') as HTMLInputElement
    fireEvent.change(intervalInput, { target: { value: '' } })
    fireEvent.change(intervalInput, { target: { value: '5' } })

    const saveBtn = screen.getByText('scheduleModal.save') as HTMLButtonElement
    expect(saveBtn).not.toBeDisabled()
    fireEvent.click(saveBtn)
    expect(onSave).toHaveBeenCalledWith('Scheduled', { schedule_type: 'interval', interval_value: 5, interval_unit: 'minutes' })
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
  // G-LAYOUT-SELECT-1 (Danny 08-08, §4): the agent picker is now the house
  // CreatableSelect, not a native <select> — these proofs go through the
  // click-to-open interaction. The trigger's accessible name is "<field label>
  // <current value>" (CreatableSelect prefixes the aria-labelledby'd field name
  // so the value is never swallowed by it, see AvailabilityEditor.test.tsx).
  it('selecting the webhook type reveals the agent picker with the fetched agents', async () => {
    render(<ScheduleModal onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.webhook'))
    const trigger = await screen.findByRole('button', { name: 'scheduleModal.agentLabel scheduleModal.agentSelect' })
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Michelle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kees' })).toBeInTheDocument()
  })

  it('Save on the webhook type calls onSave with trigger_type-ready shape { agent: <name> }', async () => {
    const onSave = vi.fn()
    render(<ScheduleModal onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.webhook'))
    const trigger = await screen.findByRole('button', { name: 'scheduleModal.agentLabel scheduleModal.agentSelect' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Michelle' }))
    fireEvent.click(screen.getByText('scheduleModal.save'))
    expect(onSave).toHaveBeenCalledWith('Webhook', { schedule_type: 'webhook', agent: 'Michelle' })
  })

  it('reopening on an existing Webhook(agent) trigger preselects its stored agent name', async () => {
    render(<ScheduleModal trigger="Webhook" scheduleConfig={{ agent: 'Kees' }} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'scheduleModal.agentLabel Kees' })).toBeInTheDocument()
  })

  // BUG 4: a failed GET /ai/agents used to be swallowed into the same empty list
  // as "tenant genuinely has zero agents" (`.catch(() => setAgents([]))`) — a
  // recruiter could never tell a real outage from an empty tenant.
  it('BUG 4 regression: a failed agent fetch shows a distinct error, never the empty-state copy', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network down'))
    render(<ScheduleModal onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.webhook'))

    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('actionFailed')
    // Never the misleading "no agents yet" empty-state copy.
    expect(screen.queryByText('scheduleModal.agentEmpty')).not.toBeInTheDocument()
    // No picker is rendered at all, so an empty agent can never be saved from here.
    expect(screen.queryByRole('button', { name: 'scheduleModal.agentLabel scheduleModal.agentSelect' })).not.toBeInTheDocument()
  })

  it('BUG 4 regression: Save is disabled while no agent is chosen, even once agents load successfully', async () => {
    const onSave = vi.fn()
    render(<ScheduleModal onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('scheduleModal.trigger.webhook'))
    await screen.findByRole('button', { name: 'scheduleModal.agentLabel scheduleModal.agentSelect' })

    const saveBtn = screen.getByText('scheduleModal.save') as HTMLButtonElement
    expect(saveBtn).toBeDisabled()
    fireEvent.click(saveBtn)
    expect(onSave).not.toHaveBeenCalled()
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
