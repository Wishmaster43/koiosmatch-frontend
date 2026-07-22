/**
 * RetentionSettings (AVG-RET-2, Danny 22-07 punt 8) — asserts the REAL /settings
 * request (§13: a mutation/read test must prove the seam, never only that a
 * callback fired): the two retention windows load with tenant defaults, coerce
 * stored strings to numbers, and save both keys on a single POST.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import RetentionSettings from './RetentionSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: {} })
})

describe('RetentionSettings — load', () => {
  it('GETs /settings and renders the tenant defaults (24 / 60 months)', async () => {
    render(<RetentionSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(await screen.findByDisplayValue('24')).toBeInTheDocument()
    expect(screen.getByDisplayValue('60')).toBeInTheDocument()
  })

  it('coerces stored string values to numbers', async () => {
    api.get.mockResolvedValue({ data: { retention_months_never_placed: '36', retention_months_ever_placed: '84' } })
    render(<RetentionSettings />)
    expect(await screen.findByDisplayValue('36')).toBeInTheDocument()
    expect(screen.getByDisplayValue('84')).toBeInTheDocument()
  })
})

describe('RetentionSettings — save', () => {
  it('POSTs both retention windows to /settings on save', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    const neverPlaced = await screen.findByDisplayValue('24')

    await user.clear(neverPlaced)
    await user.type(neverPlaced, '36')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      retention_months_never_placed: '36', retention_months_ever_placed: '60',
    }))
  })
})
