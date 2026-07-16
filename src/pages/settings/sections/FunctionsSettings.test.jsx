/**
 * FunctionsSettings — job 26 (2026-07-16): the "Vrije invoer toestaan" toggle must
 * default to UNCHECKED (strict) for a tenant that never explicitly saved this
 * setting, matching useFunctions.ts's own default and the backend's GET
 * /functions.allow_free_entry default (both measured as `false`). Before this fix
 * the toggle defaulted to checked/allowed and lied about the actually-enforced
 * (strict) behaviour. Also guards that an explicitly persisted value still wins
 * (no silent double-flip of real tenant data).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// useAllSettings caches the /settings blob at module scope (one fetch per session),
// so each case needs a FRESH module graph — otherwise the second test would just
// see the first test's cached response. vi.resetModules() + a dynamic re-import
// gives every test its own isolated cache/fetchStarted state.
async function renderWithSettings(settingsBlob) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  apiModule.default.get.mockImplementation(url => {
    if (url === '/settings') return Promise.resolve({ data: settingsBlob })
    if (url === '/functions') return Promise.resolve({ data: { data: [], allow_free_entry: false } })
    return Promise.resolve({ data: {} })
  })
  const { default: FunctionsSettings } = await import('./FunctionsSettings')
  render(<FunctionsSettings />)
}

describe('FunctionsSettings', () => {
  it('defaults the free-entry toggle to UNCHECKED when the tenant never saved this setting', async () => {
    await renderWithSettings({})
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('reflects an explicitly persisted true value as checked (never double-flips stored data)', async () => {
    await renderWithSettings({ functions_allow_free_entry: true })
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })
})
