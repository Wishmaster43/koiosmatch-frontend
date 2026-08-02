/**
 * AddCustomerModal — covers the house "wide form" adoption (Danny 27-07: "+
 * Klant is niet zo groot als + match en + nieuwe kandidaat EN MIST HEEL VEEL
 * INFORMATIE"): the card regroup (Bedrijf/Vestiging & plaats/Eigenaar & status/
 * Online/Facturatie), the new optional fields (branch/website/employeeCount/
 * toneOfVoice/costCenter/billingEmail) riding along in the SAME whole-form
 * object handed to `onCreate` (unchanged callback contract), the establishment
 * picker (bare `<select>` before, now searchable) actually filtering by typing,
 * and the name validation still blocking an incomplete submit.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddCustomerModal from './AddCustomerModal'

vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'] }) }))
// useLocations is react-query-backed (@tanstack/react-query) — mocked directly
// so this test doesn't need a QueryClientProvider ancestor.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }, { value: 'loc-2', label: 'Vestiging Zuid' }],
}))
// KLANT-FASE-1: TENANT-RENAMED phases — the is_default row is NOT first and is NOT
// called 'prospect', so a slug/index-based default would pick the wrong one.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false },
      { value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true },
    ],
    phaseMeta: (v?: string | null) => ({ value: v ?? '', label: v ?? '', color: '#9CA3AF', isCustomer: false, isDefault: false }),
    defaultPhase: 'interesse',
    isCustomerPhase: (v?: string | null) => v === 'vaste_klant',
    loading: false,
  }),
}))
/* eslint-enable no-restricted-syntax */

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

const users = [{ id: 'u1', name: 'Piet Recruiter' }]
const statuses = [{ value: 'actief', label: 'Actief' }]

describe('AddCustomerModal · titled cards (Danny 27-07 house frame)', () => {
  it('groups the fields into Bedrijf / Vestiging&plaats / Eigenaar&status / Online / Facturatie', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.getByText(ct('modal.fields.cardCompany'))).toBeInTheDocument()
    expect(screen.getByText(ct('modal.fields.cardBranch'))).toBeInTheDocument()
    expect(screen.getByText(ct('modal.fields.cardOwnerStatus'))).toBeInTheDocument()
    expect(screen.getByText(ct('overview.online'))).toBeInTheDocument()
    expect(screen.getByText(ct('overview.billing'))).toBeInTheDocument()
  })
})

describe('AddCustomerModal · validation', () => {
  it('blocks submit while the name is empty', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    const createBtn = screen.getByRole('button', { name: ct('modal.create') })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('AddCustomerModal · searchable establishment picker (BRANCH-1)', () => {
  it('typing narrows the option list, then picking updates the trigger', async () => {
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    // Trigger's name is now the field label (aria-labelledby self-reference drops
    // its own visible text), not the shared "common:select" placeholder text.
    await user.click(screen.getByRole('button', { name: ct('overview.branch') }))
    await user.type(screen.getByPlaceholderText(cm('select')), 'Zuid')
    expect(screen.getByRole('button', { name: 'Vestiging Zuid' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vestiging Noord' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('overview.branch') })).toHaveTextContent('Vestiging Zuid')
  })
})

describe('AddCustomerModal · new fields ride along in the whole form object (Danny 27-07 addendum)', () => {
  it('hands onCreate the extended form incl. branch/website/employeeCount/toneOfVoice/costCenter/billingEmail', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Stichting Rivas Zorggroep')
    await user.type(screen.getByLabelText(ct('overview.website'), { exact: false }), 'https://rivas.nl')
    await user.type(screen.getByLabelText(ct('overview.employeeCount'), { exact: false }), '250')
    await user.type(screen.getByLabelText(ct('overview.toneOfVoice'), { exact: false }), 'Formeel')
    await user.type(screen.getByLabelText(ct('overview.costCenter'), { exact: false }), 'CC-42')
    await user.type(screen.getByLabelText(ct('overview.billingEmail'), { exact: false }), 'facturen@rivas.nl')

    // Pick the establishment too, so branchId also proves it survives into the payload.
    // Trigger's name is now the field label, not the shared "common:select" placeholder.
    await user.click(screen.getByRole('button', { name: ct('overview.branch') }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))

    await user.click(screen.getByRole('button', { name: ct('modal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Stichting Rivas Zorggroep',
      branchId: 'loc-1',
      website: 'https://rivas.nl',
      employeeCount: '250',
      toneOfVoice: 'Formeel',
      costCenter: 'CC-42',
      billingEmail: 'facturen@rivas.nl',
    }))
  })
})

describe('AddCustomerModal · lifecycle phase (KLANT-FASE-1)', () => {
  it('pre-selects the is_default phase — read off the flag, not the "prospect" slug', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.getByRole('button', { name: ct('modal.fields.phase') })).toHaveTextContent('Interesse')
  })

  it('hands the picked phase to onCreate in the same whole-form object', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Zorgpartners')
    await user.click(screen.getByRole('button', { name: ct('modal.fields.phase') }))
    await user.click(screen.getByRole('button', { name: 'Vaste klant' }))
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ phase: 'vaste_klant' }))
  })
})
