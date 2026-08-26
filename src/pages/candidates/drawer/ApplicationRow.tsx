/**
 * ApplicationRow — ONE row of the candidate drawer's Sollicitaties list
 * (WorkTab's "applications" sub-tab). Extracted from WorkTab (Danny punt 5/7,
 * 08-08) because the row stopped being read-only text: it now carries the record
 * link, the edit pencil and the detach action, and WorkTab was heading past the
 * §3 split trigger with all of it inline.
 *
 * PUNT 5 — the row IS an application, so its title is the shared `EntityLink` to
 * the APPLICATION record: the name opens it in-app (accent colour), the trailing
 * icon opens the same record in a new window. Same shape the customer drawer's
 * own application list uses (CustomerApplicationsList links its primary cell to
 * `page="applications"`), so both application lists read as one system.
 * DELIBERATE CHANGE, reported to the manager: the title used to link to the
 * VACANCY. The vacancy stays reachable through its own external-URL icon at the
 * end of the row (unchanged) and from the application drawer's Vacature tab; a
 * second in-app link on the same line would mean two identical ⧉ icons per row,
 * exactly what MatchCard's `hideIcon` exists to avoid. A row without an
 * application id (should not happen — CandidateResource always sends it) keeps
 * the old vacancy-link fallback rather than losing its link entirely.
 *
 * PUNT 7 — detach: the pencil's neighbour. Both are permission-gated on
 * `applications.update` (the backend route group's own middleware) and render
 * nothing at all for a viewer without it, mirroring RejectionSummary /
 * InterviewStatusCard: a disabled-looking button for an action the server will
 * refuse is a fake affordance (§3).
 *
 * EXPAND (Danny 09-08: "bij matches heb ik een pijltje om uit te klappen … bij
 * sollicitaties niet. Dat is niet consistent" — "with matches I have an arrow
 * to expand … not with applications. That's inconsistent") — the row now carries the SAME
 * disclosure MatchCard's `collapsible` mode has: collapsed by default, a trailing
 * chevron (ChevronRight → ChevronDown, no animation, exactly as there), a click on
 * the row's own empty space as the mouse convenience on top of it, and the label/
 * value panel rendered in place below. The panel body lives in
 * `ApplicationRowDetails` (it loads the application detail — see that file's
 * docblock for why the embedded row cannot carry it).
 * Gated on `applications.view`: GET /applications/{id} sits behind that permission
 * (routes/api/tenant/applications-matches.php:17), so a chevron that could only
 * ever 403 is never rendered (§3).
 */
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Clock, User, Building2, Video, Phone, Pencil, Unlink, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react'
import EntityLink from '@/components/ui/EntityLink'
import StatusPill from '@/components/ui/StatusPill'
import ApplicationRowDetails from './ApplicationRowDetails'
// PDF-VACATURES-13: the shared prev/next stepper — optional, only the vacancy
// ApplicantsTab passes it (paging through applications without a trip back to
// the list). WorkTab/MatchesTab/CustomerApplicationsList never pass it, so their
// rows stay on the original uncontrolled expand (see `expanded`/`onToggleExpanded` below).
import DrillPager from '@/components/drawer/DrillPager'
import type { DrillPagerProps } from '@/components/drawer/DrillPager'
import { useDateFormat } from '@/lib/datetime'
import { rememberReturnTab } from './constants'
import { APPLICATION_COL_STATUS, APPLICATION_COL_DATE, APPLICATION_COL_ACTIONS, APPLICATION_COL_TITLE, APPLICATION_COL_CLIENT } from './applicationRowColumns'
import { vacancyLabelOf, vacancyUrlOf, clientNameOf } from './applicationRowModel'
import type { AppRow, Appt } from './applicationRowModel'
import type { ExistingAppointment } from './PlanIntakeModal'
import type { Id } from '@/types/common'

// Row action icon (pencil / unlink) — the MatchCard idiom: bare icon button, muted
// by default, the danger token only on the destructive one. Tokens only (§4).
// `boxSizing: 'border-box'` (Danny 09-08: "de knoppen in één rij horen dezelfde
// afmeting te hebben" — "the buttons in one row should be the same size") —
// the unlink button below adds a 1px border on TOP of
// this same width/height; without border-box that border would grow it to
// 24x24 while the borderless pencil stayed 22x22, the exact size mismatch Danny
// flagged next to it. border-box keeps every icon button in this cluster the
// same rendered box whether or not it carries a border.
const iconBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, boxSizing: 'border-box', border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', padding: 0, flexShrink: 0 }
// Title cell: grows, never pushes the pills/date off the row.
// Reads the SHARED title column so the header cell above it can never drift.
const titleCell: CSSProperties = { fontWeight: 500, ...APPLICATION_COL_TITLE }

// Icon per modality (office/remote/phone) for the appointment line — module scope
// so it is one stable component type, never re-created on every render.
const ModalityIcon = ({ m }: { m?: string }) => m === 'remote' ? <Video size={11} /> : m === 'phone' ? <Phone size={11} /> : <Building2 size={11} />

// One application row in the candidate drawer's applications list, with its own
// expand/collapse, edit/detach actions (gated on canManage) and linked-appointment line.
export default function ApplicationRow({ candidateId, row, appointment, canManage, canView = false, onEdit, onDetach, onEditAppointment, expanded: expandedProp, onToggleExpanded, pager }: {
  candidateId: Id
  row: AppRow
  // The appointment linked to THIS application (resolved by the host from its own list).
  appointment?: Appt
  // applications.update — the one permission the backend requires for PATCH + DELETE.
  canManage: boolean
  // applications.view — the permission GET /applications/{id} needs; gates the
  // expand chevron, since the panel has nothing to load without it.
  canView?: boolean
  // Pencil: reopens the application form in EDIT mode (host owns the modal state).
  onEdit: (applicationId: Id) => void
  // Unlink: hands the row to the host's reason prompt (DELETE needs a reason, measured).
  onDetach: (row: AppRow) => void
  // Pencil on the appointment line: prefilled intake modal (host owns the state).
  onEditAppointment: (existing: ExistingAppointment) => void
  // PDF-VACATURES-13: optional CONTROLLED expand — when the host passes both,
  // it owns which row is open (needed so DrillPager's next/prev can collapse THIS
  // row and expand another). Omitted (the default), the row keeps its own
  // uncontrolled `expanded` state, unchanged for every existing caller.
  expanded?: boolean
  onToggleExpanded?: () => void
  // PDF-VACATURES-13: the prev/next stepper shown inside the expanded panel — only
  // rendered while expanded, since paging only makes sense once a detail is open.
  pager?: DrillPagerProps
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const { formatDate, locale } = useDateFormat()

  // Vacancy-less intake applications have no title → show "Intake" (or "Intake —
  // <customer>" when the row carries a client_name) instead of a bare dash, so the
  // identity row still reads as an intake for THIS client (batch 14, 4-dash decision).
  const client = clientNameOf(row)
  const label = vacancyLabelOf(row) ?? (client ? t('work.intakeLabelWithClient', { client }) : t('work.intakeLabel'))
  const url = vacancyUrlOf(row)
  const vacancyId = row.vacancy?.id ?? null
  const applicationId = row.id ?? null

  // Disclosure state — collapsed by default, per row, purely presentational
  // (mirrors MatchCard's own `expanded`). Only offered when there IS an
  // application to load and the viewer may read it.
  const [internalExpanded, setInternalExpanded] = useState(false)
  // PDF-VACATURES-13: controlled iff the host passed BOTH `expanded` and
  // `onToggleExpanded` — a host passing only one (a mistake) falls back to the
  // safe uncontrolled behaviour rather than a half-wired toggle.
  const isControlled = expandedProp !== undefined && onToggleExpanded !== undefined
  const expanded = isControlled ? expandedProp : internalExpanded
  const collapsible = canView && applicationId != null
  const toggle = () => (isControlled ? onToggleExpanded?.() : setInternalExpanded(x => !x))
  // Stable ids so the button owns the panel (aria-controls) and the panel is named
  // by the button (aria-labelledby) — the arrow is never the only signal (§6).
  const rowId = useId()
  const toggleId = `${rowId}-toggle`
  const panelId = `${rowId}-panel`
  // The row's own empty space toggles too (MatchCard idiom); the interactive
  // clusters below stop propagation so links/buttons keep working independently.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  // "09:00–09:30" from scheduled_at + duration_min. The BE stores the wall time the
  // user entered as UTC, so this MUST read it back as UTC — Date's local getters
  // would shift it (+2h in Europe/Amsterdam) instead of showing the entered time.
  const timeRange = (a: Appt) => {
    if (!a.scheduled_at) return ''
    const start = new Date(a.scheduled_at)
    const hhmm = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    if (!a.duration_min) return hhmm(start)
    const end = new Date(start.getTime() + a.duration_min * 60000)
    return `${hhmm(start)}–${hhmm(end)}`
  }

  return (
    <div>
      <div onClick={collapsible ? toggle : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', fontSize: 12, color: 'var(--text)', cursor: collapsible ? 'pointer' : undefined }}>
        {(row.logo_url ?? row.vacancy?.logo_url) && <img src={row.logo_url ?? row.vacancy?.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />}
        {/* Punt 5: the title links to the APPLICATION (name = in-app, ⧉ = new window).
            Cross-entity jump: coming BACK must land on the Werk tab (punt 15).
            onClickCapture still fires BEFORE the bubble-phase stop below, so the
            return-tab is stashed and the row does not also toggle on a title click. */}
        {applicationId != null
          ? <span style={titleCell} onClickCapture={() => rememberReturnTab(candidateId, 'work')} onClick={stop}>
              <EntityLink page="applications" id={applicationId} title={t('work.openApplication')}>{label}</EntityLink>
            </span>
          : url
            // Row title reads as CONTENT (Danny 13-08, PDF punt 4: only expanded was
            // comfortably readable at AENF) — the external-link icon carries the affordance.
            ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={stop} style={{ ...titleCell, color: 'var(--text)', textDecoration: 'none' }}>{label}</a>
            : vacancyId != null
              ? <span style={titleCell} onClickCapture={() => rememberReturnTab(candidateId, 'work')} onClick={stop}>
                  <EntityLink page="vacancies" id={vacancyId} title={label}>{label}</EntityLink>
                </span>
              : <span style={titleCell}>{label}</span>}
        {/* Customer column (batch 14): the vacancy's customer name, dash when the row
            carries none — same fixed-width cell WorkTab's header labels. */}
        <span style={APPLICATION_COL_CLIENT}>{client ?? '—'}</span>
        {/* Status column (APPLICATION-COL-1, Danny 09-08): the pill sits inside the
            SAME fixed-width cell the header labels — always rendered (even when
            this row genuinely has no stage) so a missing pill never shifts the
            date/actions columns that follow it. */}
        <span style={APPLICATION_COL_STATUS}>{row.stageLabel && <StatusPill label={row.stageLabel} color={row.stageColor} />}</span>
        {/* Applied-on date (APP-EMBED-1: application.created_at) — dash only when
            genuinely missing; same shared column width as the header's own cell. */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', ...APPLICATION_COL_DATE }}>{row.created_at ? formatDate(row.created_at) : '—'}</span>
        {/* Actions column (APPLICATION-COL-1): pencil/unlink/external-link/chevron
            now share ONE fixed-width, right-aligned cell (the same shared width the
            header's own empty trailing cell reserves) instead of two separate,
            unaccounted-for clusters — one stop-propagation wrapper (MatchCard's
            iconsBlock idiom) so every action keeps its own click when the row toggles. */}
        <span onClick={stop} data-testid="app-col-actions"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, ...APPLICATION_COL_ACTIONS }}>
          {/* Punt 5: edit this application — same modal, EDIT mode (PATCH /applications/{id}). */}
          {canManage && applicationId != null && (
            <button type="button" onClick={() => onEdit(applicationId)}
              title={t('work.editApplication')} aria-label={t('work.editApplication')}
              style={{ ...iconBtn, color: 'var(--text-muted)' }}>
              <Pencil size={12} />
            </button>
          )}
          {/* Punt 7: detach this application from the candidate (soft-delete,
              restorable). Danny 09-08: this used a solid `--color-danger-bg` fill
              with NO border, standing out next to the borderless pencil — now the
              real §4 soft-tint (8-16% bg / border 28-50%), same size as the pencil
              (iconBtn's border-box above keeps the added border from growing it). */}
          {canManage && applicationId != null && (
            <button type="button" onClick={() => onDetach(row)}
              title={t('work.detachApplication')} aria-label={t('work.detachApplication')}
              style={{ ...iconBtn, background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger-text)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
              <Unlink size={12} />
            </button>
          )}
          {/* The vacancy's OWN public URL (tenant-entered, isSafeUrl-gated) — unchanged. */}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" title={t('work.openVacancy')} aria-label={t('work.openVacancy')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', flexShrink: 0 }}>
              <ExternalLink size={12} />
            </a>
          )}
          {/* The explicit, keyboard-reachable disclosure (the row click is only a
              mouse convenience on top of it) — same chevron pair as MatchCard. */}
          {collapsible && (
            <button type="button" id={toggleId} onClick={e => { stop(e); toggle() }}
              title={expanded ? t('work.hideDetails') : t('work.showDetails')}
              aria-label={expanded ? t('work.hideDetails') : t('work.showDetails')}
              aria-expanded={expanded} aria-controls={panelId}
              style={{ ...iconBtn, color: 'var(--text-muted)' }}>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </span>
      </div>
      {/* Linked appointment: date · start–end · modality · owner (CONSIST-2 / APPT). */}
      {appointment && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '0 12px 10px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
          {appointment.scheduled_at && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {formatDate(appointment.scheduled_at, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>}
          {appointment.scheduled_at && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {timeRange(appointment)}{appointment.duration_min ? ` · ${appointment.duration_min} min` : ''}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ModalityIcon m={appointment.modality} /> {t(`work.modality${appointment.modality === 'remote' ? 'Remote' : appointment.modality === 'phone' ? 'Phone' : 'Office'}`)}{appointment.location_name ? ` · ${appointment.location_name}` : ''}</span>
          {appointment.owner?.name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} /> {appointment.owner.name}</span>}
          {/* Pencil: edit this intake appointment (Danny) — prefilled modal → PATCH.
              Passes the ROW'S VACANCY id, never the application's own id (regression guard). */}
          <button type="button" onClick={() => onEditAppointment({ id: appointment.id, scheduled_at: appointment.scheduled_at, duration_min: appointment.duration_min, modality: appointment.modality, type: appointment.type, owner_id: (appointment.owner as { id?: Id })?.id, vacancy_id: vacancyId })}
            title={t('work.editIntake')} aria-label={t('work.editIntake')}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
            <Pencil size={11} />
          </button>
        </div>
      )}
      {/* The unfolded panel — mounted only while expanded, so the detail request
          is made on first expand and never for a row nobody opens (§8). */}
      {collapsible && expanded && applicationId != null && (
        <div>
          {/* PDF-VACATURES-13: prev/next through the caller's own filtered/sorted
              rows — only when the host actually supplied one (vacancy ApplicantsTab). */}
          {pager && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px', borderTop: '1px solid var(--border)' }}>
              <DrillPager {...pager} />
            </div>
          )}
          <ApplicationRowDetails applicationId={applicationId} id={panelId} labelledBy={toggleId} />
        </div>
      )}
    </div>
  )
}
