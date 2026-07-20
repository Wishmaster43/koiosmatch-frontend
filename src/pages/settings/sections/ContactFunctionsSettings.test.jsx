/**
 * ContactFunctionsSettings — FUNCTIONS-SPLIT-1 (Danny 2026-07-20). The backend
 * lookup may not be deployed on every tenant yet: asserts the actual GET
 * /contact-functions request, that a 404 renders a calm notice with NO live Add
 * button (§3 no fake affordances), and that a normal response renders the full
 * CRUD editor (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import ContactFunctionsSettings from './ContactFunctionsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('ContactFunctionsSettings', () => {
  it('GETs /contact-functions on mount with no params', async () => {
    api.get.mockResolvedValue({ data: [] })
    render(<ContactFunctionsSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/contact-functions', undefined))
  })

  it('shows a calm notice (no live Add button) when the endpoint 404s', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } })
    render(<ContactFunctionsSettings />)
    await screen.findByText(st('contactFunctionsSettings.notAvailable'))
    expect(screen.queryByRole('button', { name: st('contactFunctionsSettings.add') })).not.toBeInTheDocument()
  })

  it('renders the full editor with items when the endpoint responds normally', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'f1', name: 'Locatiemanager' }] })
    render(<ContactFunctionsSettings />)
    await screen.findByText('Locatiemanager')
    expect(screen.getByRole('button', { name: st('contactFunctionsSettings.add') })).toBeInTheDocument()
  })
})
