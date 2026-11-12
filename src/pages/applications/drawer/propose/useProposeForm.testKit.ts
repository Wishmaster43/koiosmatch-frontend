/** Shared fixtures for the useProposeForm suites (plain data, no mocks: vi.mock stays per test file). */
import type { ApplicationDetail } from '@/types/application'

export const app = (over: Partial<ApplicationDetail> = {}): ApplicationDetail => ({
  id: 1, candidateId: 'c1', customerId: 'k1', candidateName: 'Jan de Vries', vacancyTitle: 'Verpleegkundige',
  client: 'Zorggroep Noord', owner: { id: 'u1', name: 'Eva Bos', initials: 'EB', color: '#000' },
  contact: { id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl', phone: '' },
  coverLetter: null, bucket: 'active', archived: false, ...over,
} as unknown as ApplicationDetail)

