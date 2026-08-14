import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column, ControlledSort } from '@/components/ui/DataTable'
import Avatar, { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import SoftChip from '@/components/ui/SoftChip'
import AiAgentAvatar from '@/components/ui/AiAgentAvatar'
import { makeKoiosColumn } from '@/components/ui/koiosColumn'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import { useDateFormat, relativeAge } from '@/lib/datetime'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAllSettings, getBoolSetting, getNumberSetting } from '@/lib/settings/useAllSettings'
import { deriveVacancyAdvice } from './data/vacancyAdvice'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

const mutedCell = { color: 'var(--text-muted)', fontSize: 12 }
const plainCell = { color: 'var(--text)', fontSize: 12 }
// Leads count → "Kandidaten zoeken" deep-link button (ghost, mono number, no chip
// noise) — mirrors CustomersTable's count-cell deep-link buttons (§3A: extend the
// established pattern, never a fresh inline copy).
const leadsBtn = { display: 'inline-flex', fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
  color: 'var(--color-primary-text)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }

interface VacanciesTableProps {
  rows: Vacancy[]
  loading?: boolean
  selectedId?: Id | null
  onSelect?: (row: Vacancy) => void
  // VACANCY-MATCH-COUNT-1 (Danny 23-07): the Leads count deep-links straight to
  // this vacancy's "Kandidaten zoeken" tab — a plain number when the caller
  // doesn't wire this (mirrors the candidates/customers count-cell deep-links).
  onOpenCandidateSearch?: (id: Id) => void
  // V4 (vacatures-tabel-cluster): the Sollicitaties count deep-links to the
  // drawer's "applicants" tab — mirrors onOpenCandidateSearch's leads deep-link.
  onOpenApplicants?: (id: Id) => void
  // V-table-2: the Matches count deep-links to the drawer's read-only "matches" tab.
  onOpenMatches?: (id: Id) => void
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
  // SWEEP-TABLES / DATATABLE-SORT-1: controlled-sort escape hatch — forwarded to
  // DataTable as-is. Optional so a caller (or a test) that omits both keeps the
  // pre-existing uncontrolled/defaultSort behaviour untouched (mirrors ApplicationsTable).
  sort?: ControlledSort | null
  onSortChange?: (sort: ControlledSort) => void
}

/**
 * VacanciesTable — vacancy list as a loose component. Only declares the columns;
 * sorting, selection and the loading/empty states live in the shared DataTable.
 * Mirrors CandidatesTable / ApplicationsTable.
 */
export default function VacanciesTable({ rows, loading, selectedId, onSelect, onOpenCandidateSearch, onOpenApplicants, onOpenMatches, selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false, scrollParentRef, sort, onSortChange }: VacanciesTableProps) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { formatDate } = useDateFormat()
  const { statuses = [], statusMeta } = useVacancyLookups()
  // V1 (vacatures-tabel-cluster): status sort follows the TENANT's configured
  // lookup order (Settings → sort_order), not an alphabetical label sort — the
  // sortActiveRows() call inside VacancyLookupsContext already orders `statuses`,
  // so its array INDEX is the tenant's intended order. Published becomes a clear
  // secondary key (published-first) encoded into one numeric value, since the
  // shared DataTable only compares a single sortValue per row (no compound key).
  const statusOrderIndex = new Map(statuses.map((s, i) => [s.value, i]))
  // Tenant display settings (mirror the candidate table). Coloured chips carry
  // meaning (status/published/owner), so they default ON; a tenant can flatten them.
  const settings = useAllSettings()
  const colorStatus    = getBoolSetting(settings, 'vacancy_table_color_status', true)
  const colorPublished = getBoolSetting(settings, 'vacancy_table_color_published', true)
  const colorOwner     = getBoolSetting(settings, 'vacancy_table_color_owner', true)
  const colorKoios     = getBoolSetting(settings, 'vacancy_table_color_koios', false)
  // How many days without an application counts as "stale" (mirrors candidates'
  // no_contact_alert_months threshold) — tenant-configurable, sensible default.
  const staleDays = getNumberSetting(settings, 'vacancy_advice_stale_days', 14)
  // Shared Koios advice resolver (vacancyAdvice.ts) — honest: published + zero
  // applications + past the stale threshold, an em-dash for everything else.
  const adviceOf = (v: Vacancy): KoiosAdvice | null => {
    const rule = deriveVacancyAdvice(v, { staleDays })
    if (rule.action === 'none') return null
    return {
      action: rule.action,
      label: t('common:koios.actions.attention', { defaultValue: 'Attention' }),
      reason: t(rule.reasonKey, { ...rule.reasonParams, defaultValue: 'No applications yet, posted {{days}} days ago.' }),
      source: 'rules',
    }
  }

  // Column order mirrors the candidates blueprint (§3A): identity → client → status
  // → counts → dates → owner LAST (Danny 2026-07-14 table standardization).
  const columns: Column<Vacancy>[] = [
    {
      key: 'title', header: t('columns.title'), sortable: true, sortValue: r => r.title,
      sticky: true, width: 320, nowrap: true,
      render: r => <span style={{ color: 'var(--text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 300 }} title={r.title}>{r.title}</span>,
    },
    {
      // Human-readable reference number (V-12, JOB1) — an identifier, so it sits
      // right after the title. Plain mono text, not the interactive ReferenceNumberChip:
      // a click-to-copy button nested inside this row's own click-to-open would either
      // double-fire or need stopPropagation contortions; the drawer chip already copies.
      key: 'referenceNumber', header: t('columns.referenceNumber'), nowrap: true,
      cellStyle: { ...mutedCell, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' },
      sortable: true, sortValue: r => r.referenceNumber ?? '', render: r => r.referenceNumber || '—',
    },
    {
      key: 'client', header: t('columns.client'), nowrap: true, sortable: true, sortValue: r => r.clientName,
      render: r => r.clientName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={(r.clientName[0] ?? '?').toUpperCase()} size={20} soft />
          <span style={{ color: 'var(--text)', fontSize: 12 }}>{r.clientName}</span>
        </div>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      // SWEEP-TABLES: VacancyQuery::rules() validates `sort` as `in:status` ONLY —
      // no other column has a server-side equivalent (verified live against
      // VacancyQuery.php 2026-08-08), so `serverKey` is wired here alone. Unlike
      // ApplicationQuery's sort_by/sort_dir pair, the backend's applySort() ignores
      // direction entirely for `sort=status` (it always orders by the tenant's own
      // sort_order, published-desc, created-desc) — a future caller translating this
      // into a request must send `{ sort: 'status' }` regardless of the clicked dir.
      key: 'status', header: t('columns.status'), sortable: true, serverKey: 'status',
      sortValue: r => {
        const idx = statusOrderIndex.get(r.statusValue != null ? String(r.statusValue) : '') ?? statuses.length
        return idx * 2 + (r.published ? 0 : 1)
      },
      render: r => {
        // Archive state wins over the status pill (mirrors CandidatesTable): a soft-
        // deleted row shown via include_archived=1 reads as "Archived", not its stale
        // status. TRASH-OVERAL-2: a pending_erase row reads as "Prullenbak" instead.
        if (r.lifecycle === 'pending_erase') return <SoftChip label={t('common:trash.view')} color="var(--color-trash)" round />
        if (r.archived) return <SoftChip label={t('page.archivedView')} color="var(--text-muted)" round />
        // Prefer the resolved label/colour from the row; fall back to the lookup.
        const m = r.statusLabel ? { label: r.statusLabel, color: r.statusColor } : statusMeta(r.statusValue != null ? String(r.statusValue) : null)
        if (!m.label) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return colorStatus ? <StatusPill label={m.label} color={m.color} /> : <span style={plainCell}>{m.label}</span>
      },
    },
    {
      // VACANCY-LEADS-COUNT-1: `leadsCount` is null until the backend computes a
      // real candidate_match_count — sort unknown rows to the END of the (default,
      // first-click ascending) order rather than letting them read as 0. The
      // sentinel is a large-but-finite number (never NaN from Infinity-Infinity)
      // so the shared DataTable's numeric compare() stays deterministic; a
      // An unknown count returns null: DataTable sinks null rows to the bottom in
      // BOTH directions. A sentinel number used to float "not computed yet" rows
      // above the vacancy with the most real leads on the descending click.
      key: 'leads', header: t('columns.leads'), align: 'left', sortable: true,
      sortValue: r => r.leadsCount,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' },
      // A ghost button when the caller wired the deep-link, else the plain number/
      // dash (unchanged behaviour otherwise). stopPropagation so the click opens
      // the "Kandidaten zoeken" tab instead of double-firing the row's own open.
      // Unknown (null) count renders a muted em dash — NEVER a fake 0 — with a
      // title explaining the match engine has not computed it yet.
      render: r => {
        const known = typeof r.leadsCount === 'number'
        const label = known ? String(r.leadsCount) : '—'
        // VACANCY-LEADS-COUNT-1: once the count IS known, tell the fuller truth
        // about its freshness/completeness — stale wins over geo-missing wins
        // over partial, so only the most relevant caveat shows at a time.
        const state = r.matchCountState
        let title = known ? undefined : t('columns.leadsUnknown')
        let caveat: string | null = null
        if (known && state) {
          if (state.isStale) caveat = t('columns.leadsStale', { date: formatDate(state.computedAt) })
          else if (state.geoMissing) caveat = t('columns.leadsGeoMissing')
          else if (state.partial) caveat = t('columns.leadsPartial')
          else if (state.computedAt) caveat = t('columns.leadsComputedAt', { date: formatDate(state.computedAt) })
        }
        if (caveat) title = caveat
        // The caveat must ALSO be visible without hovering — a small muted dot
        // carries the same message via aria-label, never tooltip-only (a11y).
        const dot = caveat ? (
          <span role="img" aria-label={caveat} title={caveat}
            style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', marginLeft: 5 }} />
        ) : null
        return onOpenCandidateSearch ? (
          // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
          <button type="button" style={{ ...leadsBtn, color: known ? 'var(--color-primary-text)' : 'var(--text-muted)' }}
            aria-label={t('columns.leadsOpenSearch')} title={title}
            onClick={e => { e.stopPropagation(); onOpenCandidateSearch(r.id as Id) }}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
            {label}{dot}
          </button>
        ) : <span title={title} style={!known ? { color: 'var(--text-muted)' } : undefined}>{label}{dot}</span>
      },
    },
    {
      // Column sort item 4: serverKey maps to VacancyQuery's applications_count
      // sort_by whitelist entry (useVacanciesData.ts's VACANCY_SORT_KEYS) — a
      // NEW, separate pair from the old `sort=status` param, which stays wired
      // untouched via the status column's own `serverKey: 'status'` above.
      key: 'applications', header: t('columns.applications'), sortable: true, serverKey: 'applications_count', sortValue: r => r.applicationsCount,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' },
      // V4 (vacatures-tabel-cluster): same ghost-button deep-link treatment as the
      // Leads column — clicking the count opens the drawer on the Sollicitaties
      // (applicants) tab instead of the default tab. stopPropagation so it never
      // double-fires the row's own onSelect.
      render: r => onOpenApplicants ? (
        <button type="button" style={leadsBtn} aria-label={t('columns.applicationsOpen')}
          onClick={e => { e.stopPropagation(); onOpenApplicants(r.id as Id) }}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
          {r.applicationsCount ?? 0}
        </button>
      ) : (r.applicationsCount ?? 0),
    },
    {
      // V-table-2: third count column — Matches, deep-linking to the drawer's
      // read-only Matches tab (mirrors the Sollicitaties column's ghost button).
      key: 'matches', header: t('columns.matches'), sortable: true, sortValue: r => r.matchesCount,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' },
      render: r => onOpenMatches ? (
        <button type="button" style={leadsBtn} aria-label={t('columns.matchesOpen')}
          onClick={e => { e.stopPropagation(); onOpenMatches(r.id as Id) }}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
          {r.matchesCount ?? 0}
        </button>
      ) : (r.matchesCount ?? 0),
    },
    {
      key: 'published', header: t('columns.published'), nowrap: true, sortable: true, sortValue: r => (r.published ? 1 : 0),
      render: r => {
        if (!r.published) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('publishedState.no')}</span>
        // Icon + text so the "published" state never relies on colour alone (a11y).
        // Shared pill (SoftChip round + icon) — identical to the candidates/customers
        // koios pill (Danny 2026-07-14 unification).
        return colorPublished ? (
          <SoftChip color="var(--color-success)" round label={<><Globe size={12} /> {t('publishedState.yes')}</>} />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...plainCell }}>
            <Globe size={12} /> {t('publishedState.yes')}
          </span>
        )
      },
    },
    {
      // VAC-AGENT-1: the linked AI agent (Option A: linking IS the interview toggle
      // for this vacancy) — name, or an em-dash when none is linked.
      key: 'aiAgent', header: t('columns.aiAgent'), nowrap: true, sortable: true, sortValue: r => r.aiAgentName ?? '',
      // Sparkle soft-avatar so the column reads as an AI agent, not a person (Danny 22-07).
      render: r => r.aiAgentName ? <AiAgentAvatar name={r.aiAgentName} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      // Column sort item 4: serverKey maps to VacancyQuery's created_at sort_by.
      key: 'createdAt', header: t('columns.createdAt'), nowrap: true, cellStyle: mutedCell, serverKey: 'created_at',
      sortable: true, sortValue: r => r.createdSort ?? r.created, render: r => formatDate(r.created),
    },
    {
      // V2 (vacatures-tabel-cluster): relative age since creation ("3w") — cheap,
      // no backend dependency (created_at already ships on the list). Tooltip
      // carries the exact date so the compact token never loses precision.
      key: 'age', header: t('columns.age'), nowrap: true, cellStyle: mutedCell,
      sortable: true, sortValue: r => r.createdSort ?? r.created,
      render: r => {
        const age = relativeAge(r.created)
        if (!age) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return <span title={formatDate(r.created)}>{t(`age.${age.unit}`, { count: age.value })}</span>
      },
    },
    // Shared Koios column factory (Danny 05-08 consistency pass) — same header,
    // sort and cell as every other entity table; sits right before owner (§3A).
    makeKoiosColumn({ adviceOf, colored: colorKoios, label: t('common:koios.column', { defaultValue: 'Koios' }) }),
    {
      key: 'owner', header: t('columns.owner'), sortable: true, sortValue: r => r.owner?.name ?? '',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {r.owner?.name && <Avatar initials={r.owner.initials} size={22} color={colorOwner ? r.owner.color : NEUTRAL_AVATAR} soft />}
          <span style={mutedCell}>{r.owner?.name || '—'}</span>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      selectedId={selectedId}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      loading={loading}
      loadingText={t('page.loading')}
      emptyText={t('page.empty')}
      stickyHeader={stickyHeader}
      scrollParentRef={scrollParentRef}
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      sort={sort}
      onSortChange={onSortChange}
    />
  )
}
