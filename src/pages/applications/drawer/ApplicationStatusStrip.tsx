import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import type { ApplicationDetail } from '@/types/application'

// One label-above cell in the strip; every cell renders something calm even
// when its own data is missing (§0.3, four UI states — never a blank cell).
function Cell({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}

const mutedItalic: CSSProperties = { color: 'var(--text-muted)', fontStyle: 'italic' }
const mutedLine: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }

// Whole days between an ISO date and now; null when the date is missing/unparseable.
function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000))
}

// Same score-colour thresholds as MatchScoreBlock (green ≥75, amber ≥50, red below)
// — read from there rather than re-invented so the two surfaces never drift apart.
const scoreColor = (v?: number | null): string => {
  const n = v ?? 0
  return n >= 75 ? 'var(--color-success)' : n >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
}

// The first FUTURE appointment (server order not guaranteed) — a past one is
// stale information, so it never wins over an upcoming one. A plain helper
// (not inline in the component body) keeps the Date.now() read out of render
// per the react-hooks purity rule; `now` is injectable for deterministic tests.
type Appointment = ApplicationDetail['appointments'][number]
function nextFutureAppointment(appointments: Appointment[], now: number = Date.now()): Appointment | undefined {
  return appointments
    .filter(ap => ap.when && new Date(ap.when).getTime() > now)
    .sort((x, y) => new Date(x.when).getTime() - new Date(y.when).getTime())[0]
}

interface ApplicationStatusStripProps {
  application: ApplicationDetail
}

/**
 * ApplicationStatusStrip — a calm at-a-glance strip (Danny 25-07: "ik wil zoveel
 * mogelijk relevante informatie kunnen zien") with four cells: phase, match score,
 * next appointment and interview progress. Every cell honest-gates on its own data
 * and shows a muted italic fallback rather than a blank cell.
 */
export default function ApplicationStatusStrip({ application: a }: ApplicationStatusStripProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDateTime } = useDateFormat()

  // CRITICAL (Danny 25-07 / measured): this is whole days since the application
  // was CREATED (applied), never "time in this current phase" — the backend only
  // exposes phase transitions as Dutch prose in the timeline today, so true phase
  // duration is NOT derivable honestly. See APP-STAGE-DURATIONS-1 — once that ships
  // a real phase-transition timestamp, this cell can switch to it.
  const daysInProcess = daysSince(a.created)
  const nextAppointment = nextFutureAppointment(a.appointments ?? [])

  return (
    <SectionCard title={t('status.title')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {/* Phase — soft chip + "in behandeling" days since applying (never "in fase"). */}
        <Cell label={t('status.phase')}>
          <SoftChip label={a.phaseLabel ?? a.phaseKey ?? '—'} color={a.phaseColor} />
          <div style={mutedLine}>
            {daysInProcess === null
              ? t('status.inProcess')
              : `${t('status.inProcess')} · ${t('status.days', { count: daysInProcess })}`}
          </div>
        </Cell>

        {/* Match score — same thresholds/colours as MatchScoreBlock. */}
        <Cell label={t('status.matchScore')}>
          {a.score != null
            ? <span style={{ fontWeight: 600, color: scoreColor(a.score) }}>{a.score}%</span>
            : <span style={mutedItalic}>{t('status.notScored')}</span>}
        </Cell>

        {/* Next appointment — the first upcoming one, owner on a muted second line. */}
        <Cell label={t('status.nextAppointment')}>
          {nextAppointment ? (
            <>
              <div>{(nextAppointment.title || nextAppointment.type) ?? '—'} · {formatDateTime(nextAppointment.when)}</div>
              {nextAppointment.with && <div style={mutedLine}>{nextAppointment.with}</div>}
            </>
          ) : (
            <span style={mutedItalic}>{t('status.noAppointment')}</span>
          )}
        </Cell>

        {/* Interview — current status + step progress when a session exists. */}
        <Cell label={t('status.interview')}>
          {a.interview ? (
            <>
              <div>{a.interview.currentStatus ?? t(`interview.category.${a.interview.category}`)}</div>
              {a.interview.step != null && a.interview.total > 0 && (
                <div style={mutedLine}>{t('interview.stepOf', { step: a.interview.step, total: a.interview.total })}</div>
              )}
            </>
          ) : (
            <span style={mutedItalic}>{t('status.noInterview')}</span>
          )}
        </Cell>
      </div>
    </SectionCard>
  )
}
