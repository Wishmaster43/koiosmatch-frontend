/**
 * useCascadePickers · VAC-CLEAR-1 (Danny: "gekozen waarde weer leegmaken") — the
 * klant → locatie → afdeling → contactpersoon cascade is optional at every level,
 * but until now a mis-picked afdeling was permanent: you could LEAVE a level empty,
 * never empty it again. These cover the clear path through the hook's own handlers:
 * the empty id reaches the caller (which saves it as `null` → buildVacancyPatch →
 * customer_location_id/customer_department_id/contact_id: null, all three
 * `sometimes|nullable|uuid` server-side), the dependant afdeling resets with its
 * location, and clearing an afdeling never back-fills a location.
 *
 * Each picker renders on its own: with no i18n resources loaded react-i18next
 * falls back to the raw key, so all three clear buttons would otherwise share the
 * accessible name 'clearField'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCascadePickers } from './useCascadePickers'

// The customer detail behind the cascade — stubbed, so only the hook's own
// pick/clear/reset logic is under test (no fetch, no QueryClient).
vi.mock('./useCustomerCascade', () => ({
  useCustomerCascade: () => ({
    locations: [{
      id: 'loc-1', name: 'Amsterdam', departments: [{ id: 'dep-1', name: 'ICU' }],
      street: 'Damstraat', house_number: '1', house_number_suffix: 'A', postcode: '1012AB', city: 'Amsterdam', province: 'Noord-Holland', country: 'NL',
    }],
    contacts: [{ id: 'con-1', name: 'Jan Jansen' }],
  }),
}))

const onLocationChange = vi.fn()
const onDepartmentChange = vi.fn()
const onContactChange = vi.fn()

// One picker at a time, seeded with whatever is currently picked.
function Harness({ which, locationId = '', departmentId = '', contactId = '' }: {
  which: 'location' | 'department' | 'contact'; locationId?: string; departmentId?: string; contactId?: string
}) {
  const pickers = useCascadePickers({
    clientId: 'cus-1',
    customerLocationId: locationId, onLocationChange,
    customerDepartmentId: departmentId, onDepartmentChange,
    contactId, onContactChange,
  })
  return <div>{which === 'location' ? pickers.locationPicker : which === 'department' ? pickers.departmentPicker : pickers.contactPicker}</div>
}

beforeEach(() => { onLocationChange.mockClear(); onDepartmentChange.mockClear(); onContactChange.mockClear() })

describe('useCascadePickers · clearing a picked level', () => {
  it('clears the location AND resets its dependent department', async () => {
    const user = userEvent.setup()
    render(<Harness which="location" locationId="loc-1" />)
    await user.click(screen.getByRole('button', { name: 'clearField' }))
    // Empty id + empty name (+ empty address fields, V9 takeover payload) — the
    // caller turns the id/name into `null` in the PATCH body.
    expect(onLocationChange).toHaveBeenCalledWith({
      id: '', name: '', street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '', country: '',
    })
    // A department belongs to a location; dropping the location must drop it too
    // (the same dependant reset a location SWITCH already performs).
    expect(onDepartmentChange).toHaveBeenCalledWith({ id: '', name: '' })
  })

  it('clears the department without back-filling a location', async () => {
    const user = userEvent.setup()
    render(<Harness which="department" departmentId="dep-1" />)
    await user.click(screen.getByRole('button', { name: 'clearField' }))
    expect(onDepartmentChange).toHaveBeenCalledWith({ id: '', name: '' })
    // The auto-fill ("pick a department, get its parent location") must not fire
    // on an empty id — clearing would otherwise ADD a location out of nowhere.
    expect(onLocationChange).not.toHaveBeenCalled()
  })

  it('clears the contact person', async () => {
    const user = userEvent.setup()
    render(<Harness which="contact" contactId="con-1" />)
    await user.click(screen.getByRole('button', { name: 'clearField' }))
    expect(onContactChange).toHaveBeenCalledWith({ id: '', name: '' })
  })

  it('offers no clear control on a level that is still empty', () => {
    render(<Harness which="department" />)
    expect(screen.queryByRole('button', { name: 'clearField' })).not.toBeInTheDocument()
  })
})

// V9 (Danny vacatures-ronde): picking a customer location must forward its
// own address alongside id/name, so a caller can take it over onto a
// dependent form (vacancy Locatie tab) — asserted on the actual onLocationChange
// call payload, not just that a callback fired (§13).
describe('useCascadePickers · V9 address takeover payload', () => {
  it('forwards the picked location\'s address fields to onLocationChange', async () => {
    const user = userEvent.setup()
    render(<Harness which="location" />)
    await user.click(screen.getByRole('button', { name: 'common:select' }))
    await user.click(screen.getByText('Amsterdam'))
    expect(onLocationChange).toHaveBeenCalledWith({
      id: 'loc-1', name: 'Amsterdam',
      street: 'Damstraat', houseNumber: '1', houseNumberSuffix: 'A',
      postalCode: '1012AB', city: 'Amsterdam', province: 'Noord-Holland', country: 'NL',
    })
  })
})
