/**
 * G-009 — the mailbox OAuth result must survive the shell's hash sync: the section reads and strips
 * the callback params, and the shell then settles on the plain tab hash. Registry mocked down to a
 * stand-in section that consumes the params exactly like EmailSettings does (mount effect).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import SettingsPage from './SettingsPage'
import { getHashParams, stripOauthParams } from '@/lib/hashQuery'

// Stand-in for EmailSettings: shows the outcome and strips the params on mount.
function OauthSection({ context }: { context: string }) {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const p = getHashParams(window.location.hash)
    const outcome = p.get('email_oauth')
    if (!outcome) return
    if (outcome === 'error' || p.get('context') === context) {
      setMsg(`${outcome}:${p.get('email') ?? p.get('reason') ?? ''}`)
      stripOauthParams()
    }
  }, [context])
  return <div>{msg || 'no-result'}</div>
}

vi.mock('./registry', () => ({
  NAV_GROUPS: [
    {
      key: 'communication', icon: null,
      items: [
        { id: 'email_customers', render: () => <OauthSection context="klanten" /> },
        { id: 'email_candidates', render: () => <OauthSection context="kandidaten" /> },
      ],
    },
  ],
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: () => true, hasModule: () => true, hasPermission: () => true }),
}))
vi.mock('./catalog/useSettingsNavColors', () => ({ useSettingsNavColors: () => ({ colorOf: () => undefined, map: {}, itemOf: () => undefined }) }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => ({ isAppEnabled: () => true }) }))

afterEach(() => { window.location.hash = ''; vi.clearAllMocks() })

describe('SettingsPage OAuth landing', () => {
  it('shows the connected result on the context tab and settles on the plain tab hash', async () => {
    window.location.hash = '#settings/communication?email_oauth=connected&context=klanten&email=info%40yesway.nl'
    render(<SettingsPage />)
    expect(await screen.findByText('connected:info@yesway.nl')).toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).not.toContain('email_oauth'))
    expect(window.location.hash).toBe('#settings/communication/email_customers')
  })

  it('shows an error result with its reason on the candidate tab', async () => {
    window.location.hash = '#settings/communication?email_oauth=error&context=kandidaten&reason=browser_mismatch'
    render(<SettingsPage />)
    expect(await screen.findByText('error:browser_mismatch')).toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#settings/communication/email_candidates'))
  })
})
