/**
 * ApiKeyGeneralTab — K-282: the "Maak primair" action is absent on the key that
 * is already primary, present on any other key, and calls the passed-down
 * onMakePrimary handler unchanged (the confirm + PATCH flow itself lives one
 * level up in ApiKeyDetail — see ApiKeyDetail.makePrimary.test.jsx).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ApiKeyGeneralTab from './ApiKeyGeneralTab'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => cleanup())

const apiKey = (over = {}) => ({
  id: 'k1', friendly_name: 'Backoffice key', type: 'additional', organisation: 'Yesway',
  description: '', guid: 'abcd1234-5678-90ab-cdef-1234567890ab',
  created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z',
  contact_name: '', contact_email: '', allowed_ips: [], ...over,
})

describe('ApiKeyGeneralTab — K-282 make-primary action', () => {
  it('shows "Maak primair" for a non-primary key', () => {
    render(<ApiKeyGeneralTab apiKey={apiKey({ type: 'additional' })} onSave={vi.fn()} onMakePrimary={vi.fn()} />)
    expect(screen.getByRole('button', { name: st('apiKeys.makePrimary') })).toBeInTheDocument()
  })

  it('hides "Maak primair" once the key is already primary', () => {
    render(<ApiKeyGeneralTab apiKey={apiKey({ type: 'primary' })} onSave={vi.fn()} onMakePrimary={vi.fn()} />)
    expect(screen.queryByRole('button', { name: st('apiKeys.makePrimary') })).not.toBeInTheDocument()
  })

  it('clicking "Maak primair" calls the onMakePrimary prop', async () => {
    const onMakePrimary = vi.fn()
    const user = userEvent.setup()
    render(<ApiKeyGeneralTab apiKey={apiKey({ type: 'additional' })} onSave={vi.fn()} onMakePrimary={onMakePrimary} />)

    await user.click(screen.getByRole('button', { name: st('apiKeys.makePrimary') }))
    expect(onMakePrimary).toHaveBeenCalledTimes(1)
  })
})
