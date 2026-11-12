/** Shared fixtures for the CommunicationTab suites (plain data, no mocks: vi.mock stays per test file). */
import type { Candidate } from '@/types/candidate'

// Builds a minimal candidate with an optional consent block and extra fields.
export const candidate = (consent: Record<string, unknown> = {}, extra: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, consent, timeline: [], name: 'Piet', initials: 'PJ', ownerInitials: 'AB', ...extra } as unknown as Candidate)
