/**
 * MfaEnforcementSetting — heading renders through the SectionTitle atom, and the
 * toggle persists the tenant flag with the exact POST /settings body (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MfaEnforcementSetting from './MfaEnforcementSetting'

const st = (key: string) => i18n.t(key, { ns: 'settings' })

const loadSettings = vi.hoisted(() => vi.fn(async () => ({}) as Record<string, unknown>))
const saveSettings = vi.hoisted(() => vi.fn<(body: Record<string, unknown>) => Promise<void>>(async () => {}))
vi.mock('../lib/settingsApi', () => ({ loadSettings, saveSettings }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: () => true }) }))

afterEach(() => { vi.clearAllMocks() })

describe('MfaEnforcementSetting', () => {
  it('renders the section heading as an h3 without a local font weight', async () => {
    render(<MfaEnforcementSetting />)
    const heading = await screen.findByRole('heading', { name: st('security.enforceSection') })
    expect(heading.tagName).toBe('H3')
    expect(heading.style.fontWeight).not.toBe('700')
  })

  it('saves mfa.enforced "1" when the admin switches the policy on', async () => {
    render(<MfaEnforcementSetting />)
    const toggle = await screen.findByRole('switch')
    await waitFor(() => expect(toggle).not.toBeDisabled())
    await userEvent.click(toggle)
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith({ 'mfa.enforced': '1' }))
  })
})
