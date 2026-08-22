/**
 * FlatRequiredFieldsToggleList — REQFIELDS-TOGGLE-RACE-1 guard proof. The screen-level
 * tests (ApplicationRequiredFieldsSettings.test.tsx) cover the DISABLED attribute, but
 * user-event never dispatches a click on a disabled button, so those tests alone
 * cannot tell the runtime `if (!loaded) return` guard from the attribute. Here the
 * toggle is deliberately stubbed as an ALWAYS-ENABLED plain button, so the click
 * genuinely reaches toggle() while loaded=false — proving the guard line itself
 * (defence-in-depth: PermissionToggle lives in untyped SettingsControls.jsx, so the
 * type system cannot prove the disabled forwarding).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import FlatRequiredFieldsToggleList from './FlatRequiredFieldsToggleList'

const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
const loadedRef = vi.hoisted(() => ({ current: true }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current, useSettingsLoaded: () => loadedRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))
// The always-enabled stub: ignores `disabled` on purpose, so the click reaches the
// component's own toggle() and only the runtime guard can stop the POST.
vi.mock('@/pages/settings/components/SettingsControls', () => ({
  PermissionToggle: ({ onChange, 'aria-label': ariaLabel }: { onChange: () => void; 'aria-label'?: string }) => (
    <button type="button" aria-label={ariaLabel} onClick={onChange}>toggle</button>
  ),
}))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {}; loadedRef.current = true })

const FIELDS = [{ key: 'name', labelKey: 'customers:overview.name' }]

describe('FlatRequiredFieldsToggleList · runtime race guard', () => {
  it('a click that REACHES toggle() while settings are still loading fires no POST', async () => {
    const user = userEvent.setup()
    loadedRef.current = false
    render(<FlatRequiredFieldsToggleList settingKey="customer_location_required_fields" fields={FIELDS} hintKey="customerRequiredFields.flatHint" />)
    await user.click(screen.getByRole('button', { name: /toggle|name/i }))
    expect(postMock).not.toHaveBeenCalled()
  })

  it('the same click persists the merged-from-stored array once loaded', async () => {
    const user = userEvent.setup()
    loadedRef.current = true
    blobRef.current = { customer_location_required_fields: ['phone'] }
    render(<FlatRequiredFieldsToggleList settingKey="customer_location_required_fields" fields={FIELDS} hintKey="customerRequiredFields.flatHint" />)
    await user.click(screen.getByRole('button', { name: /toggle|name/i }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      customer_location_required_fields: JSON.stringify(['phone', 'name']),
    })
  })
})
