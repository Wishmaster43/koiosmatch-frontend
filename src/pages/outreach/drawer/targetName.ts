// Display name of a call-list target's candidate (full name, else first + last); shared by the tab's search filter and the row.
import type { OutreachTarget } from '../hooks/useOutreachDetail'

export const targetCandidateName = (tg: OutreachTarget): string =>
  tg.candidate?.name ?? [tg.candidate?.first_name, tg.candidate?.last_name].filter(Boolean).join(' ') ?? '—'
