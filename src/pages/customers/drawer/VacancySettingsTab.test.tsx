/**
 * VacancySettingsTab — the three vacancy-visibility flags moved into their own
 * tab (Danny 27-07). Covers: renders + immediate save on toggle (same PATCH keys
 * OverviewTab used to send), the tenant-default comparison (follows/deviates),
 * and the "reset to default" action. §13: asserts the onSave PATCH payload, not
 * just that a callback fired.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacancySettingsTab from './VacancySettingsTab'
import type { Customer } from '@/types/customer'

// Route the shared tenant-settings loader so the tenant default is controllable
// per test; VacancySettingsTab only READS it (saving happens in Settings, out
// of this tab's scope).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})

afterEach(() => { blobRef.current = {} })

// Matches the component's own fallback defaults: hide=false, show=true, exclude=false.
const customer = (over: Partial<Customer> = {}): Customer =>
  ({ hideCompanyName: false, showInVacancies: true, excludeFromSourcing: false, ...over }) as Customer

describe('VacancySettingsTab', () => {
  it('follows the fallback default when no tenant setting is stored — no reset action shown', () => {
    const { container } = render(<VacancySettingsTab c={customer()} onSave={vi.fn()} />)
    expect(container.textContent).toContain('vacancySettings.followsDefault')
    expect(container.textContent).not.toContain('vacancySettings.deviates')
    expect(screen.queryByRole('button', { name: /resetToDefault/ })).not.toBeInTheDocument()
  })

  it('shows "deviates" and a reset action when the customer value differs from the tenant default', () => {
    const { container } = render(<VacancySettingsTab c={customer({ hideCompanyName: true })} onSave={vi.fn()} />)
    expect(container.textContent).toContain('vacancySettings.deviates')
    expect(screen.getByRole('button', { name: /resetToDefault/ })).toBeInTheDocument()
  })

  it('reads the STORED tenant default (not just the fallback) for the comparison', () => {
    blobRef.current = { customer_default_hide_company_name: 'true' }
    const { container } = render(<VacancySettingsTab c={customer({ hideCompanyName: true })} onSave={vi.fn()} />)
    // Customer now matches the STORED default (true), even though the fallback is false.
    expect(container.textContent).toContain('vacancySettings.followsDefault')
    expect(screen.queryByRole('button', { name: /resetToDefault/ })).not.toBeInTheDocument()
  })

  it('toggling a checkbox calls onSave with exactly that key (same PATCH shape OverviewTab used)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<VacancySettingsTab c={customer()} onSave={onSave} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)
    await user.click(checkboxes[0])
    expect(onSave).toHaveBeenCalledWith({ hideCompanyName: true })
  })

  it('"reset to default" calls onSave with the tenant default value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<VacancySettingsTab c={customer({ hideCompanyName: true })} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: /resetToDefault/ }))
    expect(onSave).toHaveBeenCalledWith({ hideCompanyName: false })
  })
})
