import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { Clock, CheckCircle2 } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column, ControlledSort } from '@/components/ui/DataTable'
import { stopPropagation } from '@/components/ui/dataTableUtils'
import Avatar from '@/components/ui/Avatar'
import EntityNameCell from '@/components/ui/EntityNameCell'
import StatusPill from '@/components/ui/StatusPill'
import CandidateStatusChip from '@/components/ui/CandidateStatusChip'
import { makeKoiosColumn } from '@/components/ui/koiosColumn'
// HUISSTIJL-1: the interview step count rides the Caption atom's own 11px/muted
// identity, with the raw monoStyle identity layered on for JetBrains Mono digits;
// the two plain mono cellStyle objects below reuse the same raw identity.
import { Caption, monoStyle } from '@/components/ui/typography'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useApplicationAdvice } from '@/lib/useApplicationAdvice'
import { useDateFormat, daysSince } from '@/lib/datetime'
import { interviewCategoryColor } from './data/applicationsShared'
import { APPLICATION_SORT_KEYS } from './hooks/useApplicationsData'

// Plain-text cell style (used when a colour toggle is off).
const plainCell = { color: 'var(--text)', fontSize: 12 }

// Match score as a soft-coloured percentage (green ≥75, amber ≥50, red below);
// `plain` renders it as neutral text when the colour toggle is off.
function ScorePill({ value, plain }: { value: number | null; plain?: boolean }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const c = plain ? 'var(--text)' : value >= 75 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return <span style={{ fontWeight: plain ? 400 : 600, fontSize: plain ? 12 : undefined, color: c }}>{value}%</span>
}

interface ApplicationsTableProps {
  rows: Application[]
  loading?: boolean
  error?: unknown
  selectedId?: Id | null
  // PDF-SOLLICITATIES points 6/7 (14-08): the Vacature/Interview cells jump the
  // drawer straight to that tab — `tab` is undefined for a plain row click
  // (opens on the drawer's own default tab).
  onSelect?: (row: Application, tab?: string) => void
  stickyHeader?: boolean
  // Row selection (checkboxes) — driven by the page for the bulk action bar.
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  // SELECT-RACE-1: forwarded to DataTable as-is — inert header checkbox while a
  // new server result is in flight.
  selectionBusy?: boolean
  // Virtualization (F-7): the vertical scroll container this table lives in —
  // opt-in, forwarded straight to DataTable (mirrors CustomersTable/VacanciesTable).
  scrollParentRef?: RefObject<HTMLElement | null>
  // DATATABLE-SORT-1: controlled-sort escape hatch — forwarded to DataTable
  // as-is. Optional so a caller (or a test) that omits both keeps the
  // pre-existing uncontrolled/defaultSort behaviour untouched.
  sort?: ControlledSort | null
  onSortChange?: (sort: ControlledSort) => void
}

/**
 * ApplicationsTable — declares columns only; the shared DataTable owns sorting,
 * selection, hover and the loading/empty states. Mirrors MatchesTable.
 */
export default function ApplicationsTable({ rows, loading, error, selectedId, onSelect, stickyHeader = false,
  selectable, selectedIds, onToggleRow, onToggleAll, selectionBusy, scrollParentRef, sort, onSortChange }: ApplicationsTableProps) {
  const { t } = useTranslation('applications')
  // Seeded lookup labels the server embedded in the row render in the user language.
  const seedLabel = useSeedLabel()
  const { formatDate } = useDateFormat()
  // Tenant display settings (Settings → Applications → Table display). Coloured
  // chips/score vs. plain text — one flag PER meaning-carrying column; all ON by default.
  const settings = useAllSettings()
  const colorScore  = getBoolSetting(settings, 'application_table_color_score', true)
  const colorPhase  = getBoolSetting(settings, 'application_table_color_phase', true)
  const colorStatus = getBoolSetting(settings, 'application_table_color_status', true)
  const colorOwner  = getBoolSetting(settings, 'application_table_color_owner', true)
  const colorKoios  = getBoolSetting(settings, 'application_table_color_koios', false)
  // The ONE shared Koios advice resolver (KOIOS-ADVIES-OVERAL-1) — the drawer
  // calls the same hook, so table and drill-down can never disagree. It routes
  // the backend's free-text `task` through the shared KoiosAdvice shape, so the
  // pill renders with ADVICE_META's task icon like every other entity.
  const adviceOf = useApplicationAdvice()

  // Column template mirrors the candidates blueprint (§3A): identity → phase/status →
  // dates → qualification → Koios → owner LAST (Danny 2026-07-14 table standardization).
  const columns: Column<Application>[] = [
    // Candidate — avatar + name. Sticky first column (stays on horizontal scroll), like the candidates table.
    // DATATABLE-SORT-1: serverKey maps to ApplicationQuery's candidate_last_name sort.
    { key: 'candidate', header: t('cols.candidate'), sortable: true, sortValue: r => r.candidateName,
      serverKey: APPLICATION_SORT_KEYS.candidate,
      sticky: true, width: 200, nowrap: true,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar initials={r.candidateInitials} size={24} soft />
          <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }} title={r.candidateName}>{r.candidateName}</span>
        </span>
      ) },
    {
      // Human-readable reference number (S-00042) — an identifier, so it sits right
      // after the identity column, exactly where candidates/customers/vacancies/
      // matches/tasks put theirs. Plain mono text, not the click-to-copy chip: a
      // button nested inside this row's own click-to-open would double-fire.
      key: 'referenceNumber', header: t('cols.referenceNumber'), nowrap: true,
      cellStyle: { color: 'var(--text-muted)', fontSize: 12, ...monoStyle, fontVariantNumeric: 'tabular-nums' },
      sortable: true, sortValue: r => r.referenceNumber ?? '', render: r => r.referenceNumber || '—',
    },
    // Vacancy — single-line clamp so long titles don't blow up the row. PDF
    // point 6 (14-08): clicking this cell jumps straight to the drawer's own
    // Vacature tab instead of just opening the row on its default tab.
    { key: 'vacancy', header: t('cols.vacancy'), sortable: true, sortValue: r => r.vacancyTitle,
      render: r => (
        <span onClick={e => { stopPropagation(e); onSelect?.(r, 'vacancy') }}
          style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 320, color: 'var(--text)', cursor: 'pointer' }}>
          {r.vacancyTitle}
        </span>
      ) },
    // Klant — soft avatar + name (AVATAR-CHIP-1: same chip as the candidate identity
    // column), muted text keeps it reading as a secondary reference.
    { key: 'client', header: t('cols.client'), sortable: true, nowrap: true,
      render: r => <EntityNameCell name={r.client} textStyle={{ color: 'var(--text-muted)' }} /> },
    // Match score. DATATABLE-SORT-1: serverKey maps to ApplicationQuery's match_score sort.
    { key: 'score', header: t('cols.score'), align: 'right', sortable: true,
      sortValue: r => r.score ?? -1, serverKey: APPLICATION_SORT_KEYS.score,
      render: r => <ScorePill value={r.score} plain={!colorScore} /> },
    // Funnel phase — soft pill in the phase colour (or plain text when the toggle is off).
    // DATATABLE-SORT-1: serverKey maps to ApplicationQuery's stage_order sort (the
    // tenant's configured funnel order, not this column's alphabetical label sort).
    { key: 'phase', header: t('cols.phase'), sortable: true, sortValue: r => r.phaseLabel ?? '',
      serverKey: APPLICATION_SORT_KEYS.phase,
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {colorPhase
            ? <StatusPill label={seedLabel('funnelTypes', { value: r.phaseKey, label: r.phaseLabel })} color={r.phaseColor} />
            : <span style={plainCell}>{seedLabel('funnelTypes', { value: r.phaseKey, label: r.phaseLabel }) || '—'}</span>}
          {/* D6-KAART-2: subtle per-row flag — colour never the only signal, the
              icon shape + tooltip text carry the meaning on their own. */}
          {r.tooLongInStage && (
            <Clock size={13} strokeWidth={2} color="var(--color-warning)"
              aria-label={t('kpi.tooLongInStage')} role="img" />
          )}
          {/* PLACED-1: subtle placed badge — colour never the only signal, the icon
              shape + tooltip/aria text carry the meaning on their own. */}
          {r.hasMatch && (
            <CheckCircle2 size={13} strokeWidth={2} color="var(--color-success)"
              aria-label={t('buckets.placed')} role="img" />
          )}
        </span>
      ) },
    // Candidate deployability status — the ONE shared chip (C-CHIP): slug drives the
    // model-v2 rules (Lead→dash, blacklist), with the pre-resolved label/colour as
    // fallback until the /applications resource exposes the slug (BE gap filed).
    { key: 'status', header: t('cols.status'), sortable: true, sortValue: r => r.candidateStatusLabel,
      render: r => <CandidateStatusChip status={r.candidateStatus} phase={r.candidatePhase}
        fallbackLabel={r.candidateStatusLabel} fallbackColor={r.candidateStatusColor} plain={!colorStatus} round /> },
    // INTERVIEW-PHASE-1: the live AI-interview session's universal category chip
    // + "step X of Y" within its own flow — em-dash when no session exists.
    // PDF point 7 (14-08): clicking this cell jumps straight to the drawer's
    // own Interview tab instead of just opening the row on its default tab.
    { key: 'interview', header: t('cols.interview'), sortable: true, sortValue: r => r.interview?.category ?? '',
      render: r => r.interview ? (
        // ONE row (Danny 08-08: "Bezig 2/12 1 regel geen 2 regels") — chip and
        // progress sit side by side; the compact "2/12" form keeps the column
        // narrow where the drawer can afford the spelled-out "Stap 2 van 12".
        <span onClick={e => { stopPropagation(e); onSelect?.(r, 'interviews') }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <StatusPill label={t(`interview.category.${r.interview.category}`)} color={interviewCategoryColor(r.interview.category)} />
          {r.interview.total > 0 && (
            <Caption as="span" style={monoStyle}
              title={t('interview.stepOf', { step: r.interview.step ?? '–', total: r.interview.total })}>
              {r.interview.step ?? '–'}/{r.interview.total}
            </Caption>
          )}
        </span>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    // PDF-SOLLICITATIES point 8 (14-08): plain day count in the CURRENT phase —
    // the header carries the unit, the cell is bare digits (mirrors the vacancies
    // "age" column). Real field: ApplicationListResource::currentStageEnteredAt
    // (the application_stage_transitions row for the current stage; created_at
    // fallback ONLY happens server-side inside too_long_in_stage, never here — a
    // missing transition renders a dash, never a fabricated zero). No serverKey:
    // the backend has no sort_by for this yet (ApplicationQuery::SORTS), so the
    // column sorts client-side on the loaded page, same pattern as client/status.
    // Colour reuses the backend's own too_long_in_stage flag (the exact
    // application_stage_stale_days-threshold predicate) rather than duplicating
    // the threshold on the frontend.
    { key: 'daysInPhase', header: t('cols.daysInPhase'), align: 'right', sortable: true,
      sortValue: r => daysSince(r.currentStageEnteredAt) ?? null,
      cellStyle: { ...monoStyle, fontVariantNumeric: 'tabular-nums' },
      render: r => {
        const days = daysSince(r.currentStageEnteredAt)
        if (days == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return <span style={{ color: r.tooLongInStage ? 'var(--color-warning)' : 'var(--text)' }}>{days}</span>
      } },
    // Created date — the table defaults to newest first. DATATABLE-SORT-1:
    // serverKey maps to ApplicationQuery's created_at sort.
    { key: 'created', header: t('cols.created'), nowrap: true, sortable: true, sortValue: r => r.created ?? '',
      serverKey: APPLICATION_SORT_KEYS.created,
      cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, render: r => r.created ? formatDate(r.created) : '—' },
    // SWEEP-TABLES: explicit em-dash fallback — without a render fn, DataTable's
    // default cell (`field(row, col.key)`) prints a blank string for an empty
    // source, the only column left inconsistent with the house convention.
    // LOOKUP-I18N-1: the row embeds a flat source label (no separate value) — the
    // seed default renders in the user's language, a tenant rename stays as typed.
    { key: 'source', header: t('cols.source'), sortable: true, cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: r => seedLabel('candidateSources', { label: r.source }) || '—' },
    // Shared Koios column factory (Danny 05-08 consistency pass) — was a
    // hand-rolled mark+text cell (no dash/sort/colour-toggle support); now the
    // same header/sort/cell as every other entity table. `cols.task` already
    // holds the "Koios" header label (legacy key name, correct value — reused
    // as-is rather than adding a duplicate key).
    makeKoiosColumn({ adviceOf, colored: colorKoios, label: t('cols.task') }),
    // Owner — avatar + name. LAST column (§3A convention).
    { key: 'owner', header: t('cols.owner'), sortable: true, sortValue: r => r.owner?.name,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={r.owner?.initials} size={22} color={colorOwner ? r.owner?.color : 'var(--text-muted)'} soft />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.owner?.name}</span>
        </span>
      ) },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      loadingText={t('loading')}
      emptyText={error ? t('error') : t('empty')}
      onRowClick={onSelect}
      selectedId={selectedId}
      stickyHeader={stickyHeader}
      // DATATABLE-SORT-1: defaultSort still seeds the UNCONTROLLED fallback (a
      // caller that omits sort/onSortChange, e.g. ApplicationsTable.test.tsx) —
      // harmless when the page below DOES pass both, since DataTable then reads
      // `sort` from the prop instead.
      defaultSort={{ key: 'created', dir: 'desc' }}
      sort={sort}
      onSortChange={onSortChange}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      selectionBusy={selectionBusy}
      scrollParentRef={scrollParentRef}
    />
  )
}
