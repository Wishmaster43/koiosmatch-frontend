/**
 * GroupField + KeyValueField (WA-SEND-FIELDS-2) — whatsapp_send's
 * `after_send_updates` group. Proves the round-trip serializes the EXACT
 * nested shape the engine reads (WhatsAppSendModule.php lines 145-146:
 * config.after_send_updates.conversation / .candidate as plain key->value
 * records), not the unrelated {name,value}[] array the 'keyvalue' field type uses.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GroupField } from './groupKeyValueFields'
import type { WorkflowField } from '@/types/workflow'

const field: WorkflowField = {
  key: 'after_send_updates', label: 'Database updates na verzending', type: 'group',
  fields: [
    { value: 'conversation', label: 'Conversation velden', type: 'key_value', suggestions: {
      state_shifts_offered: ['AWAITING', 'SENT', 'DONE'],
    } },
    { value: 'candidate', label: 'Kandidaat velden', type: 'key_value', suggestions: {
      last_offered_at: '{{now}}',
    } },
  ],
}

describe('GroupField + KeyValueField', () => {
  it('adds via a pending draft: nothing persists until a key lands, then the nested record shape', () => {
    const onChange = (_key: string, value: unknown) => { last = value }
    let last: unknown
    render(<GroupField field={field} value={{}} onChange={onChange} />)

    // Both sub-card titles render (fieldLabel through the workflows i18n bucket).
    expect(screen.getByText('Conversation velden')).toBeTruthy()
    expect(screen.getByText('Kandidaat velden')).toBeTruthy()

    // Add opens a PENDING row — a record cannot hold an empty key, so nothing
    // may persist yet, and the add button disables while the draft is open.
    const addButtons = screen.getAllByRole('button', { name: /toevoegen|add/i })
    fireEvent.click(addButtons[0])
    expect(last).toBeUndefined()
    expect(addButtons[0]).toBeDisabled()

    // Committing a key from the suggestion list writes the ENGINE's nested shape.
    fireEvent.click(screen.getAllByText(/fields\.keyName/)[0].closest('div')!.querySelector('input, [role="combobox"], button') as HTMLElement)
    // CreatableSelect option pick — the known key from the schema fixture:
    fireEvent.click(screen.getByText('state_shifts_offered'))
    expect(last).toEqual({ conversation: { state_shifts_offered: '' } })
  })

  it('round-trips a pre-filled nested record without reshaping it', () => {
    const value = { conversation: { state_shifts_offered: 'SENT' }, candidate: { last_offered_at: '{{now}}' } }
    render(<GroupField field={field} value={value} onChange={() => {}} />)
    // The persisted keys/values render back as-is (plain record, not an array) —
    // both the key select and value select trigger buttons show their picked text.
    expect(screen.getByText('state_shifts_offered')).toBeTruthy()
    expect(screen.getByText('SENT')).toBeTruthy()
    expect(screen.getByText('last_offered_at')).toBeTruthy()
    expect(screen.getByText('{{now}}')).toBeTruthy()
  })

  // Pin the suggestion sets against the MEASURED BE schema (WhatsAppSendModule::
  // configSchema) — the active_intent copy-paste divergence must never recur.
  it('after_send_updates suggestions mirror the BE schema exactly', async () => {
    const { default: whatsappSend } = await import('@/modules/whatsapp_send')
    const group = (whatsappSend.schema as Array<{ key: string; fields?: Array<{ value: string; suggestions?: Record<string, unknown> }> }>)
      .find(f => f.key === 'after_send_updates')!
    const sub = (v: string) => group.fields!.find(f => f.value === v)!
    expect(sub('conversation').suggestions).toEqual({
      state_shifts_offered: ['AWAITING', 'SENT', 'DONE'],
      state_shift_reminder: ['AWAITING', 'SENT', 'DONE'],
      state_no_response: ['AWAITING', 'SENT', 'DONE'],
      active_intent: ['AWAITING_SHIFTS_OFFERED', 'AWAITING_RESPONSE'],
    })
    expect(sub('candidate').suggestions).toEqual({ last_offered_at: '{{now}}' })
  })
})
