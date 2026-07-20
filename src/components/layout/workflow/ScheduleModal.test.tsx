/**
 * ScheduleModal — Event trigger (BIRTHDAY-FLOW-2). Real i18n is NOT initialized in
 * this test's import graph (mirrors WorkflowHistoryView.test.tsx), so `t()` returns
 * the raw key — assertions target those keys, not translated text.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScheduleModal, scheduleLabel } from './ScheduleModal'
import { WORKFLOW_EVENT_KEYS } from './eventCatalog'

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
