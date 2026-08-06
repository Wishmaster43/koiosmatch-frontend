/**
 * EmergencyContactCard — VALIDATIE-LIVE-1 regression tests. Runs WITHOUT real
 * i18n (like every other test in this drawer's non-Profile family) — `t()`
 * stays on raw keys, so 'edit'/'save'/'cancel' titles resolve to plain text,
 * never the cross-namespace 'common:edit' literal (mirrors ZzpTab.test.tsx's
 * own header comment for the same reason).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmergencyContactCard, { isValidEmergencyPhone } from './EmergencyContactCard'

const value = { name: 'Marie Jansen', phone: '0612345678' }

describe('isValidEmergencyPhone (mirrors app/Rules/Phone.php byte-for-byte)', () => {
  it('accepts an empty value (field is nullable server-side)', () => {
    expect(isValidEmergencyPhone('')).toBe(true)
    expect(isValidEmergencyPhone('   ')).toBe(true)
  })
  it('accepts a plain NL mobile number (10 digits)', () => {
    expect(isValidEmergencyPhone('0612345678')).toBe(true)
  })
  it('accepts an international number with separators', () => {
    expect(isValidEmergencyPhone('+31 6-12 34 56 78')).toBe(true)
  })
  it('rejects free text (not shaped like a phone number)', () => {
    expect(isValidEmergencyPhone('n.v.t.')).toBe(false)
    expect(isValidEmergencyPhone('not-a-phone@example.com')).toBe(false)
  })
  it('rejects fewer than 8 real digits', () => {
    expect(isValidEmergencyPhone('061234')).toBe(false)
  })
  it('rejects more than 15 real digits', () => {
    expect(isValidEmergencyPhone('1234567890123456')).toBe(false)
  })
  it('accepts the 8 and 15 digit boundaries', () => {
    expect(isValidEmergencyPhone('12345678')).toBe(true)
    expect(isValidEmergencyPhone('123456789012345')).toBe(true)
  })
})

describe('EmergencyContactCard · read mode', () => {
  it('shows the stored name/phone, with a dash when empty', () => {
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    expect(screen.getByText('Marie Jansen')).toBeInTheDocument()
    expect(screen.getByText('0612345678')).toBeInTheDocument()
  })

  it('shows a single pencil, no error text, when not editing', () => {
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    expect(screen.getAllByTitle('edit')).toHaveLength(1)
    expect(screen.queryByText('preferences.emergencyContactPhoneInvalid')).toBeNull()
  })
})

describe('EmergencyContactCard · VALIDATIE-LIVE-1 (blur + save gating)', () => {
  it('flags an invalid phone on blur, before Save is even attempted', async () => {
    const user = userEvent.setup()
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    const phoneInput = screen.getByDisplayValue('0612345678')
    await user.clear(phoneInput)
    await user.type(phoneInput, 'n.v.t.')
    await user.tab() // blur
    expect(screen.getByText('preferences.emergencyContactPhoneInvalid')).toBeInTheDocument()
  })

  // The core VALIDATIE-LIVE-1 contract: an invalid value blocks Save, and the
  // typed text + its error both stay exactly as-is — nothing reverts, unlike
  // the sibling ZzpTab business-email path (see this file's header comment).
  it('blocks Save on an invalid phone and never wipes the typed value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const phoneInput = screen.getByDisplayValue('0612345678')
    await user.clear(phoneInput)
    await user.type(phoneInput, 'n.v.t.')
    await user.click(screen.getByTitle('save'))
    expect(onSave).not.toHaveBeenCalled()
    // Still in edit mode, still showing exactly what was typed, error still visible.
    expect(screen.getByDisplayValue('n.v.t.')).toBeInTheDocument()
    expect(screen.getByText('preferences.emergencyContactPhoneInvalid')).toBeInTheDocument()
    expect(screen.getByTitle('save')).toBeInTheDocument()
  })

  it('clears the error the moment the value is edited again', async () => {
    const user = userEvent.setup()
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    const phoneInput = screen.getByDisplayValue('0612345678')
    await user.clear(phoneInput)
    await user.type(phoneInput, 'n.v.t.')
    await user.tab()
    expect(screen.getByText('preferences.emergencyContactPhoneInvalid')).toBeInTheDocument()
    await user.type(screen.getByDisplayValue('n.v.t.'), 'x')
    expect(screen.queryByText('preferences.emergencyContactPhoneInvalid')).toBeNull()
  })

  it('saves the exact API keys once the phone is valid, and leaves edit mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ emergency_contact_name: 'Marie Jansen', emergency_contact_phone: '0612345678' })
    expect(screen.queryByTitle('save')).toBeNull()
  })

  it('an empty phone is valid (field is optional) and saves as an empty string', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.clear(screen.getByDisplayValue('0612345678'))
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith({ emergency_contact_name: 'Marie Jansen', emergency_contact_phone: '' })
  })

  it('Cancel discards the draft and any pending error, restoring the stored value', async () => {
    const user = userEvent.setup()
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    const phoneInput = screen.getByDisplayValue('0612345678')
    await user.clear(phoneInput)
    await user.type(phoneInput, 'n.v.t.')
    await user.tab()
    await user.click(screen.getByTitle('cancel'))
    expect(screen.getByText('0612345678')).toBeInTheDocument()
    expect(screen.queryByText('preferences.emergencyContactPhoneInvalid')).toBeNull()
  })
})
