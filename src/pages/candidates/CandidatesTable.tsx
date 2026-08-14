import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentType, CSSProperties, RefObject } from 'react'
import { Mail, MessageCircle, PhoneCall, Building2, Video, FileText, HelpCircle, CalendarX2 } from 'lucide-react' // HelpCircle = fallback for unknown contact channel; CalendarX2 = missing-appointment attention icon
import DataTable from '@/components/ui/DataTable'
import CandidateStatusChip from '@/components/ui/CandidateStatusChip'
import SoftChip from '@/components/ui/SoftChip'
import type { Column, ControlledSort } from '@/components/ui/DataTable'
import { CANDIDATE_SORT_KEYS } from './hooks/useCandidatesData'
import Avatar, { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import BackofficeCouplingIndicator from '@/components/ui/BackofficeCouplingIndicator'
import { makeKoiosColumn } from '@/components/ui/koiosColumn'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import { useApps } from '@/context/AppsContext'
import { useGenders } from '@/lib/useGenders'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import LookupIcon from '@/components/ui/LookupIcon'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useCandidateAdvice } from '@/lib/useCandidateAdvice'
import { contactTarget, funnelTarget, statusTarget, TARGET_CONVERSATIONS, TARGET_MATCHES, TARGET_POOLS, TARGET_PREFERENCES, TARGET_INTEGRATIONS } from './data/candidateCellTargets'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Plain-text cell (matches the function column) — the uniform style for all values.
const plainCell: CSSProperties = { color: 'var(--text)', fontSize: 12 }
const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>

// Shared reset style for every clickable cell wrapper — keeps the visual output
// pixel-identical to a plain <span>/<div> while making the whole cell a real button.
const cellButton: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }

type LucideIcon = ComponentType<{ size?: number; title?: string; style?: CSSProperties }>

// Icon per contact channel slug — shown in the last-contact-type column. Covers the full
// last_contact_types lookup so no channel falls back to the "?" (HelpCircle). Danny 2026-07-03.
const CONTACT_TYPE_ICON: Record<string, LucideIcon> = {
  email:            Mail,
  phone:            PhoneCall,   // Telefonisch
  call:             PhoneCall,   // Belafspraak (phone appointment)
  whatsapp:         MessageCircle,
  whatsapp_private: MessageCircle,
  appointment:      Building2,   // Afspraak (fysiek/kantoor)
  meet:             Video,       // Google Meet (online meeting)
  note:             FileText,
}

interface CandidatesTableProps {
  rows: Candidate[]
  loading?: boolean
  selectedId?: Id | null
  onSelect?: (row: Candidate) => void
  // Cell deep-link: open the drawer on a specific tab (contact → communication, funnel → work).
  onOpenTab?: (row: Candidate, tab: string) => void
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  // Virtualization (audit item 7): the vertical scroll container the table sits in.
  scrollParentRef?: RefObject<HTMLElement | null>
  // CAND-SORT-1: controlled-sort escape hatch — forwarded to DataTable as-is.
  // Optional so a caller (or a test) that omits both keeps the pre-existing
  // uncontrolled/defaultSort behaviour untouched.
  sort?: ControlledSort | null
  onSortChange?: (sort: ControlledSort) => void
}

/**
 * CandidatesTable — candidate list as a loose component.
 *
 * Only declares the columns; rendering, selection and the loading/empty states
 * live in the generic DataTable. Reuse that table for other entity lists with
 * their own column set.
 *
 * `columns` is memoized (audit item 7, 2026-07-15): DataTable memoizes each row,
 * but that only pays off if the `columns` array it receives is referentially
 * stable — otherwise every row's props "change" every render and the memo never
 * hits. genderColor/lastContactLabel/lastContactIcon are themselves stabilized
 * (useCallback) in their hooks so they don't force this memo to churn.
 */
export default function CandidatesTable({ rows, loading, selectedId, onSelect, onOpenTab, selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false, scrollParentRef, sort, onSortChange }: CandidatesTableProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // LookupsContext is still untyped JS — cast its API to the meta shapes used here.
  const { funnelTypes, funnelMeta, statusMeta, phaseMeta, typeMeta } = useLookups() as unknown as {
    funnelTypes: Array<{ value: string }>
    funnelMeta: (v: string) => { label: string; color: string; is_match?: boolean }
    statusMeta: (v: string) => { label: string; color: string; requires_match?: boolean; requires_reason?: boolean; expects_return_date?: boolean; is_blacklist?: boolean; icon?: string }
    phaseMeta: (v: string) => { label: string; color: string }
    typeMeta: (v: string) => { label: string; color: string }
  }
  // Shared Koios advice resolver — the table and the drawer's "Koios AI adviseert"
  // block now read the SAME source, so they can no longer disagree.
  const adviceOf = useCandidateAdvice()
  const { colorOf: genderColor } = useGenders()
  const { labelOf: lastContactLabel, iconOf: lastContactIcon } = useLastContactTypes()
  // Tenant display settings (Settings → Candidate → Table display). All default off.
  const settings = useAllSettings()
  // Coloured chips vs. plain text — one flag PER column. KPI row keeps colours regardless.
  const colorFunnel = getBoolSetting(settings, 'candidate_table_color_funnel', false)
  const colorType   = getBoolSetting(settings, 'candidate_table_color_type', false)
  const colorPool   = getBoolSetting(settings, 'candidate_table_color_pool', false)
  const colorKoios  = getBoolSetting(settings, 'candidate_table_color_koios', false)
  // Avatar: one calm neutral grey by default (everything the same); per-gender colour
  // only when enabled (unknown gender → same neutral grey).
  const coloredByGender = getBoolSetting(settings, 'candidate_avatar_colored_by_gender', false)
  // Status chip + owner avatar are coloured ON by default (status = lifecycle, owner = recruiter).
  const colorStatus = getBoolSetting(settings, 'candidate_table_color_status', true)
  // Phase (lifecycle) chip — coloured ON by default (carries meaning, like status).
  const colorPhase  = getBoolSetting(settings, 'candidate_table_color_phase', true)
  const colorOwner  = getBoolSetting(settings, 'candidate_table_color_owner', true)
  // Backoffice coupling column (JOB2): only shown for systems the tenant actually
  // enabled — mirrors BackofficeLinksTab's own isAppEnabled('hf'/'shiftmanager') gate.
  const apps = useApps()
  const showHelloflex = apps?.isAppEnabled('hf') ?? false
  const showShiftmanager = apps?.isAppEnabled('shiftmanager') ?? false

  // Column defs — memoized so DataTable's per-row memo (audit item 7) actually
  // holds: a stable `columns` reference means a row only re-renders when ITS OWN
  // data/selection changes. `avatarColor`/`funnelOrder` are derived INSIDE the
  // memo body (not hoisted above it) so they never force an extra dependency.
  const columns: Column<Candidate>[] = useMemo(() => {
    // Sort the funnel column by lifecycle order (prospect → alumni), not alphabetically.
    const funnelOrder: Record<string, number> = Object.fromEntries(funnelTypes.map((f, i) => [f.value, i]))
    const avatarColor = (g?: string | null) => coloredByGender ? (genderColor(g) ?? NEUTRAL_AVATAR) : NEUTRAL_AVATAR

    return [
      {
        // CAND-SORT-1: serverKey maps to CandidateQuery's last_name sort (mirrors the
        // pre-adoption hardcoded orderBy('last_name') default).
        key: 'name', header: t('columns.name'), sortable: true, sortValue: c => c.name,
        serverKey: CANDIDATE_SORT_KEYS.name,
        sticky: true, width: 200, nowrap: true,
        render: c => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Avatar initials={c.initials} size={26} color={avatarColor(c.gender)} soft />
            <span style={{ color: 'var(--text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }} title={c.name}>{c.name}</span>
            {/* V-appdetail-1/2: a stage that requires an appointment (requires_appointment,
                §3B) has none planned yet — a scanning aid so the recruiter can act on it
                without opening the drawer. Icon-only, accessible label carries the meaning
                (§6: never colour alone). */}
            {c.missingAppointment && (
              <CalendarX2 size={14} color="var(--color-warning)" aria-label={t('columns.missingAppointment')} role="img" style={{ flexShrink: 0 }} />
            )}
          </div>
        ),
      },
      {
        // Human-readable reference number (K-00123, JOB1) — an identifier, so it
        // sits right after the name, not buried at the end. Plain mono text (not the
        // interactive ReferenceNumberChip): a click-to-copy button nested inside this
        // row's own click-to-open would either double-fire or need stopPropagation
        // contortions; the copy affordance already lives in the drawer chip.
        key: 'referenceNumber', header: t('columns.referenceNumber'), nowrap: true,
        cellStyle: { color: 'var(--text-muted)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' },
        sortable: true, sortValue: c => c.referenceNumber ?? '',
        render: c => c.referenceNumber || '—',
      },
      {
        key: 'title', header: t('columns.function'), nowrap: true, cellStyle: { color: 'var(--text)', fontSize: 12 },
        sortable: true, sortValue: c => c.title,
        render: c => c.title || '—',
      },
      { key: 'city', header: t('columns.city'), nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.city, render: c => c.city || '—' },
      {
        // Phase (lifecycle: Lead/Kandidaat) — model v2 axis.
        key: 'phase', header: t('columns.phase'), sortable: true, sortValue: c => phaseMeta(c.phase).label,
        render: c => { if (!c.phase) return dash; const m = phaseMeta(c.phase)
          if (!colorPhase) return <span style={plainCell}>{m.label}</span>
          // Phase is a lifecycle axis — round chip, like status (Danny 2026-07-14).
          return <SoftChip label={m.label} color={m.color} round /> },
      },
      {
        // Deployability ("status": Beschikbaar/Geplaatst/…) — model v2 axis.
        key: 'status', header: t('columns.deployability'), sortable: true, sortValue: c => c.status ? statusMeta(c.status).label : '',
        // Lifecycle wins in the archived/trash views (ERASE-1): show a Gearchiveerd/
        // Verwijderd chip instead of the deployability status. Otherwise the shared chip.
        render: c => {
          if (c.lifecycle === 'pending_erase') return <SoftChip label={t('lifecycle.pendingErase')} color="var(--color-danger)" round />
          if (c.lifecycle === 'archived') return <SoftChip label={t('lifecycle.archived')} color="var(--text-muted)" round />
          // LOOKUP-ICON-1 (batch 12, P22-30): the tenant status lookup can carry an icon
          // (lucide slug or emoji) — shown next to the chip, same passthrough pattern as
          // the last-contact column above. CandidateStatusChip itself stays icon-less
          // (used on many entities without this lookup shape); the icon rides alongside it.
          const statusIcon = c.status ? statusMeta(c.status).icon : null
          const chip = (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {statusIcon && <LookupIcon icon={statusIcon} size={12} />}
              <CandidateStatusChip status={c.status} phase={c.phase} plain={!colorStatus} round />
            </span>
          )
          // requires_match -> Matches, requires_reason/expects_return_date/is_blacklist ->
          // Voorkeuren (where the status window + edit pencil live); no flag -> plain click.
          const target = c.status ? statusTarget(statusMeta(c.status)) : null
          if (!target) return chip
          const linkLabel = target === TARGET_MATCHES ? t('cellLinks.matches') : t('cellLinks.preferences')
          return <button type="button" onClick={e => { e.stopPropagation(); onOpenTab?.(c, target) }} aria-label={linkLabel} style={cellButton}>{chip}</button>
        },
      },
      {
        // CAND-SORT-1: serverKey maps to CandidateQuery's created_at sort.
        key: 'created', header: t('columns.createdAt'), nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.created,
        serverKey: CANDIDATE_SORT_KEYS.created,
        render: c => formatDate(c.created),
      },
      {
        // Combined last-contact column: date + channel icon. Channel stays filterable via
        // CandidatesPage filters. CAND-SORT-1: serverKey maps to CandidateQuery's last_contact_at sort.
        key: 'lastContact', header: t('columns.lastContact'), nowrap: true, sortable: true, sortValue: c => c.lastContactAt ?? '',
        serverKey: CANDIDATE_SORT_KEYS.lastContact,
        render: c => {
          if (!c.lastContactAt) return <span style={{ color: 'var(--text-muted)' }}>—</span>
          const label = lastContactLabel(c.lastContactType)
          // Settings-managed icon wins (Danny 14/7: a changed icon must show up);
          // the hardcoded map is only the fallback for legacy values.
          const lookupIcon = c.lastContactType ? lastContactIcon(c.lastContactType) : null
          const Icon = !lookupIcon && c.lastContactType ? (CONTACT_TYPE_ICON[c.lastContactType] ?? HelpCircle) : null
          // Tooltip + subtle "· by whom" once the backend returns last_contact_by (graceful null).
          const tip = c.lastContactBy ? `${label} · ${c.lastContactBy}` : label
          // Danny 2026-07-25: WhatsApp opens Conversaties, every other channel opens Notities.
          const target = contactTarget(c.lastContactType)
          const linkLabel = target === TARGET_CONVERSATIONS ? t('cellLinks.conversations') : t('cellLinks.notes')
          return (
            <button type="button" onClick={e => { e.stopPropagation(); onOpenTab?.(c, target) }} title={tip} aria-label={linkLabel}
              style={{ ...cellButton, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontSize: 12 }}>
              {formatDate(c.lastContactAt)}
              {lookupIcon && <span style={{ display: 'inline-flex', flexShrink: 0, opacity: 0.6 }}><LookupIcon icon={lookupIcon} size={12} /></span>}
              {Icon && <Icon size={12} style={{ flexShrink: 0, opacity: 0.6 }} />}
            </button>
          )
        },
      },
      {
        key: 'funnelType', header: t('columns.funnelType'), nowrap: true,
        sortable: true, sortValue: c => funnelOrder[c.stage] ?? 99,
        render: c => {
          if (!c.stage) return dash
          // Chip from the API's flat funnel_label/funnel_color; the lookup is the fallback.
          // is_match (seed: Aangenomen) jumps to Matches, every other stage to Sollicitaties.
          const m = funnelMeta(c.stage)
          const label = c.stageLabel ?? m.label
          const target = funnelTarget(m)
          const linkLabel = target === TARGET_MATCHES ? t('cellLinks.matches') : t('cellLinks.applications')
          const jump = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onOpenTab?.(c, target) }
          if (!colorFunnel) return <button type="button" onClick={jump} aria-label={linkLabel} style={{ ...plainCell, ...cellButton }}>{label}</button>
          const color = c.stageColor ?? m.color
          return <button type="button" onClick={jump} aria-label={linkLabel} style={cellButton}><SoftChip label={label} color={color} /></button>
        },
      },
      {
        key: 'candidateType', header: t('columns.contractForm'), nowrap: true,
        sortValue: c => (c.candidateTypes ?? [])[0] ?? '', sortable: true,
        render: c => {
          const list = c.candidateTypes ?? []
          if (list.length === 0) return dash
          // Contractvorm always opens the Voorkeuren tab (Danny 25/7 spec, no flag needed).
          const jump = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onOpenTab?.(c, TARGET_PREFERENCES) }
          const content = !colorType
            ? <span style={plainCell}>{list.map(v => typeMeta(v).label).join(', ')}</span>
            : (() => {
                const shown = list.slice(0, 2)
                return (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {shown.map(v => { const m = typeMeta(v); return <SoftChip key={v} label={m.label} color={m.color} /> })}
                    {list.length > shown.length && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{list.length - shown.length}</span>
                    )}
                  </div>
                )
              })()
          return <button type="button" onClick={jump} aria-label={t('cellLinks.preferences')} style={cellButton}>{content}</button>
        },
      },
      {
        key: 'talentPool', header: t('columns.talentPool'), nowrap: true, sortable: true, sortValue: c => (c.pools ?? [])[0]?.name ?? '',
        render: c => {
          const pools = c.pools ?? []
          if (pools.length === 0) return dash
          // Talentenpool always opens Match > Talentenpools (Danny 25/7 spec, no flag needed).
          const jump = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onOpenTab?.(c, TARGET_POOLS) }
          const content = !colorPool
            ? <span style={plainCell}>{pools.map(p => p.name).filter(Boolean).join(', ')}</span>
            : (() => {
                const shown = pools.slice(0, 2)
                return (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {shown.map((p, i) => <SoftChip key={p.id ?? p.name ?? i} label={p.name} color={p.color || 'var(--text-muted)'} title={p.name} />)}
                    {pools.length > shown.length && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{pools.length - shown.length}</span>}
                  </div>
                )
              })()
          return <button type="button" onClick={jump} aria-label={t('cellLinks.pools')} style={cellButton}>{content}</button>
        },
      },
      // Shared Koios column factory (Danny 05-08 consistency pass) — same header,
      // sort and cell as every other entity table. Reads the shared
      // useCandidateAdvice() resolver, same source the drawer's advice block uses.
      makeKoiosColumn({
        adviceOf, colored: colorKoios, label: t('columns.koios'),
        fallbackLabel: action => t(`koios.actions.${action}`, { defaultValue: action }),
      }),
      {
        // Backoffice coupling scanning aid (JOB2) — not sortable: a compound
        // two-system state has no single clean sort order, and this is a glance
        // aid, not a data axis a recruiter would want to sort a whole list by.
        key: 'coupling', header: t('columns.coupling'), nowrap: true,
        // KOPPELING-COLUMN-1: a ghost button, exactly like the other deep-link
        // cells above — opens the drawer straight on the Koppelingen tab instead
        // of only being a glance-aid nobody can click through from.
        render: c => (
          <button type="button" onClick={e => { e.stopPropagation(); onOpenTab?.(c, TARGET_INTEGRATIONS) }}
            aria-label={t('cellLinks.integrations')} style={cellButton}>
            <BackofficeCouplingIndicator helloflexLink={c.helloflexLink} shiftmanagerLink={c.shiftmanagerLink}
              showHelloflex={showHelloflex} showShiftmanager={showShiftmanager} />
          </button>
        ),
      },
      {
        key: 'owner', header: t('columns.owner'), sortable: true, sortValue: c => c.owner,
        render: c => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {c.ownerInitials !== '?' && <Avatar initials={c.ownerInitials} size={18} color={colorOwner ? c.ownerColor : NEUTRAL_AVATAR} soft />}
            <span style={{ color: 'var(--text)', fontSize: 12 }}>{c.owner || '—'}</span>
          </div>
        ),
      },
    ]
  }, [
    t, formatDate, funnelTypes, funnelMeta, statusMeta, phaseMeta, typeMeta,
    genderColor, lastContactLabel, lastContactIcon, adviceOf,
    colorFunnel, colorType, colorPool, colorKoios, coloredByGender, colorStatus, colorPhase, colorOwner,
    showHelloflex, showShiftmanager,
    onOpenTab,
  ])

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
      // CAND-SORT-1: defaultSort still seeds the UNCONTROLLED fallback (a caller
      // that omits sort/onSortChange, e.g. most of this file's own tests) —
      // harmless when the page below DOES pass both, since DataTable then reads
      // `sort` from the prop instead.
      defaultSort={{ key: 'created', dir: 'desc' }}
      sort={sort}
      onSortChange={onSortChange}
      scrollParentRef={scrollParentRef}
    />
  )
}
