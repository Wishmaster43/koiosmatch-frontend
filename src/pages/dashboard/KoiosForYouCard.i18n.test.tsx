/**
 * KoiosForYouCard i18n pin — KOIOS-KAART-COMPACT-1 acceptance criterion "NL-
 * labels gepind (geen 'Create Task' in de DOM)". Uses the REAL i18n runtime
 * (no react-i18next mock, mirrors DashboardSwitcher.test.tsx) so this fails
 * the moment a raw English action-type string leaks into the expanded view.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
// Importing the real i18n runtime initializes it (side-effect import) — mirrors
// how the app itself boots translations; no provider wrapper needed (singleton).
import '@/i18n'
import KoiosForYouCard from './KoiosForYouCard'

// Preserve the real `unwrap` — only the network call is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<KoiosForYouCard />, { wrapper })
}

describe('KoiosForYouCard (real i18n — NL default)', () => {
  it('shows translated NL category and action labels, never the raw English/keys', async () => {
    apiGet.mockResolvedValue({
      data: {
        period: '7d',
        actions_total: 2,
        per_type: { koios_create_task: 1, koios_send_whatsapp: 1 },
        per_source: { note: 1, chat: 1 },
        latest: [
          { run_id: 'r1', template_key: 'koios_create_task', source: 'note:abc', created_at: '2026-08-01T10:00:00Z', status: 'completed' },
          { run_id: 'r2', template_key: 'koios_send_whatsapp', source: 'chat', created_at: '2026-08-02T10:00:00Z', status: 'failed' },
        ],
      },
    })
    renderCard()
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())

    // Compact: NL category chips, counts only.
    expect(screen.getByText('Taken · 1')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp · 1')).toBeInTheDocument()
    expect(screen.queryByText('Create Task')).not.toBeInTheDocument()
    expect(screen.queryByText('Send Whatsapp')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Toon details' }))

    // Expanded: NL action labels — the raw English humanize output never appears.
    expect(screen.getByText('Taak aangemaakt')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp verstuurd')).toBeInTheDocument()
    expect(screen.queryByText('Create Task')).not.toBeInTheDocument()
    expect(screen.queryByText('Send Whatsapp')).not.toBeInTheDocument()
  })
})
