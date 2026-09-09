/**
 * KeyValueField (WA-SEND-FIELDS-2) — proves the round-trip serializes a plain
 * key->value RECORD (not the unrelated {name,value}[] array the 'keyvalue'
 * field type uses). GroupField (the 'group' field type) was removed by
 * WA-MODULE point 19: whatsapp_send's own `after_send_updates` was its only
 * registry consumer, and no module declares a 'group' field any more
 * (grep over src/modules confirms zero) — so its tests go with it. The
 * remaining consumer of 'key_value' is shift_score (`punten`,
 * `klant_aanpassingen`), which this fixture mirrors.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyValueField } from './groupKeyValueFields'

const suggestions = { week_1: '10', week_2: '9' }

describe('KeyValueField', () => {
  it('adds via a pending draft: nothing persists until a key lands', () => {
    const onChange = (_key: string, value: unknown) => { last = value }
    let last: unknown
    render(<KeyValueField value={{}} onChange={onChange} fieldKey="punten" suggestions={suggestions} />)

    // Add opens a PENDING row — a record cannot hold an empty key, so nothing
    // may persist yet, and the add button disables while the draft is open.
    const addButton = screen.getByRole('button', { name: /toevoegen|add/i })
    fireEvent.click(addButton)
    expect(last).toBeUndefined()
    expect(addButton).toBeDisabled()

    // Committing a key from the suggestion list writes the record shape.
    fireEvent.click(screen.getByText(/fields\.keyName/).closest('div')!.querySelector('input, [role="combobox"], button') as HTMLElement)
    fireEvent.click(screen.getByText('week_1'))
    expect(last).toEqual({ week_1: '' })
  })

  it('round-trips a pre-filled record without reshaping it', () => {
    const value = { week_1: '10', week_2: '9' }
    render(<KeyValueField value={value} onChange={() => {}} fieldKey="punten" suggestions={suggestions} />)
    // The persisted keys/values render back as-is (plain record, not an array).
    expect(screen.getByText('week_1')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('week_2')).toBeTruthy()
    expect(screen.getByText('9')).toBeTruthy()
  })
})
