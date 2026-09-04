/**
 * useNotesMeta — resolves an automation note's `meta` payload (status/phase
 * value slugs) into the reader's own language, via the tenant status/phase
 * lookups. Extracted out of NotesTab (§3 split, K-SIZE-SPLIT-A) so the
 * container stays a thin renderer; behaviour is unchanged.
 */
import { useTranslation } from 'react-i18next'
import { useLookupsOptional } from '@/context/LookupsContext'
import { useDateFormat } from '@/lib/datetime'
import { noteMetaSentence, type NoteMeta } from './noteMetaSentence'
import type { NoteItem } from '../NotesTab'

// K-225 H2: status_change/phase_change notes carry value slugs; the tenant
// status/phase lookups give the reader's own label for them.
export function useNotesMeta() {
  const { t: tCandidates } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const statusLookup = useLookupsOptional()?.statuses ?? []
  const statusLabel = (value: string) => statusLookup.find(s => String(s.value) === value)?.label ?? value
  const phaseLookup = useLookupsOptional()?.phases ?? []
  const phaseLabel = (value: string) => phaseLookup.find(p => String(p.value) === value)?.label ?? value
  const metaBody = (n: NoteItem) => noteMetaSentence(n.meta as NoteMeta | null | undefined, { t: tCandidates, statusLabel, phaseLabel, formatDate })
  return { metaBody }
}
