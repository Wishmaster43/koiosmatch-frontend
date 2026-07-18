/**
 * PreferencesTab / ZzpTab — sub-tab regression tests (Danny kandidaten-ronde-2,
 * punten D/E). Both tabs' underlying EditableFieldTable pulls in useDateFormat
 * for its 'date' field type, which transitively initialises real i18n — stub it
 * so `t()` stays on raw keys, like EditableFieldTable.test.tsx and every other
 * test in this repo that doesn't deliberately opt into real i18n.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreferencesTab, ZzpTab } from './PreferencesZzpTabs'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ candidateTypes: [], statusMeta: () => ({ label: '', color: '#000' }) }),
}))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [], allowFreeEntry: true }) }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: [] }) }))
vi.mock('@/lib/useDriverLicenses', () => ({ useDriverLicenses: () => ({ licenses: [] }) }))

const candidate = (): Candidate => ({
  id: 1, candidateTypes: [], preferences: {}, zzp: {}, archived: false, status: 'available',
} as unknown as Candidate)

describe('PreferencesTab · sub-tabs (kandidaten-ronde-2, punt D)', () => {
  it('renders the four sub-tabs in the named (non-alphabetical) order, defaulting to Beschikbaarheid', () => {
    render(<PreferencesTab c={candidate()} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs).toEqual(['preferences.groupAvailability', 'preferences.groupTravel', 'preferences.groupFinancial', 'preferences.groupOther'])
    expect(screen.getByRole('tab', { name: 'preferences.groupAvailability' })).toHaveAttribute('aria-selected', 'true')
    // An availability-only field is visible by default; a travel-only field isn't.
    expect(screen.getByText('preferences.days')).toBeInTheDocument()
    expect(screen.queryByText('preferences.ownTransport')).toBeNull()
  })

  // Addendum 4: Beschikbaarheid's own group-card title ("Beschikbaarheid") would
  // just repeat the sub-tab bar right above it — it must not render twice.
  it('does not repeat the Beschikbaarheid label as an in-content group heading', () => {
    render(<PreferencesTab c={candidate()} />)
    expect(screen.getAllByText('preferences.groupAvailability')).toHaveLength(1) // the sub-tab button only
  })

  it('Reizen shows the travel fields (eigen vervoer, rijbewijs, reisafstand) and hides Beschikbaarheid, with no repeated Reizen heading', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupTravel' }))
    expect(screen.getByText('preferences.ownTransport')).toBeInTheDocument()
    expect(screen.getByText('preferences.license')).toBeInTheDocument()
    expect(screen.getByText('preferences.maxDistance')).toBeInTheDocument()
    expect(screen.queryByText('preferences.days')).toBeNull()
    expect(screen.getAllByText('preferences.groupTravel')).toHaveLength(1) // the sub-tab button only
  })

  // Punt D update: Financieel took over Loonheffing (was under Overig) and keeps
  // its OWN "Loonheffing" group-card heading — a genuine sub-section, distinct
  // from the "Financieel" sub-tab label, so it's allowed to stay.
  it('Financieel shows the Loonheffing fields under their own (non-duplicate) group heading', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupFinancial' }))
    expect(screen.getByText('preferences.wageTax')).toBeInTheDocument()
    expect(screen.getByText('preferences.wageTaxFrom')).toBeInTheDocument()
    expect(screen.getByText('preferences.groupPayroll')).toBeInTheDocument()
    // Opmerkingen (Overig) isn't part of Financieel.
    expect(screen.queryByText('preferences.remarks')).toBeNull()
  })

  // Overig now holds ONLY Opmerkingen (Loonheffing moved to Financieel) — its
  // single remaining group shares its own label with the sub-tab, so addendum 4
  // strips that heading too (one calm, un-headed card).
  it('Overig now holds only Opmerkingen, with no repeated Overig heading', async () => {
    const user = userEvent.setup()
    render(<PreferencesTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'preferences.groupOther' }))
    expect(screen.getByText('preferences.remarks')).toBeInTheDocument()
    expect(screen.queryByText('preferences.wageTax')).toBeNull()
    expect(screen.getAllByText('preferences.groupOther')).toHaveLength(1) // the sub-tab button only
  })
})

describe('ZzpTab · sub-tabs (kandidaten-ronde-2, punt E)', () => {
  it('renders Bedrijf · Facturatie, defaulting to Bedrijf', () => {
    render(<ZzpTab c={candidate()} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs).toEqual(['zzp.groupCompany', 'zzp.groupInvoicing'])
    expect(screen.getByRole('tab', { name: 'zzp.groupCompany' })).toHaveAttribute('aria-selected', 'true')
  })

  // Addendum 4: Bedrijf's own "Bedrijf" group-card would repeat the sub-tab bar,
  // so only that heading is stripped — Adres is a genuine distinct sub-section
  // ("Adres hoort bij bedrijf") and keeps its own heading.
  it('Bedrijf includes the company address cluster, with Adres kept as its own heading but no repeated Bedrijf heading', () => {
    render(<ZzpTab c={candidate()} />)
    expect(screen.getByText('zzp.companyName')).toBeInTheDocument()
    expect(screen.getByText('zzp.street')).toBeInTheDocument()
    expect(screen.getByText('zzp.groupAddress')).toBeInTheDocument()
    expect(screen.getAllByText('zzp.groupCompany')).toHaveLength(1) // the sub-tab button only
    // Invoicing fields aren't part of the default Bedrijf sub-tab.
    expect(screen.queryByText('zzp.creditor')).toBeNull()
  })

  it('Facturatie shows crediteur/e-mail/IBAN and hides the company fields, with no repeated Facturatie heading', async () => {
    const user = userEvent.setup()
    render(<ZzpTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'zzp.groupInvoicing' }))
    expect(screen.getByText('zzp.creditor')).toBeInTheDocument()
    expect(screen.getByText('zzp.businessEmail')).toBeInTheDocument()
    expect(screen.getByText('zzp.iban')).toBeInTheDocument()
    expect(screen.queryByText('zzp.companyName')).toBeNull()
    expect(screen.getAllByText('zzp.groupInvoicing')).toHaveLength(1) // the sub-tab button only
  })
})
