import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import Button from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { PlanIntakeModal } from '@/pages/candidates/shared'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
// HUISSTIJL-1: shared typography atom — every muted secondary line in this
// strip is an exact 11px/muted match for Caption.
import { Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { translateInterviewStatus } from '@/lib/interviewStatus'
import type { ApplicationDetail } from '@/types/application'

// One label-LEFT/value-RIGHT row (DRILLDOWN-VOLGORDE-CANON, Danny 21-08 ruling
// 2: "Waarom staat het onder elkaar... Alles links en rechts en goed
// uitlijnen!!") — mirrors the candidate drawer's FieldRow/CANON_LABEL_STYLE
// byte-for-byte (fieldRowCanon.ts), never a locally re-picked label width.
// Every row still renders something calm even when its own data is missing
// (§0.3, four UI states — never a blank row).
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 26 }}>
      <span style={{ ...CANON_LABEL_STYLE, marginTop: 2 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}

const mutedItalic: CSSProperties = { color: 'var(--text-muted)', fontStyle: 'italic' }
// HUISSTIJL-1: layout only (marginTop) — fontSize/colour come from the Caption
// atom's own default identity, never redeclared locally.

// Whole days between an ISO date and now; null when the date is missing/unparseable.
function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000))
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
// HUISSTIJL-1: left as a bare <button> — this is a text link (padding 0, font
// inherit, underline-on-hover), not a chrome button, so no Button variant fits.
function TabLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- text-link tab-switch (padding 0, font inherit, underline-on-hover), not a chrome action — no Button variant fits
      style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', textAlign: 'left',
        color: 'var(--color-primary-text)', cursor: 'pointer', textDecoration: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
      {children}
    </button>
  )
}

/**
 * ApplicationStatusStrip — a calm at-a-glance card (Danny 25-07: "ik wil zoveel
 * mogelijk relevante informatie kunnen zien") with three rows: phase, next
 * appointment and interview progress. Every row honest-gates on its own data
 * and shows a muted italic fallback rather than a blank row.
 *
 * Danny 21-08 ruling 2 ("Waarom staat het onder elkaar... Alles links en
 * rechts!!"): relaid out from a label-above cell grid into ONE calm card of
 * label-LEFT/value-RIGHT rows (fieldRowCanon, the candidate FieldRow
 * convention) — same facts as before (fase chip + "N dagen in <fase> sinds
 * <datum>", interview step + link, next appointment/empty state), only the
 * anatomy changed. Ruling 1 retired the match-score CELL that used to sit in
 * this same grid; MatchScoreBlock (via the new MatchScoreSection, rendered
 * later on the tab) is now the ONE score surface, so this strip no longer
 * carries score data at all — its two affordances (the manual-override pencil
 * and the recalculate trigger) moved to that section's own title row, see
 * useMatchScoreOverride.ts.
 */
export default function ApplicationStatusStrip({ application: a, onNavigateTab }: ApplicationStatusStripProps) {
  // Danny 22-08: the "+" on the appointment row — the SAME plan flow the
  // Afspraken tab mounts (PlanIntakeModal, mode appointment).
  const [planning, setPlanning] = useState(false)
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate, formatDateTime } = useDateFormat()
  // RAW-KEY-1: flow-authored status first through i18n (the three markers the
  // engine itself sets), else humanized — never the raw SCREAMING_SNAKE value.
  const interviewStatusLabel = (iv: NonNullable<ApplicationDetail['interview']>) => {
    const raw = iv.currentStatus
    if (!raw) return t(`interview.category.${iv.category}`)
    return translateInterviewStatus(t, raw)
  }

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Phase — soft chip + the TRUE time in this phase when stage_durations
            (or its list-contract fallback timestamp) is available; only falls
            back to the "in process" since-created line when neither exists —
            the two must never be conflated (APP-STAGE-DURATIONS-1). */}
        <Row label={t('status.phase')}>
          {/* One flowing line (Danny 22-08: "gewoon de breedte gebruiken") —
              chip + facts with middot separators; wraps only when truly narrow. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <SoftChip label={a.phaseLabel ?? a.phaseKey ?? '—'} color={a.phaseColor} />
            {phaseEnteredAt != null ? (
              <Caption as="span">{t('status.inPhase', { days: daysInPhase ?? 0, phase: a.phaseLabel ?? a.phaseKey ?? '' })} · {t('status.phaseSince', { date: formatDate(phaseEnteredAt) })}</Caption>
            ) : daysInProcess !== null ? (
              <Caption as="span">{`${t('status.inProcess')} · ${t('status.days', { count: daysInProcess })}`}</Caption>
            ) : (
              <Caption as="span">{t('status.phaseUnknown')}</Caption>
            )}
          </div>
        </Row>

        {/* Next appointment — the first upcoming one, owner on a muted second
            line. S2: clickable when a drawer tab-switch is wired AND there is
            something to jump to — a "no appointment" line has nothing to open. */}
        <Row label={t('status.nextAppointment')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            {nextAppointment ? (
              <>
                {onNavigateTab ? (
                  <TabLink onClick={() => onNavigateTab('appointments')}>
                    {(nextAppointment.title || nextAppointment.type) ?? '—'} · {formatDateTime(nextAppointment.when)}
                  </TabLink>
                ) : (
                  <span>{(nextAppointment.title || nextAppointment.type) ?? '—'} · {formatDateTime(nextAppointment.when)}</span>
                )}
                {nextAppointment.with && <Caption as="span">· {nextAppointment.with}</Caption>}
              </>
            ) : (
              <span style={mutedItalic}>{t('status.noAppointment')}</span>
            )}
            {/* Danny 22-08: a real "+" here — the SAME PlanIntakeModal flow the
                Afspraken tab uses; disabled (never hidden) without a candidate. */}
            <Button variant="secondary" size="sm" iconOnly onClick={() => setPlanning(true)}
              disabled={a.candidateId == null}
              title={t('status.planAppointment')} aria-label={t('status.planAppointment')}>
              <Plus size={13} />
            </Button>
          </div>
        </Row>

        {/* Interview — current status + step progress when a session exists.
            S3: same tab-switch pattern as the appointment row above.
            RAW-KEY-1 (Danny 08-08, live: "ACTIVE_IN_CARE" on screen): `currentStatus`
            is a flow-authored SCREAMING_SNAKE value, never a fixed enum — run it
            through the same i18n-then-humanize path InterviewStatusCard uses, so a
            tenant's own step name reads as prose and never as a raw constant. */}
        <Row label={t('status.interview')}>
          {a.interview ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
              <div>
                {onNavigateTab ? (
                  <TabLink onClick={() => onNavigateTab('interviews')}>
                    {interviewStatusLabel(a.interview)}
                  </TabLink>
                ) : (
                  interviewStatusLabel(a.interview)
                )}
              </div>
              {a.interview.step != null && a.interview.total > 0 && (
                <Caption as="span">· {t('interview.stepOf', { step: a.interview.step, total: a.interview.total })}</Caption>
              )}
            </div>
          ) : (
            <span style={mutedItalic}>{t('status.noInterview')}</span>
          )}
        </Row>
      </div>
      {planning && a.candidateId != null && (
        <PlanIntakeModal candidateId={a.candidateId} applicationId={a.id ?? null} defaultVacancyId={a.vacancyId} mode="appointment"
          onClose={() => setPlanning(false)}
          // After planning: jump to the Afspraken tab, which loads its own fresh
          // list — the strip's payload-derived row updates on the next fetch.
          onCreated={() => { setPlanning(false); onNavigateTab?.('appointments') }} />
      )}
    </SectionCard>
  )
}
