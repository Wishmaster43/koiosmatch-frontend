/**
 * CandidateDrawer — thin container (§3A): wires data + mutations and declares
 * the header config + tab list. The phase/status axis lives in
 * useCandidateStatus, header edit in useCandidateHeaderEdit, and the header
 * visuals in drawer/CandidateHeaderBits; each tab is its own component.
 */
import { useState, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Trash2, GitMerge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import EntityDrawerJs from '@/components/drawer/EntityDrawer'
import EntityHeaderJs from '@/components/drawer/EntityHeader'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import { useGenders } from '@/lib/useGenders'
import { useAllSettings, getBoolSetting, getJsonSetting } from '@/lib/settings/useAllSettings'
import { useAuth } from '@/context/AuthContext'
import { useLookups } from '@/context/LookupsContext'
import { useCandidateStatus } from './hooks/useCandidateStatus'
import { useCandidateHeaderEdit } from './hooks/useCandidateHeaderEdit'
import { isVacancyTabVisible } from './lib/vacancyTabVisibility'
import type { VacancyTabConfig } from './lib/vacancyTabVisibility'
import ProfilePanel from './drawer/ProfilePanel'
import BackgroundTab from './drawer/BackgroundTab'
import WorkTab from './drawer/WorkTab'
import VacancySearchTab from './drawer/VacancySearchTab'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useCustomFields } from '@/lib/useCustomFields'
import PlanningPanel from './drawer/PlanningPanel'
import { PreferencesTab, ZzpTab } from './drawer/PreferencesZzpTabs'
import CommunicationTab from './drawer/CommunicationTab'
import DocumentsSection from './drawer/DocumentsSection'
import IntegrationsTab from './drawer/IntegrationsTab'
import StatisticsTab from './drawer/StatisticsTab'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './drawer/ChangelogTab'
import MergeCandidateModal from './drawer/MergeCandidateModal'
import CandidateStatusModals from './drawer/CandidateStatusModals'
import { PhaseChip, CandidateTitle, CandidateHeaderActions, ArchivedBanner } from './drawer/CandidateHeaderBits'
import CandidateDrawerFooter from './drawer/CandidateDrawerFooter'
import { peekReturnTab, clearReturnTab } from './drawer/constants'
import { parseTabTarget } from './drawer/tabTarget'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Still-untyped JS drawer shells — declare the props this drawer passes (typed boundary).
const EntityDrawer = EntityDrawerJs as ComponentType<{
  entity: unknown; expanded?: boolean; onToggleExpand?: () => void; footer?: ReactNode; initialTab?: string
  tabs?: Array<{ id: string; label: string; autoExpand?: boolean; render: () => ReactNode }>
  header?: (arg: { activeTab?: string; setActiveTab: (id: string) => void }) => ReactNode
}>
const EntityHeader = EntityHeaderJs as ComponentType<{
  label?: ReactNode; expanded?: boolean; onToggleExpand?: () => void; onClose?: () => void
  avatar?: unknown; onPhotoChange?: (url: string | null) => void; photoLabels?: unknown
  renderTitle?: () => ReactNode; titleActions?: ReactNode; actions?: ReactNode
  meta?: unknown; metaExtra?: ReactNode; tags?: unknown; tagsLabel?: string; children?: ReactNode
}>
interface AppUser { id: Id; name: string; [k: string]: unknown }

const TABS = [
  { id: 'profile',        tKey: 'profile'       },
  { id: 'background',     tKey: 'background'    },
  { id: 'work',           tKey: 'match'         },
  // Match-zoeker fase 1b: OPEN vacancies around the candidate's home location
  // (mirrors vacancies/drawer/CandidateSearchTab, the vacancy-side counterpart).
  { id: 'vacancySearch',  tKey: 'vacancySearch' },
  { id: 'planning',       tKey: 'planning'      },
  { id: 'preferences',    tKey: 'preferences'   },
  { id: 'administration', tKey: 'zzp'           },
  { id: 'communication',  tKey: 'communication' },
  { id: 'documents',      tKey: 'documents'     },
  { id: 'integrations',   tKey: 'integrations'  },
  { id: 'statistics',     tKey: 'statistics'    },
]

// Contract-type slugs (stable, backend-matching) that mark a freelancer — drives
// the Freelance (ZZP) tab's visibility. Selecting this type reveals the tab.
const ZZP_TYPE_SLUGS = ['freelance', 'zzp']

interface CandidateDrawerProps {
  candidate: Candidate | null
  onClose: () => void
  expanded: boolean
  onToggleExpand: () => void
  onUpdate?: (id: Id, patch: Record<string, unknown>) => void
  // Soft-delete → archived (Gearchiveerd view); backend re-checks live links (§3B).
  onArchive?: (id: Id) => void
  // Archived candidates only: bring back (restore) or permanently delete (admin-only, ARCH-2).
  onMarkDeletion?: (id: Id) => void
  onRestore?: (id: Id) => void
  onHardDelete?: (id: Id) => void
  // Merge (punt 4): page passes this only with candidates.delete; called with the
  // survivor id after a successful merge so the page reopens it fresh.
  onMerged?: (survivorId: Id) => void
  // Pure record refresh (Danny P1 "stale after match create"): refetches + REPLACES
  // this drawer's record from the page hook — never a PATCH. Forwarded to WorkTab so
  // a match/application/intake create shows fresh data everywhere (MatchesTab, the
  // header status/phase, Ervaring), not just in WorkTab's own local apps/appts state.
  onRefresh?: (id: Id) => Promise<void> | void
  users?: AppUser[]
  // Deep-link: open on this tab (table contact-cell → communication, funnel-chip → work).
  initialTab?: string
}

// Thin drawer container: composes the phase/status + header-edit hooks, resolves tab visibility (module/tenant/freelance gates) and deep-link targets, and renders each tab's content in renderTabContent below.
export default function CandidateDrawer({ candidate: c, onClose, expanded, onToggleExpand, onUpdate, onArchive, onMarkDeletion, onRestore, onHardDelete, onMerged, onRefresh, users = [], initialTab }: CandidateDrawerProps) {
  const { t } = useTranslation('candidates')
  const { colorOf: genderColor } = useGenders() as { colorOf: (g?: string) => string | undefined }
  // Avatar colour follows the same tenant setting as the table: neutral grey by
  // default, per-gender only when enabled (Settings → Candidate → Table display).
  const allSettings = useAllSettings()
  const coloredByGender = getBoolSetting(allSettings, 'candidate_avatar_colored_by_gender', false)
  const avatarColor = coloredByGender ? (genderColor(c?.gender) ?? NEUTRAL_AVATAR) : NEUTRAL_AVATAR
  // Tenant-configurable Vacatures-tab visibility (Danny 23-07): phases/statuses/
  // contract-form gate via the shared vacancyTabVisibility helper; null cfg falls
  // back to seed defaults.
  const { phases: tenantPhases, statuses: tenantStatuses, candidateTypes: tenantCandidateTypes } = useLookups()
  const vacancyTabCfg = getJsonSetting<VacancyTabConfig | null>(allSettings, 'candidate_vacancy_tab', null)
  const { hasModule, isSuperAdmin, hasRole, hasPermission } = useAuth() as unknown as { hasModule: (m: string) => boolean; isSuperAdmin: () => boolean; hasRole: (r: string) => boolean; hasPermission: (p: string) => boolean }
  // Hard delete is admin-only (Danny 2026-07-03) — the backend re-checks (§7: UI gating is UX).
  const canHardDelete = isSuperAdmin() || hasRole('admin')
  // RECHTEN-DETAIL-1 (Danny GO 06-08): archive/restore/mark-deletion carry their OWN
  // candidates.archive permission now (split off candidates.update) — gate the trash
  // icon and the archived-banner's restore/mark-deletion buttons on it, mirroring
  // CustomerDrawer's DELETE-ICON-1. The backend 403s regardless; this just hides the
  // affordance for a role that has update but not archive.
  const canArchive = hasPermission('candidates.archive')

  // Merge-duplicate overlay (punt 4) — opened from the title-row GitMerge icon.
  const [showMerge, setShowMerge] = useState(false)

  // Cross-cutting drawer state; the phase/status axis + header edit live in their hooks.
  const [recruiter,         setRecruiter]         = useState<(AppUser & { initials: string }) | null>(null)
  const [profileEditSignal, setProfileEditSignal] = useState(0)
  const [tags,              setTags]              = useState<string[] | null>(null)
  const [profileEdits,      setProfileEdits]      = useState<Record<string, unknown> | null>(null)
  const [photoUrl,          setPhotoUrl]          = useState<string | null>(null)
  // NAV-BACK-1 tab-remember: a subtab stashed by MatchesTab before a candidate→Match
  // cross-navigation, restored (once) as the initial tab when this drawer remounts
  // after browser BACK — lazy init so it's picked up on the very first render, not
  // only on a later id-change (see the file comment on peekReturnTab/clearReturnTab).
  const [rememberedTab, setRememberedTab] = useState<string | null>(() => (c?.id != null ? peekReturnTab(c.id) : null))

  // Phase/status axis (convert, requires_match/reason prompts, info line) — §0.3 hook.
  const status = useCandidateStatus({ c, onUpdate,
    onConvertIncomplete: setTab => { setTab?.('profile'); setProfileEditSignal(s => s + 1) } })
  // Header name/function edit — §0.3 hook.
  const headerEdit = useCandidateHeaderEdit(c, onUpdate)

  // Reset the local overrides when a different candidate is shown (render-time adjust).
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) {
    setPrevId(c?.id)
    setRecruiter(null); setTags(null); setProfileEdits(null); setPhotoUrl(null)
    setRememberedTab(c?.id != null ? peekReturnTab(c.id) : null)
  }
  // Consume the remembered tab once it has been used, so a later, unrelated re-open
  // of the same candidate defaults back to Profile (destructive — effect-only, see
  // the constants.ts file comment on why this can't run during render).
  useEffect(() => {
    if (rememberedTab && c?.id != null) clearReturnTab(c.id)
  }, [rememberedTab, c?.id])

  // Tenant custom-field definitions gate the Extra tab (hook must run before the early return).
  const { fields: customFieldDefs } = useCustomFields('candidate')
  if (!c) return null

  // Deep-link target (table cell click) or the NAV-BACK-1 remembered tab — parsed
  // into a { tab, sub? } pair. The sub-tab is only handed to the tab it belongs to
  // (guarded by tab id below), so e.g. a 'work:pools' target never leaks into
  // CommunicationTab; the tab component itself still validates the sub id.
  const deepLink = parseTabTarget(initialTab ?? rememberedTab)

  // Freelance (ZZP) tab shows when the candidate holds the freelance/ZZP type.
  const isFreelancer = (c.candidateTypes ?? []).some(v => ZZP_TYPE_SLUGS.includes(v))
  const tabs = TABS.filter(tab => {
    if (tab.id === 'planning')       return hasModule('plan')
    // Match tab is ALWAYS shown (2026-07-08): it holds the "+ Solliciteren" /
    // "+ Intake plannen" actions, so a Lead with no application yet still needs it.
    if (tab.id === 'administration') return isFreelancer
    // Vacatures (vacancySearch) is tenant-gated per phase + deployability status +
    // contract form (Settings → Candidate → Vacatures-tabblad) — e.g. off by
    // default for a Lead or an Unavailable candidate, but always tenant-configurable.
    if (tab.id === 'vacancySearch')  return isVacancyTabVisible(vacancyTabCfg, c, tenantPhases, tenantStatuses, tenantCandidateTypes)
    return true
  })
  // 'Extra' appears only when the tenant has ≥1 active candidate custom field (§3A(f)).
  if (customFieldDefs.length > 0) tabs.push({ id: 'extra', tKey: 'extra' })
  const currentTags = tags ?? c.tags ?? []

  const renderTabContent = (activeTab: string, setTab?: (id: string) => void) => {
    const mergedC = { ...c, ...(profileEdits ?? {}) }
    switch (activeTab) {
      case 'profile':        return <ProfilePanel c={mergedC} autoEditSignal={profileEditSignal} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }}
        // B15-flow: the contact-moment write already happened via its own endpoint —
        // merge the server's stamp into local state only, no second PATCH.
        onContactMoment={(v: Record<string, unknown>) => setProfileEdits(prev => ({ ...(prev ?? {}), ...v }))} />
      case 'background':     return <BackgroundTab c={mergedC} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }} onJump={setTab} />
      case 'work':           return <WorkTab c={c} onRefresh={() => onRefresh?.(c.id)} initialSubTab={deepLink?.tab === 'work' ? deepLink.sub : undefined} />
      case 'vacancySearch':  return <VacancySearchTab candidate={c} />
      case 'planning':       return <PlanningPanel c={c} />
      case 'preferences':    return <PreferencesTab c={c}
        onSave={(p: unknown) => {
          // RATE-WISH-1 + BANK-1: desired_rate_* and the private bank account
          // (iban / account_holder_name) are ROOT candidate fields — split them
          // out of the preferences blob so everything lands in ONE PATCH.
          const { desired_rate_min, desired_rate_max, iban, account_holder_name, bank_document_id, ...prefs } = p as Record<string, unknown>
          onUpdate?.(c.id, { preferences: { ...(c.preferences ?? {}), ...prefs },
            ...(desired_rate_min !== undefined ? { desiredRateMin: desired_rate_min } : {}),
            ...(desired_rate_max !== undefined ? { desiredRateMax: desired_rate_max } : {}),
            ...(iban !== undefined ? { iban } : {}),
            ...(account_holder_name !== undefined ? { accountHolderName: account_holder_name } : {}),
            // DOC-BANK-2: the proof-document link is a ROOT field too — it fell
            // into the preferences blob and never reached the real column
            // (Danny 24-08 "werkt nog niet"). `!== undefined` keeps explicit
            // null (unlink) flowing through.
            ...(bank_document_id !== undefined ? { bankDocumentId: bank_document_id } : {}) })
        }}
        onTypesChange={(types: string[]) => onUpdate?.(c.id, { candidateTypes: types })}
        // "Potlood op de statuswissel" (Danny 2026-07-20): reopen the status modal
        // PREFILLED to fix a sick-note reason or return date — only offered when the
        // current status actually carries one (flag-driven, see useCandidateStatus).
        onEditStatus={status.canEditStatusReason ? status.openStatusEdit : undefined} />
      case 'administration': return <ZzpTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { zzp: p })} />
      case 'communication':  return <CommunicationTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { consent: p })}
        onRefresh={onRefresh}
        onEditStatusEvent={status.canEditStatusReason ? status.openStatusEdit : undefined}
        initialSubTab={deepLink?.tab === 'communication' ? deepLink.sub : undefined} />
      // DOC-ENTRY-LINK-1: onRefresh re-pulls the whole candidate after an upload+link,
      // so a later Achtergrond-tab mount (tabs remount fresh — EntityDrawer only ever
      // renders the ACTIVE tab) shows the new document_id instead of stale props.
      case 'documents':      return <DocumentsSection c={c} onRefresh={() => onRefresh?.(c.id)} />
      // onUpdate lets the PDOK refresh push fresh lat/lng/provenance into the page
      // record (pure local merge — buildCandidatePatch maps none of those fields,
      // so patchCandidate skips the API call): no CMD+R needed (Danny 22-07).
      case 'integrations':   return <IntegrationsTab c={c} onUpdate={onUpdate} />
      case 'statistics':     return <StatisticsTab c={c} onJump={setTab} />
      // §3A(f): tenant custom fields live on their OWN gated tab (Danny 16-07,
      // punt 28 — they were buried as a section at the bottom of Profiel).
      case 'extra':          return <CustomFieldsTab entityType="candidate" values={c.customFields ?? {}}
        // Camel key: the page's optimistic merge writes it onto the row (UI shape);
        // buildCandidatePatch maps it to the API's custom_fields.
        onSave={patch => onUpdate?.(c.id, { customFields: { ...(c.customFields ?? {}), ...patch } })} />
      default:               return null
    }
  }

  // Owner picker options — a fallback entry ONLY when the current owner is not
  // in the selectable list (always prepending duplicated the owner — Danny 14/7),
  // and picking one PERSISTS (owner_id patch; it used to be local-only state).
  const ownerInitialsOf = (name?: string) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '??'
  const currentOwnerId = recruiter?.id ?? c.ownerId
  const ownerInUsers = currentOwnerId != null && users.some(u => String(u.id) === String(currentOwnerId))
  const ownerOptions = [
    ...(ownerInUsers || !c.owner ? [] : [{ value: '__current', label: recruiter?.name ?? c.owner ?? '-', initials: recruiter ? ownerInitialsOf(recruiter.name) : c.ownerInitials }]),
    ...users.map(u => ({ value: String(u.id), label: u.name, initials: ownerInitialsOf(u.name) })),
  ]
  const ownerValue = ownerInUsers ? String(currentOwnerId) : '__current'
  // Ignores the fallback '__current' entry (not a real user); otherwise records the picked owner locally for instant feedback and persists it via onUpdate.
  const onOwnerChange = (id: string | number) => {
    if (id === '__current') return
    const u = users.find(x => String(x.id) === String(id))
    if (u) { setRecruiter({ ...u, initials: ownerInitialsOf(u.name) }); onUpdate?.(c.id, { ownerId: u.id }) }
  }

  return (
    <>
    <EntityDrawer
      entity={c}
      // An explicit deep-link (table cell / funnel-chip) always wins; otherwise
      // fall back to the NAV-BACK-1 remembered tab (see rememberedTab above).
      initialTab={deepLink?.tab ?? undefined}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Creation stamp (date + author) on the left, last contact on the right —
      // its own component so this container stays wiring only.
      footer={<CandidateDrawerFooter c={c} />}
      tabs={tabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), autoExpand: tab.id === 'planning' || tab.id === 'vacancySearch', render: (setTab?: (id: string) => void) => renderTabContent(tab.id, setTab) }))}
      header={({ setActiveTab }) => (
        <EntityHeader
          // The title label IS the phase chip (Danny 19-08: it doubled with the
          // badge beside the name; for a Lead the static word was even wrong).
          // Falls back to the static entity label while no phase is known.
          label={status.currentPhase ? <PhaseChip phaseInfo={status.phaseInfo} /> : t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: photoUrl ?? c.photo, color: avatarColor, soft: true }}
          onPhotoChange={setPhotoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove'), change: t('drawer.photoChange') }}
          renderTitle={() => (
            <CandidateTitle c={c} editing={headerEdit.headerEditing} hf={headerEdit.hf} setHF={headerEdit.setHF} />
          )}
          titleActions={<>
            {/* Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — the
                candidate's own ChangelogTab supplies the content (field diffs, date
                filter, CSV export); this drawer stays the reference implementation. */}
            <ChangelogPopover><ChangelogTab c={c} bare /></ChangelogPopover>
            {/* Merge a duplicate into this record (punt 4) — same permission signal
                as archive (candidates.delete via the page); not on archived dossiers. */}
            {onMerged && !c.archived && (
              <button onClick={() => setShowMerge(true)}
                title={t('merge.title')} aria-label={t('merge.title')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen calm-header glyph control (Danny 08-08): deliberate bare 14px icon; Button iconOnly’s 28px chrome would change the frozen look
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)', opacity: 0.8 }}>
                <GitMerge size={14} />
              </button>
            )}
            {/* Soft-delete → Gearchiveerd (§3B: soft-delete only). The confirm (or, when
                live applications/matches hang on the candidate, the ArchiveGuardModal)
                lives in useCandidateDrawerActions.archiveOne — never re-confirm here.
                candidates.archive-gated (RECHTEN-DETAIL-1, was update-driven). */}
            {onArchive && canArchive && !c.archived && (
              <button onClick={() => onArchive(c.id)}
                title={t('drawer.archive')} aria-label={t('drawer.archive')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen calm-header glyph control (Danny 08-08): deliberate bare 14px icon; Button iconOnly’s 28px chrome would change the frozen look
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-danger-text)', opacity: 0.7 }}>
                <Trash2 size={14} />
              </button>
            )}
          </>}
          actions={
            <CandidateHeaderActions c={c} isEntryPhase={status.isEntryPhase} nextPhase={status.nextPhase}
              converting={status.converting} onConvert={() => status.doConvert(setActiveTab)}
              headerEditing={headerEdit.headerEditing} onStartEdit={headerEdit.startHeaderEdit}
              onSaveEdit={headerEdit.saveHeader} onCancelEdit={() => headerEdit.setHeaderEditing(false)} />
          }
          meta={[
            // Status only for a Kandidaat (not a Lead) — a Lead isn't deployable yet.
            // ARCHIVED: no status changes on an inactive dossier — restore first (2026-07-13).
            ...(status.showStatus && !c.archived ? [{ key: 'status', label: t('drawer.deployability'), value: status.currentStatus, options: status.statuses.map(s => ({ value: s.value, label: s.label })), onChange: status.changeStatus, menuWidth: 170, width: 160 }] : []),
            { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions, onChange: onOwnerChange, menuWidth: 200, width: 190 },
          ]}
          tags={{ items: currentTags, onAdd: (tag: string) => setTags([...currentTags, tag]), onRemove: (tag: string) => setTags(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Archived banner (Danny 2026-07-03): when/by whom/why + restore + hard delete.
              Restore/mark-deletion are candidates.archive-gated (RECHTEN-DETAIL-1) —
              withhold the callbacks so the banner never renders those buttons for a
              user without the permission; hard delete keeps its own admin-role gate. */}
          {c.archived && (
            <ArchivedBanner c={c} canHardDelete={canHardDelete}
              onRestore={canArchive ? onRestore : undefined}
              onMarkDeletion={canArchive ? onMarkDeletion : undefined}
              onHardDelete={onHardDelete} />
          )}
        </EntityHeader>
      )}
    />
    {/* Merge-duplicate overlay — mounts fresh per open so the focus trap attaches. */}
    {showMerge && onMerged && (
      <MergeCandidateModal
        current={{ id: c.id, name: c.name, code: (c as { code?: string }).code, email: (c as { email?: string }).email }}
        onClose={() => setShowMerge(false)}
        onMerged={id => { setShowMerge(false); onMerged(id) }}
      />
    )}
    <CandidateStatusModals
      matchPrompt={status.matchPrompt}
      onCloseMatch={() => status.setMatchPrompt(false)}
      matches={(c.matches ?? []) as { id?: string | number; vacancyTitle?: string; client?: string }[]}
      matchChoice={status.matchChoice}
      setMatchChoice={status.setMatchChoice}
      newMatchVacancyId={status.newMatchVacancyId}
      setNewMatchVacancyId={status.setNewMatchVacancyId}
      vacancyOptions={status.vacancyOptions}
      creatingMatch={status.creatingMatch}
      onConfirmMatch={status.confirmPlacedMatch}
      statusModal={status.statusModal}
      setStatusModal={status.setStatusModal}
      onConfirmStatus={status.confirmStatus}
    />
    </>
  )
}
