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
import { useDateFormat } from '@/lib/datetime'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import EntityDrawerJs from '@/components/drawer/EntityDrawer'
import EntityHeaderJs from '@/components/drawer/EntityHeader'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import GeocodeButton from '@/components/ui/GeocodeButton'
import { useGenders } from '@/lib/useGenders'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useAuth } from '@/context/AuthContext'
import { useCandidateStatus } from './hooks/useCandidateStatus'
import { useCandidateHeaderEdit } from './hooks/useCandidateHeaderEdit'
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
import ChangelogPopover from './drawer/ChangelogPopover'
import MergeCandidateModal from './drawer/MergeCandidateModal'
import CandidateStatusModals from './drawer/CandidateStatusModals'
import { CandidateTitle, CandidateHeaderActions, ArchivedBanner } from './drawer/CandidateHeaderBits'
import { peekReturnTab, clearReturnTab } from './drawer/constants'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Still-untyped JS drawer shells — declare the props this drawer passes (typed boundary).
const EntityDrawer = EntityDrawerJs as ComponentType<{
  entity: unknown; expanded?: boolean; onToggleExpand?: () => void; footer?: ReactNode; initialTab?: string
  tabs?: Array<{ id: string; label: string; autoExpand?: boolean; render: () => ReactNode }>
  header?: (arg: { activeTab?: string; setActiveTab: (id: string) => void }) => ReactNode
}>
const EntityHeader = EntityHeaderJs as ComponentType<{
  label?: string; expanded?: boolean; onToggleExpand?: () => void; onClose?: () => void
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
  users?: AppUser[]
  // Deep-link: open on this tab (table contact-cell → communication, funnel-chip → work).
  initialTab?: string
}

export default function CandidateDrawer({ candidate: c, onClose, expanded, onToggleExpand, onUpdate, onArchive, onMarkDeletion, onRestore, onHardDelete, onMerged, users = [], initialTab }: CandidateDrawerProps) {
  const { t } = useTranslation('candidates')
  const { formatDate, formatDateTime } = useDateFormat() as { formatDate: (d?: string | null, opts?: Intl.DateTimeFormatOptions) => string; formatDateTime: (d?: string | null) => string }
  const { labelOf: lastContactLabel } = useLastContactTypes()
  const { colorOf: genderColor } = useGenders() as { colorOf: (g?: string) => string | undefined }
  // Avatar colour follows the same tenant setting as the table: neutral grey by
  // default, per-gender only when enabled (Settings → Candidate → Table display).
  const allSettings = useAllSettings()
  const coloredByGender = getBoolSetting(allSettings, 'candidate_avatar_colored_by_gender', false)
  const avatarColor = coloredByGender ? (genderColor(c?.gender) ?? NEUTRAL_AVATAR) : NEUTRAL_AVATAR
  const { hasModule, isSuperAdmin, hasRole } = useAuth() as unknown as { hasModule: (m: string) => boolean; isSuperAdmin: () => boolean; hasRole: (r: string) => boolean }
  // Hard delete is admin-only (Danny 2026-07-03) — the backend re-checks (§7: UI gating is UX).
  const canHardDelete = isSuperAdmin() || hasRole('admin')

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

  // Freelance (ZZP) tab shows when the candidate holds the freelance/ZZP type.
  const isFreelancer = (c.candidateTypes ?? []).some(v => ZZP_TYPE_SLUGS.includes(v))
  const tabs = TABS.filter(tab => {
    if (tab.id === 'planning')       return hasModule('plan')
    // Match tab is ALWAYS shown (2026-07-08): it holds the "+ Solliciteren" /
    // "+ Intake plannen" actions, so a Lead with no application yet still needs it.
    if (tab.id === 'administration') return isFreelancer
    return true
  })
  // 'Extra' appears only when the tenant has ≥1 active candidate custom field (§3A(f)).
  if (customFieldDefs.length > 0) tabs.push({ id: 'extra', tKey: 'extra' })
  const currentTags = tags ?? c.tags ?? []

  const renderTabContent = (activeTab: string, setTab?: (id: string) => void) => {
    const mergedC = { ...c, ...(profileEdits ?? {}) }
    switch (activeTab) {
      case 'profile':        return <ProfilePanel c={mergedC} autoEditSignal={profileEditSignal} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }} />
      case 'background':     return <BackgroundTab c={mergedC} onEditSave={(v: Record<string, unknown>) => { setProfileEdits(v); onUpdate?.(c.id, v) }} />
      case 'work':           return <WorkTab c={c} />
      case 'vacancySearch':  return <VacancySearchTab candidate={c} />
      case 'planning':       return <PlanningPanel c={c} />
      case 'preferences':    return <PreferencesTab c={c}
        onSave={(p: unknown) => {
          // RATE-WISH-1: desired_rate_* are ROOT candidate fields — split them out of
          // the preferences blob so everything lands in ONE PATCH.
          const { desired_rate_min, desired_rate_max, ...prefs } = p as Record<string, unknown>
          onUpdate?.(c.id, { preferences: { ...(c.preferences ?? {}), ...prefs },
            ...(desired_rate_min !== undefined ? { desiredRateMin: desired_rate_min } : {}),
            ...(desired_rate_max !== undefined ? { desiredRateMax: desired_rate_max } : {}) })
        }}
        onTypesChange={(types: string[]) => onUpdate?.(c.id, { candidateTypes: types })}
        // "Potlood op de statuswissel" (Danny 2026-07-20): reopen the status modal
        // PREFILLED to fix a sick-note reason or return date — only offered when the
        // current status actually carries one (flag-driven, see useCandidateStatus).
        onEditStatus={status.canEditStatusReason ? status.openStatusEdit : undefined} />
      case 'administration': return <ZzpTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { zzp: p })} />
      case 'communication':  return <CommunicationTab c={c} onSave={(p: unknown) => onUpdate?.(c.id, { consent: p })}
        onEditStatusEvent={status.canEditStatusReason ? status.openStatusEdit : undefined} />
      case 'documents':      return <DocumentsSection c={c} />
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
      initialTab={initialTab ?? rememberedTab ?? undefined}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={
        // Created-at on the left, last-contact (date · channel) on the right.
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(c.created) })}</span>
          <span>
            {t('drawer.lastContact')}:{' '}
            {(c.lastContactDate || c.lastContactType) ? (
              <span style={{ color: 'var(--text)' }}>
                {c.lastContactDate && formatDate(c.lastContactDate)}
                {c.lastContactDate && c.lastContactType && ' · '}
                {c.lastContactType && lastContactLabel(c.lastContactType)}
                {c.lastContactBy && <> · {t('drawer.byWho', { name: c.lastContactBy })}</>}
              </span>
            ) : (
              <span style={{ fontStyle: 'italic' }}>{t('drawer.notRegistered')}</span>
            )}
          </span>
        </div>
      }
      tabs={tabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), autoExpand: tab.id === 'planning', render: (setTab?: (id: string) => void) => renderTabContent(tab.id, setTab) }))}
      header={({ setActiveTab }) => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: photoUrl ?? c.photo, color: avatarColor, soft: true }}
          onPhotoChange={setPhotoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
          renderTitle={() => (
            <CandidateTitle c={c} editing={headerEdit.headerEditing} hf={headerEdit.hf} setHF={headerEdit.setHF}
              phaseInfo={status.phaseInfo} showPhase={!!status.currentPhase} />
          )}
          titleActions={<>
            <ChangelogPopover c={c} />
            {/* GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" — queued + async, never
                claims "done" (see GeocodeButton). Disabled when there's no address at
                all yet (nothing meaningful to geocode). */}
            <GeocodeButton endpoint={`/candidates/${c.id}/geocode`} permission="candidates.update"
              disabled={!c.city && !c.street && !c.postalCode} />
            {/* Merge a duplicate into this record (punt 4) — same permission signal
                as archive (candidates.delete via the page); not on archived dossiers. */}
            {onMerged && !c.archived && (
              <button onClick={() => setShowMerge(true)}
                title={t('merge.title')} aria-label={t('merge.title')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)', opacity: 0.8 }}>
                <GitMerge size={14} />
              </button>
            )}
            {/* Soft-delete → Gearchiveerd (§3B: soft-delete only). The confirm (or, when
                live applications/matches hang on the candidate, the ArchiveGuardModal)
                lives in useCandidateDrawerActions.archiveOne — never re-confirm here. */}
            {onArchive && !c.archived && (
              <button onClick={() => onArchive(c.id)}
                title={t('drawer.archive')} aria-label={t('drawer.archive')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-danger)', opacity: 0.7 }}>
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
          {/* Archived banner (Danny 2026-07-03): when/by whom/why + restore + hard delete. */}
          {c.archived && (
            <ArchivedBanner c={c} canHardDelete={canHardDelete}
              onRestore={onRestore} onMarkDeletion={onMarkDeletion} onHardDelete={onHardDelete} />
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
