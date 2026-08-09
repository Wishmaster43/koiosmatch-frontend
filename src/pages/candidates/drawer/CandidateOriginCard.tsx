/**
 * CandidateOriginCard — "Herkomst": where this RECORD came from, who created it
 * and when.
 *
 * This block moved twice before landing here, and the reason matters. It first
 * lived on the Statistieken tab, which was wrong (it is not a statistic). It was
 * then split — the stamps into the drawer footer, the source as one row inside
 * the "Persoonlijk" card. Danny 09-08: "ik mis de bron". That split is exactly
 * why: buried between geslacht, nationaliteit and geboortedatum, the source reads
 * as a property of the PERSON, while it is a property of the DOSSIER. The three
 * values answer one question, so they belong in one titled block.
 *
 * Read-only by design (Danny 09-08: "Herkomst geen potloodje"). Where a dossier
 * came from and who opened it is a record of what happened, not a field you keep
 * tidy — so the whole block has no pencil at all. Correcting a wrong source is
 * rare enough to belong elsewhere; a pencil here would invite editing history.
 */
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import { FieldRow, GroupCard, GroupHeader } from './profileFieldShared'
import type { Candidate } from '@/types/candidate'

// Read-only stamp value: the text plus a small lock, so "you cannot edit this" is
// visible rather than only implied by the missing pencil (§6 — never colour/absence alone).
function Stamp({ value, locked = true }: { value: string | null | undefined; locked?: boolean }) {
  const { t } = useTranslation('candidates')
  // fontSize 12 is the canon read-value size every other profile card sets
  // explicitly (see ProfilePersonalTab.renderValue). Leaving it out let the value
  // inherit the page default and it rendered far larger than its own label.
  if (!value) return <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
      {locked && <Lock size={11} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      <span>{value}</span>
      {locked && <span className="sr-only">{t('profile.readOnlyStamp')}</span>}
    </span>
  )
}

export default function CandidateOriginCard({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDateTime } = useDateFormat() as { formatDateTime: (d?: string | null) => string }

  return (
    <div>
      {/* GroupHeader takes an actions slot; this block deliberately passes none. */}
      <GroupHeader title={t('profile.groupOrigin')}>{null}</GroupHeader>
      <GroupCard>
        {/* Source carries no lock: it is not a server stamp, it just has no edit
            path here (§3 — the icon would claim something untrue about the field). */}
        <FieldRow label={t('profile.source')}><Stamp value={c.source} locked={false} /></FieldRow>
        <FieldRow label={t('profile.createdBy')}><Stamp value={c.createdBy?.name} /></FieldRow>
        <FieldRow label={t('profile.createdAt')}><Stamp value={c.created ? formatDateTime(c.created) : null} /></FieldRow>
      </GroupCard>
    </div>
  )
}
