/**
 * SmTreeNotices + the three tree reports — a failed fetch shows the shared banner (and retries),
 * a page-capped tree shows the truncated notice (key echo through the real i18n instance).
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import i18n from '@/i18n'
import CustomersReport from './CustomersReport'
import LocationsReport from './LocationsReport'
import DepartmentsReport from './DepartmentsReport'

const reload = vi.fn()
const tree = vi.hoisted(() => ({ value: { customers: [], loading: false, error: false, truncated: false } as Record<string, unknown> }))
vi.mock('@/hooks/useSmCustomerTree', () => ({ useSmCustomerTree: () => ({ ...tree.value, reload }) }))
vi.mock('@/components/shiftmanager/ShiftsChartsBlock', () => ({ default: () => null }))
vi.mock('@/components/settings/ModuleView', () => ({ default: () => null }))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))

const sm = (key: string) => i18n.t(key, { ns: 'shiftmanager' })

beforeEach(() => { reload.mockReset() })

describe.each([
  ['CustomersReport', CustomersReport],
  ['LocationsReport', LocationsReport],
  ['DepartmentsReport', DepartmentsReport],
])('%s · load notices', (_n, Report) => {
  it('shows the error banner and retries through reload', async () => {
    tree.value = { customers: [], loading: false, error: true, truncated: false }
    render(<Report />)
    expect(screen.getByRole('alert')).toHaveTextContent(sm('mirror.loadError'))
    await userEvent.setup().click(screen.getByRole('button', { name: sm('mirror.retry') }))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('shows the truncated notice when the page cap cut the tree off', () => {
    tree.value = { customers: [], loading: false, error: false, truncated: true }
    render(<Report />)
    expect(screen.getByText(sm('mirror.truncated'))).toBeInTheDocument()
  })

  it('shows neither when the tree is healthy', () => {
    tree.value = { customers: [], loading: false, error: false, truncated: false }
    render(<Report />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(sm('mirror.truncated'))).toBeNull()
  })
})
