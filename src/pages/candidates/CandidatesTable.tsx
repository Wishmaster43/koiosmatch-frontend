import { useTranslation } from 'react-i18next'
import type { ComponentType, CSSProperties } from 'react'
import { Target, Phone, CalendarPlus, Sparkles, Mail, MessageCircle, PhoneCall, Building2, Video, FileText, HelpCircle } from 'lucide-react' // HelpCircle = fallback for unknown contact channel
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { useDateFormat } from '@/lib/datetime'
import { useLookups } from '@/context/LookupsContext'
import { useGenders } from '@/lib/useGenders'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
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
export default function CandidatesTable({ rows, loading, selectedId, onSelect, selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false }: CandidatesTableProps) {
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
  const { labelOf: lastContactLabel } = useLastContactTypes()
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
      sticky: true, width: 200,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={c.initials} size={26} color={avatarColor(c.gender)} soft />
          <span style={{ color: 'var(--text)', fontSize: 12 }}>{c.name}</span>
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
        return <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
          background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span> },
    },
    {
      // Deployability ("status": Beschikbaar/Geplaatst/…) — model v2 axis.
      key: 'status', header: t('columns.deployability'), sortable: true, sortValue: c => statusMeta(c.status).label,
      render: c => { const m = statusMeta(c.status)
        if (!colorStatus) return <span style={plainCell}>{m.label}</span>
        return <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
          background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span> },
    },
    { key: 'created', header: t('columns.createdAt'), nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.created, render: c => formatDate(c.created) },
    {
      // Combined last-contact column: date + channel icon. Channel stays filterable via CandidatesPage filters.
      key: 'lastContact', header: t('columns.lastContact'), nowrap: true, sortable: true, sortValue: c => c.lastContactAt ?? '',
      render: c => {
        if (!c.lastContactAt) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const label = lastContactLabel(c.lastContactType)
        const Icon = c.lastContactType ? (CONTACT_TYPE_ICON[c.lastContactType] ?? HelpCircle) : null
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontSize: 12 }}>
            {formatDate(c.lastContactAt)}
            {Icon && <Icon size={12} title={label} style={{ flexShrink: 0, opacity: 0.6 }} />}
          </span>
        )
      },
    },
    {
      key: 'funnelType', header: t('columns.funnelType'), nowrap: true,
      sortable: true, sortValue: c => funnelOrder[c.stage] ?? 99,
      render: c => {
        if (!c.stage) return dash
        // Chip from the API's flat funnel_label/funnel_color; the lookup is the fallback.
        const m = funnelMeta(c.stage)
        const label = c.stageLabel ?? m.label
        if (!colorFunnel) return <span style={plainCell}>{label}</span>
        const color = c.stageColor ?? m.color
        return <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
          background: color + '1A', color, border: `1px solid ${color}55` }}>{label}</span>
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
            {shown.map(v => { const m = typeMeta(v); return (
              <span key={v} style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
                background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span>
            )})}
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
            {shown.map((p, i) => {
              const color = p.color || '#6B7280'
              return <span key={p.id ?? p.name ?? i} title={p.name}
                style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
                  background: color + '1A', color, border: `1px solid ${color}55`,
                  maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            })}
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
        return (
          <span title={a.reason || undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
              padding: '3px 8px', borderRadius: 99, background: meta.color + '14', color: meta.color,
              border: `1px solid ${meta.color}40`, whiteSpace: 'nowrap' }}>
            <Icon size={12} />{label}
          </span>
        )
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
