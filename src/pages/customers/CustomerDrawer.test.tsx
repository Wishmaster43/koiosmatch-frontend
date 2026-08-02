/**
 * CustomerDrawer — KLANT-FASE-1 header phase picker.
 *
 * "Done = clicked" (§13): the picker must really be in the header, offer the TENANT's
 * phase labels, and hand the picked SLUG to onUpdate — which useCustomerRecord then
 * maps onto PATCH /customers/{id} (covered by its own request-level test). The tab
 * bodies are stubbed; this file is about the header, not the tabs.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CustomerDrawer from './CustomerDrawer'
import type { Customer } from '@/types/customer'

// Tenant-renamed phases — the picker can only show these by reading the lookup.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true },
      { value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false },
    ],
    phaseMeta: (v?: string | null) => ({ value: v ?? '', label: v ?? '', color: '#9CA3AF', isCustomer: false, isDefault: false }),
    defaultPhase: 'interesse',
    isCustomerPhase: (v?: string | null) => v === 'vaste_klant',
    loading: false,
  }),
}))
/* eslint-enable no-restricted-syntax */
// Session + tenant plumbing the shell reads; no module/permission is needed here.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false }),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// Sub-entity CRUD hooks fire their own GETs — stub them to empty, static results.
vi.mock('./hooks/useCustomerLocations', () => ({ useCustomerLocations: () => ({ locations: [] }) }))
vi.mock('./hooks/useCustomerDepartments', () => ({ useCustomerDepartments: () => ({ departments: [] }) }))
vi.mock('./hooks/useCustomerContacts', () => ({ useCustomerContacts: () => ({ contacts: [] }) }))
// Only the ACTIVE tab renders (EntityDrawer) — stub it so this stays a header test.
vi.mock('./drawer/OverviewTab', () => ({ default: () => <div>overview stub</div> }))

const ct = (key: string) => i18n.t(key, { ns: 'customers' })

// 'vaste_klant' (NOT the entry phase) — the entry-phase Status-hiding rule
// (Danny 02-08) is covered by its own describe block below; this fixture keeps
// testing the "normal" case where both pickers show.
const customer = { id: 1, name: 'Zorgpartners', initials: 'ZP', phase: 'vaste_klant', status: 'active',
  tags: [], notes: [], created: '', referenceNumber: 'D-1', city: 'Utrecht', industry: 'Zorg' } as unknown as Customer

const statuses = [{ value: 'active', label: 'Actief' }]

describe('CustomerDrawer · lifecycle phase picker (KLANT-FASE-1)', () => {
  it('shows a Fase picker in the header, next to Status, holding the current phase label', () => {
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)

    expect(screen.getByText(ct('drawer.phase'))).toBeInTheDocument()
    expect(screen.getByText(ct('drawer.status'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vaste klant' })).toBeInTheDocument()
  })

  it('picking another phase hands the SLUG to onUpdate (the PATCH path), not the label', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: 'Vaste klant' }))
    await user.click(await screen.findByRole('button', { name: 'Interesse' }))

    expect(onUpdate).toHaveBeenCalledWith(1, { phase: 'interesse' })
  })
})

describe('CustomerDrawer · Status picker hidden in the entry phase (Danny 02-08)', () => {
  it('hides the Status meta picker for a customer still in the ENTRY phase — mirrors the candidate: not deployable yet', () => {
    const entryCustomer = { ...customer, phase: 'interesse' } as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={statuses} />)

    expect(screen.getByText(ct('drawer.phase'))).toBeInTheDocument()
    expect(screen.queryByText(ct('drawer.status'))).toBeNull()
  })

  it('shows the Status meta picker again once past the entry phase', () => {
    const pastEntry = { ...customer, phase: 'vaste_klant' } as Customer
    render(<CustomerDrawer customer={pastEntry} onClose={() => {}} statuses={statuses} />)

    expect(screen.getByText(ct('drawer.status'))).toBeInTheDocument()
  })
})
