/** Shared fixtures for the KoiosPendingActionCard suites (plain data, no mocks: vi.mock stays per test file). */
import type { KoiosPendingAction } from './koiosTypes'

// A mocked pending_action shape, mirroring the KOIOS-AGENT-PLAN §6 wire contract
// (dormant on the real backend — this is exactly what the FE half is built against).
export const action = (over: Partial<KoiosPendingAction> = {}): KoiosPendingAction => ({
  id: 'pa1',
  tool: 'wijzig_kandidaat_status',
  title: 'Status wijzigen naar Niet beschikbaar',
  entity_ref: { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
  preview: [{ label: 'Status', before: 'Beschikbaar', after: 'Niet beschikbaar' }],
  destructive: false,
  expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  ...over,
})
