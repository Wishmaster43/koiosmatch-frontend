import { useTranslation } from 'react-i18next'
import type { ComponentType, CSSProperties } from 'react'
import { Target, Phone, CalendarPlus, Sparkles, Mail, MessageCircle, PhoneCall, Building2, Video, FileText, HelpCircle } from 'lucide-react' // HelpCircle = fallback for unknown contact channel
import DataTable from '@/components/ui/DataTable'
import CandidateStatusChip from '@/components/ui/CandidateStatusChip'
import SoftChip from '@/components/ui/SoftChip'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import { useGenders } from '@/lib/useGenders'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import LookupIcon from '@/components/ui/LookupIcon'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Plain-text cell (matches the function column) — the uniform style for all values.
const plainCell: CSSProperties = { color: 'var(--text)', fontSize: 12 }
const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>

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

// Icon + colour per Koios advice action (hex so `+ alpha` tints work).
const ADVICE_META: Record<string, { icon: LucideIcon; color: string }> = {
  add_to_pool: { icon: Target,       color: '#19A5CA' },
  contact:     { icon: Phone,        color: '#D97706' },
  plan_intake: { icon: CalendarPlus, color: '#2563EB' },
  default:     { icon: Sparkles,     color: '#6B7280' },
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
}

/**
 * CandidatesTable — candidate list as a loose component.
 *
 * Only declares the columns; rendering, selection and the loading/empty states
 * live in the generic DataTable. Reuse that table for other entity lists with
 * their own column set.
 */
export default function CandidatesTable({ rows, loading, selectedId, onSelect, onOpenTab, selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false }: CandidatesTableProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // LookupsContext is still untyped JS — cast its API to the meta shapes used here.
  const { funnelTypes, funnelMeta, statusMeta, phaseMeta, typeMeta } = useLookups() as unknown as {
    funnelTypes: Array<{ value: string }>
    funnelMeta: (v: string) => { label: string; color: string }
    statusMeta: (v: string) => { label: string; color: string }
    phaseMeta: (v: string) => { label: string; color: string }
    typeMeta: (v: string) => { label: string; color: string }
  }
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
  const NEUTRAL_AVATAR = '#9CA3AF'
  const avatarColor = (g?: string | null) => coloredByGender ? (genderColor(g) ?? NEUTRAL_AVATAR) : NEUTRAL_AVATAR
  // Status chip + owner avatar are coloured ON by default (status = lifecycle, owner = recruiter).
  const colorStatus = getBoolSetting(settings, 'candidate_table_color_status', true)
  // Phase (lifecycle) chip — coloured ON by default (carries meaning, like status).
  const colorPhase  = getBoolSetting(settings, 'candidate_table_color_phase', true)
  const colorOwner  = getBoolSetting(settings, 'candidate_table_color_owner', true)
  // Sort the funnel column by lifecycle order (prospect → alumni), not alphabetically.
  const funnelOrder: Record<string, number> = Object.fromEntries(funnelTypes.map((f, i) => [f.value, i]))

  const columns: Column<Candidate>[] = [
    {
      key: 'name', header: t('columns.name'), sortable: true, sortValue: c => c.name,
      sticky: true, width: 200, nowrap: true,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar initials={c.initials} size={26} color={avatarColor(c.gender)} soft />
          <span style={{ color: 'var(--text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }} title={c.name}>{c.name}</span>
        </div>
      ),
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
      render: c => c.lifecycle === 'pending_erase'
        ? <SoftChip label={t('lifecycle.pendingErase')} color="var(--color-danger)" round />
        : c.lifecycle === 'archived'
          ? <SoftChip label={t('lifecycle.archived')} color="var(--text-muted)" round />
          : <CandidateStatusChip status={c.status} phase={c.phase} plain={!colorStatus} round />,
    },
    { key: 'created', header: t('columns.createdAt'), nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.created, render: c => formatDate(c.created) },
    {
      // Combined last-contact column: date + channel icon. Channel stays filterable via CandidatesPage filters.
      key: 'lastContact', header: t('columns.lastContact'), nowrap: true, sortable: true, sortValue: c => c.lastContactAt ?? '',
      render: c => {
        if (!c.lastContactAt) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const label = lastContactLabel(c.lastContactType)
        // Settings-managed icon wins (Danny 14/7: a changed icon must show up);
        // the hardcoded map is only the fallback for legacy values.
        const lookupIcon = c.lastContactType ? lastContactIcon(c.lastContactType) : null
        const Icon = !lookupIcon && c.lastContactType ? (CONTACT_TYPE_ICON[c.lastContactType] ?? HelpCircle) : null
        // Tooltip + subtle "· by whom" once the backend returns last_contact_by (graceful null).
        const tip = c.lastContactBy ? `${label} · ${c.lastContactBy}` : label
        // Danny 2026-07-06: clicking the date/icon jumps STRAIGHT to Communicatie → Notities.
        return (
          <button onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'communication') }} title={tip}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontSize: 12,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>
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
        // Clicking jumps to the Werk tab — the application/match behind this stage.
        const m = funnelMeta(c.stage)
        const label = c.stageLabel ?? m.label
        const jump = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onOpenTab?.(c, 'work') }
        if (!colorFunnel) return <button onClick={jump} style={{ ...plainCell, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>{label}</button>
        const color = c.stageColor ?? m.color
        return <button onClick={jump} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><SoftChip label={label} color={color} /></button>
      },
    },
    {
      key: 'candidateType', header: t('columns.contractForm'), nowrap: true,
      sortValue: c => (c.candidateTypes ?? [])[0] ?? '', sortable: true,
      render: c => {
        const list = c.candidateTypes ?? []
        if (list.length === 0) return dash
        if (!colorType) return <span style={plainCell}>{list.map(v => typeMeta(v).label).join(', ')}</span>
        const shown = list.slice(0, 2)
        return (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {shown.map(v => { const m = typeMeta(v); return <SoftChip key={v} label={m.label} color={m.color} /> })}
            {list.length > shown.length && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{list.length - shown.length}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'talentPool', header: t('columns.talentPool'), nowrap: true, sortable: true, sortValue: c => (c.pools ?? [])[0]?.name ?? '',
      render: c => {
        const pools = c.pools ?? []
        if (pools.length === 0) return dash
        if (!colorPool) return <span style={plainCell}>{pools.map(p => p.name).filter(Boolean).join(', ')}</span>
        const shown = pools.slice(0, 2)
        return (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {shown.map((p, i) => <SoftChip key={p.id ?? p.name ?? i} label={p.name} color={p.color || '#6B7280'} title={p.name} />)}
            {pools.length > shown.length && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{pools.length - shown.length}</span>}
          </div>
        )
      },
    },
    {
      key: 'koios', nowrap: true, sortable: true, sortValue: c => c.koiosAdvice?.action ?? '',
      header: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <KoiosAiMark size={16} />{t('columns.koios')}
        </span>
      ),
      render: c => {
        const a = c.koiosAdvice
        if (!a || !a.action || a.action === 'none') return dash
        const label = a.label || t(`koios.actions.${a.action}`, { defaultValue: a.action })
        if (!colorKoios) return <span style={plainCell} title={a.reason || undefined}>{label}</span>
        const meta = ADVICE_META[a.action] ?? ADVICE_META.default
        const Icon = meta.icon
        // Shared pill (SoftChip round + icon) — identical to the customers koios
        // pill and the vacancies "published" pill (Danny 2026-07-14 unification).
        return <SoftChip title={a.reason || undefined} color={meta.color} round label={<><Icon size={12} />{label}</>} />
      },
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
      defaultSort={{ key: 'created', dir: 'desc' }}
    />
  )
}
