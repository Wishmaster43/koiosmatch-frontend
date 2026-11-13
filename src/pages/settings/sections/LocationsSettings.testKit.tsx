/** LocationsSettings test kit: pure fixtures and render/translation helpers shared by the split test files (vi.mock calls stay in each test file). */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import LocationsSettings from './LocationsSettings'

// Every render gets its own QueryClient (the connector columns read through react-query).
export const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LocationsSettings /></QueryClientProvider>)

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
export const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// The house ConfirmDialog (useConfirm) renders its Confirm/Cancel labels from the
// 'common' namespace's TOP-LEVEL keys (not settings.json's nested "common" block
// that `st('common.*')` resolves) — its own helper keeps that distinction honest.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

// Click Delete for a row, then resolve the house confirm dialog it stages
// (never native window.confirm) by clicking Confirm or Cancel inside it.
export const confirmDelete = async (user: ReturnType<typeof userEvent.setup>, name: string, { accept = true }: { accept?: boolean } = {}) => {
  await user.click(screen.getByRole('button', { name: st('locations.delete') }))
  const dialog = await screen.findByRole('dialog', { name: st('locations.confirmDelete', { name }) })
  await user.click(within(dialog).getByRole('button', { name: accept ? ct('confirm') : ct('cancel') }))
}

export const location = (over: Record<string, unknown> = {}) => ({
  id: 'loc1', name: 'Kantoor Rotterdam', street: 'Coolsingel', house_number: '1', house_number_suffix: '',
  postal_code: '3011AD', city: 'Rotterdam', country: 'Nederland', coc_number: '', vat_number: '',
  contact_name: '', phone: '', email: '',
  address: 'Coolsingel 1, 3011AD Rotterdam', full_address: 'Coolsingel 1, 3011AD Rotterdam',
  lat: 51.9225, lng: 4.47917, created_at: '2026-07-01T10:00:00Z', in_use: false,
  ...over,
})

