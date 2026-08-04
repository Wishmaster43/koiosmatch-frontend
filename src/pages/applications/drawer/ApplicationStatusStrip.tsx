import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import type { ApplicationDetail } from '@/types/application'

// One label-above cell in the strip; every cell renders something calm even
// when its own data is missing (§0.3, four UI states — never a blank cell).
// Canon (05-08): label 11px muted, value 12px (candidate FieldRow convention).
function Cell({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
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
  // S2/S3: jump the drawer to its OWN "appointments"/"interviews" tab. Not the
  // EntityLink pattern (that deep-links to a DIFFERENT entity's own page) —
  // appointments/interviews have no page of their own, they are tabs of THIS
  // same drawer, so there is nowhere to "open in a new tab" to; a plain
  // clickable link-styled text that switches tabs is the honest equivalent.
  onNavigateTab?: (id: string) => void
}

// A clickable, EntityLink-styled piece of text that switches the drawer's own
// active tab (no separate page to deep-link to, see the prop comment above).
function TabLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', textAlign: 'left',
        color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
      {children}
    </button>
  )
}

/**
 * ApplicationStatusStrip — a calm at-a-glance strip (Danny 25-07: "ik wil zoveel
 * mogelijk relevante informatie kunnen zien") with four cells: phase, match score,
 * next appointment and interview progress. Every cell honest-gates on its own data
 * and shows a muted italic fallback rather than a blank cell.
 */
export default function ApplicationStatusStrip({ application: a, onNavigateTab }: ApplicationStatusStripProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate, formatDateTime } = useDateFormat()

  // APP-STAGE-DURATIONS-1 (landed): the CURRENT stage's real entry timestamp,
  // read off the chronological stage_durations array (leftAt === null marks
  // the stage the application is in right now). Falls back to the list
  // contract's own current_stage_entered_at when the richer array is empty
  // (e.g. the drawer hasn't loaded the full detail yet), then to the
  // created-date "in process" line, then an honest "unknown" — never claims
  // days-since-created IS days-in-phase (that conflation was the old bug).
  const currentStage = a.stageDurations?.find(s => s.leftAt === null)
  const phaseEnteredAt = currentStage?.enteredAt ?? a.currentStageEnteredAt ?? null
  const daysInPhase = currentStage?.days ?? daysSince(phaseEnteredAt ?? undefined)
  const daysInProcess = daysSince(a.created)
  const nextAppointment = nextFutureAppointment(a.appointments ?? [])

  return (
    <SectionCard title={t('status.title')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {/* Phase — soft chip + the TRUE time in this phase when stage_durations
            (or its list-contract fallback timestamp) is available; only falls
            back to the "in process" since-created line when neither exists —
            the two must never be conflated (APP-STAGE-DURATIONS-1). */}
        <Cell label={t('status.phase')}>
          <SoftChip label={a.phaseLabel ?? a.phaseKey ?? '—'} color={a.phaseColor} />
          {phaseEnteredAt != null ? (
            <>
              <div style={mutedLine}>{t('status.inPhase', { days: daysInPhase ?? 0, phase: a.phaseLabel ?? a.phaseKey ?? '' })}</div>
              <div style={mutedLine}>{t('status.phaseSince', { date: formatDate(phaseEnteredAt) })}</div>
            </>
          ) : daysInProcess !== null ? (
            <div style={mutedLine}>{`${t('status.inProcess')} · ${t('status.days', { count: daysInProcess })}`}</div>
          ) : (
            <div style={mutedLine}>{t('status.phaseUnknown')}</div>
          )}
        </Cell>

        {/* Match score — same thresholds/colours as MatchScoreBlock. */}
        <Cell label={t('status.matchScore')}>
          {a.score != null
            ? <span style={{ fontWeight: 600, color: scoreColor(a.score) }}>{a.score}%</span>
            : <span style={mutedItalic}>{t('status.notScored')}</span>}
        </Cell>

        {/* Next appointment — the first upcoming one, owner on a muted second
            line. S2: clickable when a drawer tab-switch is wired AND there is
            something to jump to — a "no appointment" line has nothing to open. */}
        <Cell label={t('status.nextAppointment')}>
          {nextAppointment ? (
            <>
              <div>
                {onNavigateTab ? (
                  <TabLink onClick={() => onNavigateTab('appointments')}>
                    {(nextAppointment.title || nextAppointment.type) ?? '—'} · {formatDateTime(nextAppointment.when)}
                  </TabLink>
                ) : (
                  <>{(nextAppointment.title || nextAppointment.type) ?? '—'} · {formatDateTime(nextAppointment.when)}</>
                )}
              </div>
              {nextAppointment.with && <div style={mutedLine}>{nextAppointment.with}</div>}
            </>
          ) : (
            <span style={mutedItalic}>{t('status.noAppointment')}</span>
          )}
        </Cell>

        {/* Interview — current status + step progress when a session exists.
            S3: same tab-switch pattern as the appointment cell above. */}
        <Cell label={t('status.interview')}>
          {a.interview ? (
            <>
              <div>
                {onNavigateTab ? (
                  <TabLink onClick={() => onNavigateTab('interviews')}>
                    {a.interview.currentStatus ?? t(`interview.category.${a.interview.category}`)}
                  </TabLink>
                ) : (
                  a.interview.currentStatus ?? t(`interview.category.${a.interview.category}`)
                )}
              </div>
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
