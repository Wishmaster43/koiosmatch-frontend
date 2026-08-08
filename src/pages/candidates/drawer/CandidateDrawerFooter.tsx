/**
 * CandidateDrawerFooter — the always-visible meta strip under the drawer body:
 * the creation STAMP on the left, last contact on the right.
 *
 * Danny 09-08: "aangemaakt op" already lived here, so a separate Herkomst card
 * repeating it was a second truth (§11). Creation date AND author are stamps —
 * immutable, server-set, look-up-only — so they belong in this strip as ONE calm
 * line: "Aangemaakt op {datum} door {naam}". The acquisition SOURCE is not a
 * stamp (you filter, report and correct it), so it stays an editable field on the
 * Profiel tab (ProfilePersonalTab) and is deliberately NOT repeated here.
 *
 * Honest omission (§3): an unknown author drops the "door …" part entirely — the
 * date-only key is used instead, never an invented "door onbekend". A record with
 * no creation timestamp renders an empty slot rather than "Aangemaakt op —".
 *
 * Extracted from CandidateDrawer.tsx (374 lines, over the ~250 container target)
 * so the container stays a wiring file and this strip is testable on its own.
 */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import type { Candidate } from '@/types/candidate'

/** Footer meta strip — creation stamp (left) + last contact (right). */
export default function CandidateDrawerFooter({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate, formatDateTime } = useDateFormat() as {
    formatDate: (d?: string | null, opts?: Intl.DateTimeFormatOptions) => string
    formatDateTime: (d?: string | null) => string
  }
  const { labelOf: lastContactLabel } = useLastContactTypes()

  // The creation stamp: author included only when the record actually carries one.
  const creatorName = c.createdBy?.name
  const createdLine = !c.created
    ? null
    : creatorName
      ? t('drawer.createdAtBy', { date: formatDateTime(c.created), name: creatorName })
      : t('drawer.createdAt', { date: formatDateTime(c.created) })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
      <span>{createdLine}</span>
      <span>
        {t('drawer.lastContact')}:{' '}
        {(c.lastContactDate || c.lastContactType) ? (
          <span style={{ color: 'var(--text)' }}>
            {c.lastContactDate && formatDate(c.lastContactDate)}
            {c.lastContactDate && c.lastContactType && ' · '}
            {c.lastContactType && lastContactLabel(c.lastContactType)}
            {c.lastContactBy && <> · {t('drawer.byWho', { name: c.lastContactBy })}</>}
          </span>
        ) : (
          <span style={{ fontStyle: 'italic' }}>{t('drawer.notRegistered')}</span>
        )}
      </span>
    </div>
  )
}
