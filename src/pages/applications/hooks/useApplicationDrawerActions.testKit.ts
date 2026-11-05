/** useApplicationDrawerActions · shared fixtures for the split suites (plain data and builders, no mocks). */
import type { Application, ApplicationDetail } from '@/types/application'
import type { LookupItem } from '@/context/LookupsContext'
import type { Id } from '@/types/common'

export const t = ((k: string) => k) as unknown as import('i18next').TFunction

export const FUNNEL: LookupItem[] = [
  { value: 'applied',  label: 'Gesolliciteerd', color: 'slate' },
  { value: 'rejected', label: 'Afgewezen',      color: 'red', is_rejected: true },
]

export const app = (overrides: Partial<Application> = {}): Application => ({
  id: 1, candidateId: 9, candidateName: 'Test kandidaat', candidateInitials: 'TK',
  vacancyId: 1, vacancyTitle: 'Verpleegkundige', client: 'Acme', customerId: 1, referenceNumber: 'S-1',
  score: null, task: '', phaseKey: 'applied', bucket: 'active', source: '', sourceKey: null,
  owner: { id: null, name: '', initials: '', color: null },
  candidateStatusLabel: '', candidateStatusColor: '', candidateStatus: '', candidatePhase: '',
  created: '2026-07-01', isNew: false, archived: false, deletedAt: null,
  ...overrides,
} as Application)

// Recruiter list for handleOwner tests.
export const USERS: Array<{ id: Id; name: string }> = [{ id: 'u2', name: 'Nieuwe Recruiter' }]

// Minimal ApplicationDetail fixture — mirrors VacancyTab.test.tsx's own `app` helper
// (`as unknown as ApplicationDetail`), since the full interface needs many fields no
// handler under test here actually reads.
export const detail = (overrides: Partial<ApplicationDetail> = {}): ApplicationDetail =>
  ({ ...app(), customFields: {}, matchCriteria: [], matchSource: 'ai', ...overrides } as unknown as ApplicationDetail)
