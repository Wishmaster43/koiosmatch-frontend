/**
 * CandidateDrawerFooter — the always-visible meta strip under the drawer body:
 * last contact.
 *
 * The creation stamp lived here briefly and moved back out (Danny 09-08, "ik mis
 * de bron"): source, created-by and created-on answer ONE question — where did
 * this dossier come from — so splitting them across a footer line and a field
 * elsewhere is what made the source unfindable. All three now live together in
 * CandidateOriginCard ("Herkomst") on the Profiel tab, and this strip deliberately
 * does not repeat them (§11 one source).
 *
 * Extracted from CandidateDrawer.tsx (374 lines, over the ~250 container target)
 * so the container stays a wiring file and this strip is testable on its own.
 */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { Caption } from '@/components/ui/typography'
import type { Candidate } from '@/types/candidate'

/** Footer meta strip — creation stamp (left) + last contact (right). */
export default function CandidateDrawerFooter({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat() as {
    formatDate: (d?: string | null, opts?: Intl.DateTimeFormatOptions) => string
  }
  const { labelOf: lastContactLabel } = useLastContactTypes()

  return (
    <Caption as="div" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
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
    </Caption>
  )
}
