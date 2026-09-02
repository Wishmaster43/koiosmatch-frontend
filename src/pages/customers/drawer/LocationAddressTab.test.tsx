/**
 * LocationAddressTab — K3/K4c: proves the location's own description block now
 * carries the same second-screen pop-out + Koios generate affordances as the
 * customer's own OverviewTab company text (mirrors that block 1:1), and that a
 * saved edit still reaches the description PATCH via onSave.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import LocationAddressTab from './LocationAddressTab'
import type { Location } from '@/types/customer'

const location: Location = {
  id: 'loc-1', name: 'Vestiging Rotterdam', description: '<p>Bestaande tekst</p>',
  branchIds: [], branches: [], branchInherited: true, effectiveBranches: [],
} as unknown as Location

const renderTab = (onSave = vi.fn()) => {
  render(
    <I18nextProvider i18n={i18n}>
      <LocationAddressTab
        location={location} customerId="cust-1" contacts={[]} t={i18n.t.bind(i18n)}
        provinceOptions={[]} countryOptions={[]} branchOptions={[]}
        onSave={onSave} onAddContact={vi.fn()} onGoToContacts={vi.fn()}
      />
    </I18nextProvider>,
  )
  return { onSave }
}

describe('LocationAddressTab · description parity with the customer Bedrijf tab (K3/K4c)', () => {
  it('renders the second-screen pop-out icon on the description block', () => {
    renderTab()
    // EditableRichTextField only renders the ExternalLink icon button when its
    // `popout` prop is passed — this is the affordance itself, not a mock check.
    expect(screen.getByTitle('Open op tweede scherm')).toBeInTheDocument()
  })

  it('offers the Koios generate button once the block is opened for editing', async () => {
    const user = userEvent.setup()
    renderTab()
    const editButtons = screen.getAllByTitle('Bewerken')
    await user.click(editButtons[editButtons.length - 1])
    // RichTextEditor's assist bar only shows "Genereer met Koios" when
    // `assistGenerate` is passed through — proves the wiring reached the editor.
    expect(await screen.findByText(/genereer/i)).toBeInTheDocument()
  })

  it('still saves an edited description through the PATCH onSave (id + description only)', async () => {
    const user = userEvent.setup()
    const { onSave } = renderTab()
    const editButtons = screen.getAllByTitle('Bewerken')
    await user.click(editButtons[editButtons.length - 1])
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledWith('loc-1', { description: expect.any(String) })
  })
})

// K-249 C.4 (31-08): billingEmail is editable again on the location — the match
// billing resolver (department → location → customer) now reads it.
describe('LocationAddressTab · billing email field (K-249 C.4)', () => {
  // This fixture hands the tab a namespace-less `t` (i18n.t.bind(i18n), defaultNS
  // 'common'), so every field label here renders as its raw dotted key — the same
  // reason the neighbouring costCenter row is never asserted by label text either
  // in this file. Assert against that same raw key, consistent with the fixture.
  it('renders a billingEmail field row in the Gegevens card', () => {
    renderTab()
    expect(screen.getAllByText('locations.detail.billingEmail').length).toBeGreaterThan(0)
  })

  it('edits and saves billingEmail through the same PATCH onSave as costCenter', async () => {
    const user = userEvent.setup()
    const { onSave } = renderTab()
    // Two field-table cards render first (Gegevens, Adres — one pencil each),
    // THEN the description block — billingEmail lives in the FIRST (Gegevens) card.
    const editButtons = screen.getAllByTitle('Bewerken')
    await user.click(editButtons[0])
    // Locate the input via its own label sibling — EditableFieldTable rows have
    // no real <label>/htmlFor, mirrors OverviewTab.test.tsx's own convention.
    const label = screen.getByText('locations.detail.billingEmail')
    const input = label.nextElementSibling?.querySelector('input') as HTMLInputElement
    expect(input).toBeTruthy()
    await user.type(input, 'facturen@rotterdam.nl')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledWith('loc-1', expect.objectContaining({ billingEmail: 'facturen@rotterdam.nl' }))
  })
})
