import { useTranslation } from 'react-i18next'
import { ListChecks, Folder, FolderPlus, FolderMinus, UserCog, Milestone, Briefcase, Tag, Tags, StickyNote, Archive, ShieldCheck, UserCheck, Activity, GitMerge, RefreshCw, X, ExternalLink } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { BTN_H } from '@/config/buttonMetrics'
import { useTenantPools } from './hooks/useCandidatePools'
import type { CandidatePool } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'

interface BulkUser { id: Id; name: string }

interface CandidatesBulkBarProps {
  count: number
  onClear: () => void
  onAddToPool: (pool: CandidatePool) => void
  onRemoveFromPool: (pool: CandidatePool) => void
  onSetOwner: (user: BulkUser) => void
  onSetStage: (stage: string) => void
  onSetTypes: (types: string[]) => void
  onSetConsent: (consent: Record<string, boolean>, label: string) => void
  onConvertPhase: (phase: string) => void
  onSetStatus: (status: string, label: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onAddNote: (text: string) => void
  onArchive: () => void
  canArchive?: boolean
  // 11.1 deep-link: navigates to the Applications page with the current selection
  // (NavigationContext intent pattern). Optional — the menu entry only renders once
  // the parent wires it (honest gate: no dead button before that plumbing lands).
  onManageByApplication?: () => void
  // Bulk-merge entry (punt 4) — the menu item only appears with exactly 2 rows
  // selected (checked by the caller too — this stays a thin assembler, no rule here)
  // and the same permission as archive (candidates.delete).
  onMerge?: () => void
  canMerge?: boolean
  // GEO-REGEOCODE-1: bulk "PDOK opnieuw ophalen" — queued + async (202), no per-row
  // reconcile. Gated on candidates.update, same as the per-record GeocodeButton.
  onGeocode?: () => void
  canGeocode?: boolean
  users?: BulkUser[]
  funnelTypes?: LookupOption[]
  candidateTypes?: LookupOption[]
  phases?: LookupOption[]
  statuses?: LookupOption[]
  selectedTags?: string[]
}

/**
 * CandidatesBulkBar — the selection action bar shown above the table when ≥1
 * candidate is checked. A single "Massa mutaties" menu (ActionMenu, drill-in)
 * holds every bulk mutation. Each action is one config node; the data it needs
 * (users, lookups, tags) comes in via props so this stays a thin assembler.
 */
export default function CandidatesBulkBar({
  count, onClear, onAddToPool, onRemoveFromPool, onSetOwner, onSetStage, onSetTypes, onSetConsent,
  onConvertPhase, onSetStatus, onAddTag, onRemoveTag, onAddNote, onArchive, canArchive = false,
  onMerge, canMerge = false, onManageByApplication, onGeocode, canGeocode = false,
  users = [], funnelTypes = [], candidateTypes = [], phases = [], statuses = [], selectedTags = [],
}: CandidatesBulkBarProps) {
  const { t } = useTranslation('candidates')
  // Talent pools for the add/remove option lists (fetch lives in the hook, §3).
  const pools = useTenantPools()

  // Build the menu option lists from props/state.
  const poolOptions = pools.map(p => ({ value: p.id ?? p.name ?? '', label: p.name, color: p.color || '#6B7280' }))
  const userOptions = users.map(u => ({ value: u.id, label: u.name }))
  const stageOptions = funnelTypes.map(f => ({ value: f.value, label: f.label, color: f.color }))
  const typeOptions = candidateTypes.map(ct => ({ value: ct.value, label: ct.label, color: ct.color }))
  const phaseOptions = phases.map(p => ({ value: p.value, label: p.label, color: p.color }))
  // Only "simple" statuses in bulk — exclude anything needing extra per-candidate input:
  // requires_match (placed), requires_reason (unavailable/blacklist) AND expects_return_date
  // (sick/leave). Those go through the drawer prompt so the guard contract is satisfied.
  const statusOptions = statuses
    .filter(s => !s.requires_match && !s.requires_reason && !(s as { expects_return_date?: boolean }).expects_return_date)
    .map(s => ({ value: s.value, label: s.label, color: s.color }))
  const tagOptions = selectedTags.map(tg => ({ value: tg, label: tg }))

  // Resolve a picked pool/user id back to the full object the parent needs.
  const pickPool = (handler: (pool: CandidatePool) => void) => (poolId: string | number) => { const p = pools.find(x => (x.id ?? x.name) === poolId); if (p) handler(p) }
  const pickUser = (handler: (user: BulkUser) => void) => (userId: string | number) => { const u = users.find(x => x.id === userId); if (u) handler(u) }

  // Declarative bulk-action tree; extend with more actions as extra nodes.
  // Archive is gated: only present when the user may delete (server re-checks).
  const items: MenuNode[] = [
    { key: 'owner', label: t('bulk.changeOwner'), icon: UserCog,
      searchPlaceholder: t('bulk.searchOwner'), emptyText: t('bulk.noUsers'), options: userOptions, onPick: pickUser(onSetOwner) },
    { key: 'pool', label: t('bulk.pool'), icon: Folder, items: [
      { key: 'add-pool', label: t('bulk.addToPool'), icon: FolderPlus,
        searchPlaceholder: t('bulk.searchPool'), emptyText: t('bulk.noPools'), options: poolOptions, onPick: pickPool(onAddToPool) },
      { key: 'remove-pool', label: t('bulk.removeFromPool'), icon: FolderMinus,
        searchPlaceholder: t('bulk.searchPool'), emptyText: t('bulk.noPools'), options: poolOptions, onPick: pickPool(onRemoveFromPool) },
    ] },
    // BULK-FUNNEL-SOLE-1: the BE bulk endpoint (candidates/bulk/funnel-stage) moves
    // each candidate's ONE-AND-ONLY live application — a candidate with 0 or >1 live
    // applications is skipped (surfaced via the reasoned partial-result toast, see
    // useCandidateBulkActions' bulkSetStage). Says so up front instead of reading as
    // if a vacancy could be chosen.
    { key: 'stage', label: t('bulk.changeStage'), icon: Milestone, note: t('bulk.stageNote'),
      searchPlaceholder: t('bulk.searchStage'), options: stageOptions, onPick: (v) => onSetStage(String(v)) },
    // 11.1: convenience deep-link to the axis-correct per-application bulk home
    // (ApplicationsBulkBar) — gated on the callback being wired (honest gate, see the
    // prop comment above).
    ...(onManageByApplication ? [{ key: 'manage-by-application', label: t('bulk.manageByApplication'), icon: ExternalLink, onSelect: onManageByApplication }] : []),
    { key: 'phase', label: t('bulk.changePhase'), icon: UserCheck,
      searchPlaceholder: t('bulk.searchPhase'), options: phaseOptions, onPick: (v) => onConvertPhase(String(v)) },
    { key: 'status', label: t('bulk.changeStatus'), icon: Activity,
      searchPlaceholder: t('bulk.searchStatus'), options: statusOptions,
      onPick: (v) => onSetStatus(String(v), statusOptions.find(o => o.value === v)?.label ?? String(v)) },
    { key: 'type', label: t('bulk.changeType'), icon: Briefcase, multiSelect: true,
      searchPlaceholder: t('bulk.searchType'), emptyText: t('bulk.noTypes'), options: typeOptions,
      submitLabel: t('bulk.typeSubmit'), onSubmit: (v) => onSetTypes(Array.isArray(v) ? v.map(String) : []) },
    { key: 'add-tag', label: t('bulk.addTag'), icon: Tags, input: true,
      placeholder: t('bulk.addTagPlaceholder'), submitLabel: t('bulk.typeSubmit'), onSubmit: (v) => onAddTag(String(v)) },
    { key: 'tag', label: t('bulk.removeTag'), icon: Tag,
      searchPlaceholder: t('bulk.searchTag'), emptyText: t('bulk.noTags'), options: tagOptions, onPick: (v) => onRemoveTag(String(v)) },
    { key: 'note', label: t('bulk.addNote'), icon: StickyNote, input: true,
      placeholder: t('bulk.notePlaceholder'), submitLabel: t('bulk.noteSubmit'), onSubmit: (v) => onAddNote(String(v)) },
    { key: 'consent', label: t('bulk.consent'), icon: ShieldCheck, items: [
      { key: 'wa', label: t('communication.consentWhatsapp'), items: [
        { key: 'wa-on',  label: t('bulk.consentOn'),  onSelect: () => onSetConsent({ whatsapp_opt_in: true },  `WhatsApp — ${t('bulk.consentOn')}`) },
        { key: 'wa-off', label: t('bulk.consentOff'), onSelect: () => onSetConsent({ whatsapp_opt_in: false }, `WhatsApp — ${t('bulk.consentOff')}`) },
      ] },
      { key: 'em', label: t('communication.consentEmail'), items: [
        { key: 'em-on',  label: t('bulk.consentOn'),  onSelect: () => onSetConsent({ email_opt_in: true },  `E-mail — ${t('bulk.consentOn')}`) },
        { key: 'em-off', label: t('bulk.consentOff'), onSelect: () => onSetConsent({ email_opt_in: false }, `E-mail — ${t('bulk.consentOff')}`) },
      ] },
      { key: 'nl', label: t('communication.consentNewsletter'), items: [
        { key: 'nl-on',  label: t('bulk.consentOn'),  onSelect: () => onSetConsent({ newsletter_opt_in: true },  `${t('communication.consentNewsletter')} — ${t('bulk.consentOn')}`) },
        { key: 'nl-off', label: t('bulk.consentOff'), onSelect: () => onSetConsent({ newsletter_opt_in: false }, `${t('communication.consentNewsletter')} — ${t('bulk.consentOff')}`) },
      ] },
    ] },
    // Bulk-merge (punt 4): only offered with EXACTLY 2 rows selected — merging is
    // pairwise (one survivor absorbs one duplicate), so any other count is ambiguous.
    ...(count === 2 && canMerge && onMerge ? [{ key: 'merge', label: t('bulk.merge'), icon: GitMerge, onSelect: onMerge }] : []),
    // GEO-REGEOCODE-1: reuses the ONE shared common:geocode.refresh label (no
    // per-entity i18n key) — mirrors the per-record GeocodeButton's tooltip text.
    ...(canGeocode && onGeocode ? [{ key: 'geocode', label: t('common:geocode.refresh'), icon: RefreshCw, onSelect: onGeocode }] : []),
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
        {t('bulk.selected', { count })}
      </span>

      {/* Single bulk-mutations menu with drill-in submenus */}
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', height: BTN_H, padding: '0 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
