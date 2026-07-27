/**
 * shiftmanager/AddCustomerModal — covers the house "wide form" adoption (Danny
 * 27-07): the card regroup (Bedrijf/Eigenaar & status — this SM variant has no
 * industry/establishment field, so it stays two cards, not the native entity's
 * five, see the delivery report), the status picker (bare `<select>` before, now
 * a searchable CreatableSelect) actually filtering by typing, the name
 * validation still blocking an incomplete submit, and the exact same
 * `CustomerForm` shape reaching `onCreate` (CustomersPage.tsx imports this type
 * and must keep compiling unchanged).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddCustomerModal from './AddCustomerModal'

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

describe('shiftmanager/AddCustomerModal · titled cards (Danny 27-07 house frame)', () => {
  it('groups the fields into Bedrijf / Eigenaar & status', () => {
    render(<AddCustomerModal onClose={() => {}} />)
    expect(screen.getByText(ct('modal.fields.cardCompany'))).toBeInTheDocument()
    expect(screen.getByText(ct('modal.fields.cardOwnerStatus'))).toBeInTheDocument()
  })
})

describe('shiftmanager/AddCustomerModal · validation', () => {
  it('blocks submit while the name is empty', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} />)
    const createBtn = screen.getByRole('button', { name: ct('modal.create') })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('shiftmanager/AddCustomerModal · searchable status picker', () => {
  it('typing narrows the option list, then picking updates the trigger', async () => {
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} />)
    // Default status is 'prospect', but the trigger's name is the field LABEL now
    // (aria-labelledby self-reference drops its own visible text) — the search
    // box's placeholder shares that same key (given even though a default is
    // always selected, so the search box always has an aria-label, §6).
    await user.click(screen.getByRole('button', { name: ct('modal.fields.status') }))
    await user.type(screen.getByPlaceholderText(ct('modal.fields.status')), 'Inact')
    expect(screen.getByRole('button', { name: ct('status.inactief') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ct('status.actief') })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ct('status.inactief') }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('modal.fields.status') })).toHaveTextContent(ct('status.inactief'))
  })
})

describe('shiftmanager/AddCustomerModal · submit body unchanged by the card regroup', () => {
  it('hands onCreate the exact same CustomerForm shape once the name is filled', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} />)

    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Yesway Zorg')
    await user.type(screen.getByLabelText(ct('modal.fields.debtorNumber'), { exact: false }), '10099')
    await user.type(screen.getByLabelText(ct('modal.fields.city'), { exact: false }), 'Gorinchem')
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Yesway Zorg', debtorNumber: '10099', status: 'prospect', accountManager: '', city: 'Gorinchem',
    })
  })
})
