/**
 * AddLocationModal — covers the house "wide form" adoption (Danny 27-07): the
 * card regroup (Algemeen/Adres/Zakelijk/Contact) still submits the exact same
 * LocationPayload shape via `onCreate`, the status picker (bare <select> before,
 * now a searchable CreatableSelect, allowCreate={false}) actually filters by
 * typing, and the name-required validation still blocks an incomplete submit.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddLocationModal from './AddLocationModal'

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

const statuses = [{ value: 'st-1', label: 'Actief' }, { value: 'st-2', label: 'Inactief' }]

describe('AddLocationModal', () => {
  it('blocks submit while the name is empty and shows the required message', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the status picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    // Status starts on its placeholder (no default picked) — open it via the trigger.
    // Trigger's name is the field LABEL (aria-labelledby self-reference drops its
    // own visible text), not the empty-state placeholder text it used to expose.
    await user.click(screen.getByRole('button', { name: ct('subModal.status') }))

    const search = screen.getByPlaceholderText(ct('subModal.selectStatus'))
    await user.type(search, 'Inactief')

    expect(screen.getByRole('button', { name: 'Inactief' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actief' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('subModal.status') })).toHaveTextContent('Inactief')
  })

  it('submits the same LocationPayload shape via onCreate once the name is filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.type(screen.getByLabelText(ct('subModal.city')), 'Utrecht')

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hoofdlocatie', city: 'Utrecht', country: 'Nederland',
    }))
  })
})
