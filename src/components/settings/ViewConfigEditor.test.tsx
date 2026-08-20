/**
 * ViewConfigEditor — the per-module block arranger behind Settings → Weergaven.
 *
 * Two contracts:
 *  1. §5 — module + block names come from moduleRegistry as i18n KEYS and are
 *     translated on render. They used to be hardcoded English ("Active customers",
 *     "Fill rate") shown to every tenant in every language.
 *  2. §13 — Save asserts the REQUEST: saveSettingsKeys POSTs /settings with the
 *     stringified `view.<module>` config, in the order/enabled state on screen.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ViewConfigEditor from './ViewConfigEditor'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) } }
})

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key: string) => i18n.t(key, { ns: 'settings' })

afterEach(() => vi.clearAllMocks())

describe('ViewConfigEditor', () => {
  it('renders the module + block names through i18n, not the registry literals', async () => {
    render(<ViewConfigEditor module="customers" />)

    // Heading interpolates the TRANSLATED module name.
    expect(await screen.findByText(i18n.t('viewConfig.title', { ns: 'settings', label: st('moduleView.modules.customers') }))).toBeInTheDocument()
    expect(screen.getByText(st('moduleView.blocks.active_customers'))).toBeInTheDocument()
    expect(screen.getByText(st('moduleView.blocks.customers_without_location'))).toBeInTheDocument()
    // The old hardcoded English must be gone for a non-English tenant.
    expect(i18n.language).toBe('nl')
    expect(screen.queryByText('Active customers')).not.toBeInTheDocument()
  })

  it('POSTs the view config for this module when saved', async () => {
    const user = userEvent.setup()
    render(<ViewConfigEditor module="customers" />)

    await user.click(await screen.findByRole('button', { name: st('common.save') }))

    // Assert the REQUEST (§13): route + the stringified per-module key + its payload.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      'view.customers': JSON.stringify([
        { id: 'active_customers', enabled: true },
        { id: 'total_locations', enabled: true },
        { id: 'total_departments', enabled: true },
        { id: 'customers_without_location', enabled: true },
      ]),
    }))
  })

  it('persists a block turned off', async () => {
    const user = userEvent.setup()
    render(<ViewConfigEditor module="customers" />)

    // The enable toggle is the shared Toggle switch (role="switch"), not a plain
    // button. Its accessible NAME is the block's own label (stable); the state
    // lives in aria-checked — a hide/show name would double-signal state.
    const switches = await screen.findAllByRole('switch', { checked: true })
    await user.click(switches[0])
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => {
      const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, string>
      expect(JSON.parse(body['view.customers'])[0]).toEqual({ id: 'active_customers', enabled: false })
    })
  })
})
