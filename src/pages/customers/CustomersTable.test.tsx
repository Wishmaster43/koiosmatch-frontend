/**
 * CustomersTable — reference number column (JOB1) + backoffice coupling
 * indicator (JOB2). Mirrors CandidatesTable.test.tsx's conventions: real (nl)
 * i18n via the transitive '@/lib/datetime' import, mocked useAllSettings/AppsContext.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomersTable from './CustomersTable'
import type { Customer } from '@/types/customer'
import type { BackofficeLink } from '@/lib/backofficeLink'

vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))
// Identity date formatter — this file doesn't cover date rendering itself.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: unknown) => (v == null ? '—' : String(v)), formatDateTime: (v: unknown) => String(v) }),
}))
// Tenant app gate (JOB2 coupling column) — controlled per test, defaults to "off".
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => false }) })
// Real (nl) translations, since mocking '@/lib/datetime' above removes the
// transitive '@/i18n' side-effect import the production component relies on.
import '@/i18n'

const link = (overrides: Partial<BackofficeLink> = {}): BackofficeLink => ({
  status: null, externalId: null, lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null, ...overrides,
})

const baseCustomer: Customer = {
  id: 1, name: 'Zorgpartners', initials: 'ZP', status: 'active', statusLabel: 'Actief', statusColor: '#000',
  city: 'Utrecht', industry: '', locationsCount: 0, departmentsCount: 0, contactsCount: 0, openVacanciesCount: 0,
  activeMatchesCount: 0, created: '2026-01-01', owner: 'Owner', ownerInitials: '?', ownerColor: null,
  koiosAdvice: null, helloflexLink: null, shiftmanagerLink: null, logo: null,
} as unknown as Customer

const statusMeta = () => ({ label: 'Actief', color: '#000' })

describe('CustomersTable · reference number column (JOB1)', () => {
  it('renders the real referenceNumber value, and a plain dash when absent — never a blank cell', () => {
    const withRef = { ...baseCustomer, id: 20, referenceNumber: 'D-00004' }
    const withoutRef = { ...baseCustomer, id: 21, referenceNumber: '' }
    const { container } = render(<CustomersTable rows={[withRef, withoutRef]} statusMeta={statusMeta} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toContain('D-00004')
    expect(values).toContain('—')
  })

  it('sorts by reference number when the column header is clicked', async () => {
    const user = userEvent.setup()
    const rowA = { ...baseCustomer, id: 30, referenceNumber: 'D-00003' }
    const rowB = { ...baseCustomer, id: 31, referenceNumber: 'D-00001' }
    const rowC = { ...baseCustomer, id: 32, referenceNumber: 'D-00002' }
    const { container } = render(<CustomersTable rows={[rowA, rowB, rowC]} statusMeta={statusMeta} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    await user.click(within(headerCell).getByRole('button'))

    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toEqual(['D-00001', 'D-00002', 'D-00003'])
  })
})

describe('CustomersTable · backoffice coupling indicator (JOB2)', () => {
  it('distinguishes LINKED, FAILED and NOT LINKED with a real accessible name each', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const linked = { ...baseCustomer, id: 40, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: null }
    const failed = { ...baseCustomer, id: 41, helloflexLink: link({ status: 'failed' }), shiftmanagerLink: null }
    const notLinked = { ...baseCustomer, id: 42, helloflexLink: null, shiftmanagerLink: null }
    render(<CustomersTable rows={[linked, failed, notLinked]} statusMeta={statusMeta} />)

    expect(screen.getByRole('img', { name: 'HelloFlex: Gekoppeld' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'HelloFlex: Mislukt' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Niet gekoppeld aan HelloFlex' })).toBeInTheDocument()
  })

  it('hides a system entirely when the tenant never enabled its app — never a fake "not linked"', () => {
    const row = { ...baseCustomer, id: 43, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: link({ status: 'failed' }) }
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const { rerender } = render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)
    expect(screen.getByRole('img', { name: /HelloFlex/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Shiftmanager/ })).toBeInTheDocument()

    mockUseApps.mockReturnValue({ isAppEnabled: () => false })
    rerender(<CustomersTable rows={[row]} statusMeta={statusMeta} />)
    expect(screen.queryByRole('img', { name: /HelloFlex/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /Shiftmanager/ })).toBeNull()
  })
})
