/** MatchDrawer shared fixtures (plain data for MatchDrawer.*.test.tsx; no mocks, no component imports). */
import type { MatchRow } from '@/types/match'

// avatar_color values off the /users payload — DATA fixtures, not UI styling.
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
export const COLOR_A = '#abcdef'
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
export const COLOR_B = '#123456'

export const match = {
  id: 'm1', referenceNumber: 'M-00001', candidate: 'Jan Jansen', initials: 'JJ',
  vacancy: 'Verpleegkundige', client: 'Acme', candidateId: null, vacancyId: null, clientId: null,
  score: null, stage: '', status: 'open', stageColor: '', owner: '', ownerInitials: '', ownerColor: null,
  date: '', approval_status: 'approved', archived: false,
  helloflexLink: null, shiftmanagerLink: { status: 'linked', externalId: 'HF-9', lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null },
} as unknown as MatchRow
