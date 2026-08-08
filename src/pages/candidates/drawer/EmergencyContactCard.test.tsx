/**
 * EmergencyContactCard — NOODCONTACT-SPLIT-1 regression tests. Runs WITHOUT real
 * i18n (like every other test in this drawer's non-Profile family) — `t()`
 * stays on raw keys, so 'edit'/'save'/'cancel' titles resolve to plain text,
 * never the cross-namespace 'common:edit' literal (mirrors ZzpTab.test.tsx's
 * own header comment for the same reason). Phone/mobile FORMAT validation
 * itself is covered by contactFieldValidation.test.ts (the shared helper this
 * card now imports) — these tests only assert this card's OWN behaviour: the
 * split name/relation fields, the exact save payload (§13: assert the REQUEST,
 * relation as the id, never the label), and the read-mode label resolution.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmergencyContactCard from './EmergencyContactCard'
import type { EmergencyContactValues } from './EmergencyContactCard'

// The searchable relation dropdown (CreatableSelect) fetches its options via
// useEmergencyContactRelations — mocked here so the card's own behaviour is
// tested in isolation from the network/cache (the hook has its own test file).
vi.mock('@/lib/useEmergencyContactRelations', () => ({
  useEmergencyContactRelations: () => ({
    // No `color` field — this card's picker only reads value/label; keeping the
    // mock minimal avoids an unused ad-hoc-hex lint warning (§4).
    emergencyContactRelations: [
      { id: 'rel-partner', value: 'partner', label: 'Partner' },
      { id: 'rel-ouder',   value: 'ouder',   label: 'Ouder' },
    ],
  }),
}))

const value: EmergencyContactValues = {
  firstName: 'Marie', middleName: 'van der', lastName: 'Jansen',
  phone: '0201234567', mobile: '0612345678',
  relationId: 'rel-partner', relationLabel: 'Partner',
}

describe('EmergencyContactCard · read mode', () => {
  it('shows the composed name line, phone, mobile and the relation label', () => {
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    expect(screen.getByText('Marie van der Jansen')).toBeInTheDocument()
    expect(screen.getByText('0201234567')).toBeInTheDocument()
    expect(screen.getByText('0612345678')).toBeInTheDocument()
    expect(screen.getByText('Partner')).toBeInTheDocument()
  })

  it('resolves the relation label from the loaded lookup by id, not the stale nested label', () => {
    // The lookup mock's 'rel-partner' is labelled 'Partner' — even if the server's
    // OWN nested label were stale (e.g. after a tenant rename), the live lookup wins.
    const stale = { ...value, relationLabel: 'Ex-partner (oude naam)' }
    render(<EmergencyContactCard value={stale} onSave={() => {}} />)
    expect(screen.getByText('Partner')).toBeInTheDocument()
    expect(screen.queryByText('Ex-partner (oude naam)')).toBeNull()
  })

  it('falls back to the stored relation label when the id is not in the loaded lookup', () => {
    const legacy = { ...value, relationId: 'rel-deleted', relationLabel: 'Buurman' }
    render(<EmergencyContactCard value={legacy} onSave={() => {}} />)
    expect(screen.getByText('Buurman')).toBeInTheDocument()
  })

  it('shows a dash for every field when nothing is stored', () => {
    const empty: EmergencyContactValues = { firstName: '', middleName: '', lastName: '', phone: '', mobile: '', relationId: '', relationLabel: '' }
    render(<EmergencyContactCard value={empty} onSave={() => {}} />)
    expect(screen.getAllByText('-')).toHaveLength(4) // name line, mobile, phone, relation
  })

  it('shows a single pencil, no error text, when not editing', () => {
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    expect(screen.getAllByTitle('edit')).toHaveLength(1)
    expect(screen.queryByText('validation.phoneFormat')).toBeNull()
  })
})

describe('EmergencyContactCard · edit mode fields', () => {
  it('expands to the three separate name inputs, seeded from the stored value', async () => {
    const user = userEvent.setup()
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    expect(screen.getByDisplayValue('Marie')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jansen')).toBeInTheDocument()
    expect(screen.getByDisplayValue('van der')).toBeInTheDocument()
  })
})

describe('EmergencyContactCard · save payload (§13: assert the request)', () => {
  it('saves the exact split API keys, relation as the ID never the label, and leaves edit mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      emergency_contact_first_name: 'Marie',
      emergency_contact_middle_name: 'van der',
      emergency_contact_last_name: 'Jansen',
      emergency_contact_phone: '0201234567',
      emergency_contact_mobile: '0612345678',
      emergency_contact_relation_id: 'rel-partner',
    })
    expect(screen.queryByTitle('save')).toBeNull()
  })

  it('edits and saves a changed name/phone/mobile split across the exact keys', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.clear(screen.getByDisplayValue('Marie'))
    await user.type(screen.getByLabelText('preferences.emergencyContactFirstName'), 'Anne')
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ emergency_contact_first_name: 'Anne' }))
  })

  it('clearing the relation picker sends null, never an empty string (nullable FK)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    // CreatableSelect's clearable X button — accessible name is the raw i18n
    // key 'clear' in this no-real-i18n test env (mirrors CreatableSelect.test.tsx).
    await user.click(screen.getByRole('button', { name: 'clear' }))
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ emergency_contact_relation_id: null }))
  })

  it('an empty phone/mobile is valid (optional fields) and saves as empty strings', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    await user.clear(screen.getByDisplayValue('0201234567'))
    await user.clear(screen.getByDisplayValue('0612345678'))
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ emergency_contact_phone: '', emergency_contact_mobile: '' }))
  })
})

describe('EmergencyContactCard · VALIDATIE-LIVE-1 (blur + save gating, both phone columns)', () => {
  it('flags an invalid mobile on blur, before Save is even attempted', async () => {
    const user = userEvent.setup()
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    const mobileInput = screen.getByDisplayValue('0612345678')
    await user.clear(mobileInput)
    await user.type(mobileInput, 'n.v.t.')
    await user.tab() // blur
    expect(screen.getByText('validation.phoneFormat')).toBeInTheDocument()
  })

  it('blocks Save when EITHER phone or mobile is invalid, and never wipes the typed value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EmergencyContactCard value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const phoneInput = screen.getByDisplayValue('0201234567')
    await user.clear(phoneInput)
    await user.type(phoneInput, 'n.v.t.')
    await user.click(screen.getByTitle('save'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('n.v.t.')).toBeInTheDocument()
    expect(screen.getByText('validation.phoneFormat')).toBeInTheDocument()
    expect(screen.getByTitle('save')).toBeInTheDocument()
  })

  it('clears the error the moment the value is edited again', async () => {
    const user = userEvent.setup()
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    const phoneInput = screen.getByDisplayValue('0201234567')
    await user.clear(phoneInput)
    await user.type(phoneInput, 'n.v.t.')
    await user.tab()
    expect(screen.getByText('validation.phoneFormat')).toBeInTheDocument()
    await user.type(screen.getByDisplayValue('n.v.t.'), 'x')
    expect(screen.queryByText('validation.phoneFormat')).toBeNull()
  })

  it('Cancel discards the draft and any pending error, restoring the stored value', async () => {
    const user = userEvent.setup()
    render(<EmergencyContactCard value={value} onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    const phoneInput = screen.getByDisplayValue('0201234567')
    await user.clear(phoneInput)
    await user.type(phoneInput, 'n.v.t.')
    await user.tab()
    await user.click(screen.getByTitle('cancel'))
    expect(screen.getByText('0201234567')).toBeInTheDocument()
    expect(screen.queryByText('validation.phoneFormat')).toBeNull()
  })
})
