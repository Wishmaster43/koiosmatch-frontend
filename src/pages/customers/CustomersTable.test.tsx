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
// KLANT-FASE-1: the phase lookup is stubbed with TENANT-RENAMED rows, so the chip can
// only show the right label by resolving the slug through the lookup.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true },
      { value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false },
    ],
    phaseMeta: (v?: string | null) => (
      v === 'vaste_klant' ? { value: v, label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false }
        : v === 'interesse' ? { value: v, label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true }
          : { value: v ?? '', label: v ?? '', color: '#9CA3AF', isCustomer: false, isDefault: false }
    ),
    defaultPhase: 'interesse',
    isCustomerPhase: (v?: string | null) => v === 'vaste_klant',
    loading: false,
  }),
}))
/* eslint-enable no-restricted-syntax */
// CustomerStatusChip resolves its own statusMeta via this hook (mirrors
// CandidateStatusChip's internal useLookups() call) — stub it so the status
// column is deterministic and never fires a real network request in tests.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */
vi.mock('@/lib/useCustomerLookups', () => ({
  useCustomerLookups: () => ({
    statusMeta: (v?: string | null) => (v === 'active' ? { value: 'active', label: 'Actief', color: '#16A34A' } : { value: v ?? '', label: v ?? '—', color: '#9CA3AF' }),
  }),
}))
/* eslint-enable no-restricted-syntax */
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

describe('CustomersTable · coupling column deep-link (KOPPELING-KOLOM)', () => {
  it('clicking the coupling cell opens the drawer on the koppelingen tab, not the row itself', async () => {
    const user = userEvent.setup()
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const row = { ...baseCustomer, id: 44, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: null }
    const onOpenTab = vi.fn()
    const onSelect = vi.fn()
    render(<CustomersTable rows={[row]} statusMeta={statusMeta} onOpenTab={onOpenTab} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Koppeling' }))
    expect(onOpenTab).toHaveBeenCalledWith(row, 'koppelingen')
    // stopPropagation: the row's own onSelect must not also fire.
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('CustomersTable · matches column deep-link (K8b)', () => {
  it('clicking the matches count opens the drawer on the matches tab, not the row itself', async () => {
    const user = userEvent.setup()
    const row = { ...baseCustomer, id: 45, activeMatchesCount: 7 }
    const onOpenTab = vi.fn()
    const onSelect = vi.fn()
    render(<CustomersTable rows={[row]} statusMeta={statusMeta} onOpenTab={onOpenTab} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '7' }))
    expect(onOpenTab).toHaveBeenCalledWith(row, 'matches')
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('CustomersTable · lifecycle phase chip (KLANT-FASE-1)', () => {
  it('renders the phase LABEL from the tenant lookup, not the stored slug', () => {
    const row = { ...baseCustomer, id: 50, phase: 'vaste_klant' } as Customer
    render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)

    expect(screen.getByText('Vaste klant')).toBeInTheDocument()
    expect(screen.queryByText('vaste_klant')).toBeNull()
  })

  it('puts the phase column directly NEXT TO the status column — two chips, two questions', () => {
    // 'vaste_klant' (NOT the entry phase) — a customer past entry keeps its status
    // chip; the entry-phase dash rule is covered separately below (Danny 02-08).
    const row = { ...baseCustomer, id: 51, phase: 'vaste_klant' } as Customer
    const { container } = render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)

    const headers = Array.from(container.querySelectorAll('thead th'))
    const phaseIdx = headers.findIndex(h => h.textContent?.includes('Fase'))
    const statusIdx = headers.findIndex(h => h.textContent?.includes('Status'))
    expect(phaseIdx).toBeGreaterThan(-1)
    expect(statusIdx).toBe(phaseIdx + 1)

    // Both cells carry a chip in the same row — the phase one is not swallowed by status.
    const cells = container.querySelectorAll('tbody tr td')
    expect(cells[phaseIdx].textContent).toBe('Vaste klant')
    expect(cells[statusIdx].textContent).toBe('Actief')
  })

  it('shows a dash for a customer without a phase — never an empty chip', () => {
    const row = { ...baseCustomer, id: 52, phase: '' } as Customer
    const { container } = render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)

    const headers = Array.from(container.querySelectorAll('thead th'))
    const phaseIdx = headers.findIndex(h => h.textContent?.includes('Fase'))
    const cells = container.querySelectorAll('tbody tr td')
    expect(cells[phaseIdx].textContent).toBe('—')
  })
})

describe('CustomersTable · status chip suppressed in the entry phase (Danny 02-08)', () => {
  it('renders a DASH — not a status chip — for a customer still in the entry (Prospect-equivalent) phase, even with a status value set', () => {
    const row = { ...baseCustomer, id: 53, phase: 'interesse', status: 'active' } as Customer
    const { container } = render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)

    const headers = Array.from(container.querySelectorAll('thead th'))
    const statusIdx = headers.findIndex(h => h.textContent?.includes('Status'))
    const cells = container.querySelectorAll('tbody tr td')
    expect(cells[statusIdx].textContent).toBe('—')
    expect(cells[statusIdx].textContent).not.toBe('Actief')
  })

  it('renders the real status chip for a customer past the entry phase', () => {
    const row = { ...baseCustomer, id: 54, phase: 'vaste_klant', status: 'active' } as Customer
    const { container } = render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)

    const headers = Array.from(container.querySelectorAll('thead th'))
    const statusIdx = headers.findIndex(h => h.textContent?.includes('Status'))
    const cells = container.querySelectorAll('tbody tr td')
    expect(cells[statusIdx].textContent).toBe('Actief')
  })
})

// Danny 05-08: the "Koios" column now rolls out to every entity table — this is
// the smoke test proving the header renders here too (the honest per-row rule
// lives in customerAdvice.test.ts/useCustomerAdvice.test.ts).
describe('CustomersTable · Koios column (Danny 05-08)', () => {
  it('renders the header with the Koios mark, and flags a customer with zero open vacancies', () => {
    const row = { ...baseCustomer, id: 60, openVacanciesCount: 0 } as Customer
    render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)

    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Opvolgen')).toBeInTheDocument()
  })

  it('renders an honest dash for a customer with an open vacancy', () => {
    const row = { ...baseCustomer, id: 61, openVacanciesCount: 2 } as Customer
    const { container } = render(<CustomersTable rows={[row]} statusMeta={statusMeta} />)
    const headerCell = screen.getByRole('img', { name: 'Koios AI' }).closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[col].textContent).toBe('—')
  })
})
