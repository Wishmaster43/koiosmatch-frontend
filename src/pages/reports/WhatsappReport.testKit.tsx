/** WhatsappReport test kit: the shared envelope fixture and render helper (mocks stay per test file, vitest hoists them per file). */
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WhatsappReport from './WhatsappReport'
import type { WhatsappReportData } from '@/types/analytics'

// The server-masked number the drill rows carry, and the full number that must never render.
export const MASKED_NUMBER = '06••••5678'
export const FULL_NUMBER = '0612345678'

export const data: WhatsappReportData = {
  meta: { period: 'month', from: '2026-05-24', to: '2026-08-24', total: 40 },
  kpis: [
    { key: 'conversations_total', label: 'ignored', count: 40 },
    { key: 'active_7d', label: 'ignored', count: 18 },
    { key: 'new_in_period', label: 'ignored', count: 9 },
    { key: 'inbound_in_period', label: 'ignored', count: 25 },
    { key: 'outbound_in_period', label: 'ignored', count: 21 },
    { key: 'app_echoes_in_period', label: 'ignored', count: 5 },
    { key: 'escalations_open', label: 'ignored', count: 3 },
    { key: 'unanswered_over_window', label: 'ignored', count: 2 },
    { key: 'avg_first_response_minutes', label: 'ignored', count: 12 },
  ],
  timeseries: { bucket: 'week', series: [
    { date: '2026-05-24', inbound: 10, outbound: 8 },
    { date: '2026-08-20', inbound: 15, outbound: 13 },
  ] },
  by_direction: [
    { value: 'inbound', label: 'Inkomend', count: 25 },
    { value: 'outbound', label: 'Uitgaand', count: 15 },
  ],
  by_type: [
    { value: 'text', label: 'Tekst', count: 30 },
    { value: 'app_echo', label: 'Via app', count: 10 },
  ],
  // Real backend vocabulary: escalated/normal (not yes/no).
  by_escalated: [
    { value: 'escalated', label: 'Geëscaleerd', count: 3 },
    { value: 'normal', label: 'Niet geëscaleerd', count: 37 },
  ],
  // Real shape: candidate name + volume — no wa_number here (drill rows only).
  top_conversations: [
    { conversation_id: 'conv-1', candidate: 'Jan Jansen', message_count: 42, last_message_at: '2026-08-20' },
    { conversation_id: 'conv-2', candidate: null, message_count: 30, last_message_at: null },
  ],
}

export function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <WhatsappReport period="month" />
    </QueryClientProvider>,
  )
}
