/**
 * InterviewProgressCell — the ONE interview-progress cell (category chip +
 * "step X of Y" + who's-on-turn + waiting duration), shared by the applications
 * table and the vacancy drawer's Applicants tab (CEL-DOORKLIK-CANON: never a
 * second implementation). Extracted from ApplicationsTable's own inline cell
 * unchanged (INTERVIEW-VISIBILITY-1), plus the new turn/waiting suffix — both
 * fields render only when the payload actually carries them (tolerant, §9).
 */
import { useTranslation } from 'react-i18next'
import StatusPill from '@/components/ui/StatusPill'
import { Caption, monoStyle } from '@/components/ui/typography'
import { stopPropagation } from '@/components/ui/dataTableUtils'
// DATETIME-IMPORT-LES: this cell rides in ApplicationsTable and so in the applications barrel;
// `@/lib/datetime` would drag the i18n init into every barrel consumer's test (measured 29-09:
// the candidate drawer's AddApplicationModal suite lost its key-echo stub). lib/localDate is pure.
import { formatDateTimeStr, formatHoursSince } from '@/lib/localDate'
import { interviewCategoryColor } from './data/applicationsShared'
import type { Application } from '@/types/application'

interface Props {
  interview: Application['interview']
  // Deep-links to the record's Interview tab (CEL-DOORKLIK-CANON) — omitted on a
  // surface with no such destination, the cell then renders inert.
  onClick?: () => void
}

// Only 'candidate'/'agent' are the KOIOS-ROW-2 visibility axis this cell shows —
// the other turn values (completed/pending/recruiter) belong to the status card,
// not this compact cell.
const VISIBLE_TURNS = new Set(['candidate', 'agent'])

export default function InterviewProgressCell({ interview, onClick }: Props) {
  const { t } = useTranslation('applications')
  if (!interview) return <span style={{ color: 'var(--text-muted)' }}>—</span>

  const turn = interview.turn && VISIBLE_TURNS.has(interview.turn) ? interview.turn : null
  // Only meaningful while the candidate is on turn (the backend's own invariant).
  const waitingLabel = turn === 'candidate' && interview.waitingSince
    ? formatHoursSince(interview.waitingSince, new Date(), t) : null

  return (
    // ONE row (Danny 08-08: "Bezig 2/12 1 regel geen 2 regels") — chip and
    // progress sit side by side; the compact "2/12" form keeps the column
    // narrow where the drawer can afford the spelled-out "Stap 2 van 12".
    <span onClick={onClick ? e => { stopPropagation(e); onClick() } : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default' }}>
      <StatusPill label={t(`interview.category.${interview.category}`)} color={interviewCategoryColor(interview.category)} />
      {interview.total > 0 && (
        <Caption as="span" style={monoStyle}
          title={t('interview.stepOf', { step: interview.step ?? '–', total: interview.total })}>
          {interview.step ?? '–'}/{interview.total}
        </Caption>
      )}
      {/* KOIOS-ROW-2 window: who's on turn — reuses the existing status-card keys. */}
      {turn && <Caption as="span">· {t(`interview.status.turn.${turn}`)}</Caption>}
      {/* Waiting duration, full DD-MM-YYYY HH:mm on hover (DATUM-1). */}
      {waitingLabel && (
        <Caption as="span" title={interview.waitingSince ? formatDateTimeStr(interview.waitingSince) : undefined}>
          · {waitingLabel}
        </Caption>
      )}
    </span>
  )
}
