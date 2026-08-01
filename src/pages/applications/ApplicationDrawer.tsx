import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Unlink, ArchiveRestore, Edit2, Save, Send, X, XCircle } from 'lucide-react'
import { useLookups } from '@/context/LookupsContext'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './drawer/ChangelogTab'
import ApplicationHeaderTitle from './drawer/ApplicationHeaderTitle'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import ApplicationTab from './drawer/ApplicationTab'
import CandidateTab from './drawer/CandidateTab'
import VacancyTab from './drawer/VacancyTab'
import InterviewsTab from './drawer/InterviewsTab'
import AppointmentsTab from './drawer/AppointmentsTab'
import NotesTab from './drawer/NotesTab'
import Timeline from './drawer/Timeline'
import DetachReasonModal from './drawer/DetachReasonModal'
import RejectionModal from './drawer/RejectionModal'
import ProposeCandidateModal from './drawer/propose/ProposeCandidateModal'
import { peekReturnTab, clearReturnTab } from './drawer/constants'
import { useApplicationCandidateEdit } from './hooks/useApplicationCandidateEdit'
import { BTN_H } from '@/config/buttonMetrics'
import type { ApplicationDetail } from '@/types/application'
import type { RejectPayload } from './drawer/RejectionModal'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { Id } from '@/types/common'

// Icon-button metrics for the header's edit/save/cancel toggles — same 28x28
// footprint as CandidateHeaderBits' iconBtn (§4 consistency), kept local since
// that constant isn't exported from the (out-of-scope) candidate file.
const iconBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0 } as const

// The tab order (matches the screenshots). 'extra' (§3A(f)) is appended below
// only when the tenant has ≥1 active application custom field.
const TAB_IDS = ['application', 'candidate', 'vacancy', 'interviews', 'appointments', 'timeline', 'notes']

interface ApplicationDrawerProps {
  application: ApplicationDetail | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onReject?: (id: Id | undefined, payload: RejectPayload) => void
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
  onPhaseChange?: (id: Id | undefined, phaseKey: string) => void
  onOwnerChange?: (id: Id | undefined, ownerId: string) => void
  // Re-link (or unlink, null) the vacancy this application is coupled to — shared
  // by the Sollicitatie tab's Details block and the Vacature tab (§3A).
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
  // S7: PATCH the editable Bron field from the Sollicitatie tab's Details block.
  onUpdateSource?: (id: Id | undefined, source: string) => void
  users?: Array<{ id: Id; name: string }>
  // S15: detaching REQUIRES a reason (BE 422s without one) — the drawer collects
  // it via DetachReasonModal before calling this.
  onDetach?: (id: Id | undefined, reason: string) => void
  onRestore?: (id: Id | undefined) => void
  canManage?: boolean
  // Save the Extra tab's tenant custom fields (§3B) — a partial patch, merged by the caller.
  onUpdateCustomFields?: (id: Id | undefined, patch: Record<string, unknown>) => void
  // Deep-link: open on this tab (mirrors CandidateDrawer's own prop, currently unused
  // by any caller — kept for parity/future deep-links; the return-tab memory below
  // covers the NAV-BACK-1 case this drawer actually needs today).
  initialTab?: string
  // Danny 2026-07-25: header pencil edits the CANDIDATE's name/function from the
  // application drill-down — reported so the page can merge the rename across
  // every application row sharing this candidate (see useApplicationCandidateEdit).
  onCandidateUpdated?: (candidateId: Id, patch: { candidateName: string; candidateFunction: string }) => void
}

/**
 * ApplicationDrawer — thin container: declares the header config + tab list and
 * wires them to the shared EntityDrawer shell. No heavy JSX, no business logic.
 */
export default function ApplicationDrawer({ application: a, onClose, expanded, onToggleExpand, onReject, onAdjustScore, onPhaseChange, onOwnerChange, onLinkVacancy, onUpdateSource, users, onDetach, onRestore, canManage, onUpdateCustomFields, initialTab, onCandidateUpdated }: ApplicationDrawerProps) {
  const { t } = useTranslation('applications')
  const { formatDate, formatDateTime } = useDateFormat()
  // S15: the reason-required detach confirm modal (footer "Ontkoppelen").
  const [detachModalOpen, setDetachModalOpen] = useState(false)
  // APP-REJECT-GUARD-1: the reject confirm modal — opened either from the
  // footer "Afwijzen" button or from the phase picker when the picked phase
  // IS the flagged is_rejected stage (a bare phase PATCH bypasses the required
  // reason, see the meta.phase onChange below).
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  // Danny 25-07: "propose to customer" — the CV-in-house-style + optional
  // motivation letter flow, gated below on canManage + a linked candidate/customer.
  const [proposeModalOpen, setProposeModalOpen] = useState(false)
  // Funnel phases (Settings lookup) for the header phase picker; never hardcoded.
  const { funnelTypes } = useLookups() as unknown as { funnelTypes: Array<{ value: string; label: string; color?: string; is_rejected?: boolean }> }
  // The Extra tab only shows when the tenant has defined application custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('application')
  // NAV-BACK-1 tab-remember: a subtab stashed by CandidateTab/VacancyTab (or the
  // Sollicitatie tab's own vacancy link) before a cross-navigation away from this
  // drawer, restored (once) as the initial tab when the drawer remounts after
  // browser BACK. The parent (ApplicationsPage) remounts this component via a
  // `key={selected?.id}` on every application change, so a lazy init is enough —
  // no CandidateDrawer-style prevId tracking needed here.
  const [rememberedTab] = useState<string | null>(() => (a?.id != null ? peekReturnTab(a.id) : null))
  // Consume the remembered tab once it has been used, so a later, unrelated
  // re-open of the same application defaults back to Sollicitatie (destructive —
  // effect-only, see the constants.ts file comment on why).
  useEffect(() => {
    if (rememberedTab && a?.id != null) clearReturnTab(a.id)
  }, [rememberedTab, a?.id])
  // Header candidate-edit state (name + function) — called unconditionally
  // (before the early return below), same rule as every other hook here.
  const candidateEdit = useApplicationCandidateEdit(a?.candidateId ?? null, onCandidateUpdated)
  if (!a) return null

  // Header meta pickers — phase (funnel lookup) + recruiter (tenant users). The
  // owner is matched by id; a fallback option covers an owner not in the list.
  const ownerInUsers = (users ?? []).some(u => String(u.id) === String(a.owner?.id))
  const ownerOptions = [
    ...(a.owner?.id != null && ownerInUsers ? [] : [{ value: '__current', label: a.owner?.name || t('insights.noOwner') }]),
    ...(users ?? []).map(u => ({ value: String(u.id), label: u.name })),
  ]
  const ownerValue = a.owner?.id != null && ownerInUsers ? String(a.owner.id) : '__current'
  // Standard picker widths (§3A blueprint: Status/Phase ~160 + Eigenaar ~190).
  // APP-REJECT-GUARD-1: the funnel stage flagged is_rejected — never the literal
  // 'rejected' key, a tenant may rename it. Picking it from the header requires
  // a reason, so it opens the modal instead of PATCHing the phase directly.
  const rejectedFunnelValue = funnelTypes.find(f => f.is_rejected)?.value
  const meta = [
    { key: 'phase', label: t('drawer.phase'), value: a.phaseKey,
      options: funnelTypes.map(f => ({ value: f.value, label: f.label })),
      onChange: (v: string) => { if (v === rejectedFunnelValue) setRejectModalOpen(true); else onPhaseChange?.(a.id, v) },
      menuWidth: 170, width: 160 },
    { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions,
      onChange: (v: string) => { if (v !== '__current') onOwnerChange?.(a.id, String(v)) }, menuWidth: 200, width: 190 },
  ]
  // Gate for the "Voorstellen aan klant" header action (Danny 25-07): needs both
  // a candidate and a customer to propose to, and is pointless once archived or
  // already rejected.
  const canPropose = canManage && a.candidateId != null && a.customerId != null && !a.archived && a.bucket !== 'rejected'

  // Map a tab id to its content component.
  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'application':  return <ApplicationTab application={a} onAdjustScore={onAdjustScore} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />
      case 'candidate':    return <CandidateTab application={a} />
      case 'vacancy':      return <VacancyTab application={a} onLinkVacancy={onLinkVacancy} />
      case 'interviews':   return <InterviewsTab application={a} />
      case 'appointments': return <AppointmentsTab application={a} />
      // Tijdlijn TAB (real lifecycle activity: funnel transitions, appointments,
      // notes, AI-interviews — ApplicationTimeline on the backend) is intentionally
      // distinct from the changelog ICON in the title row (raw field-change audit,
      // the shared ChangelogPopover) — §3A(d): tab = activiteit, icon = veldwijzigingen.
      case 'timeline':     return <Timeline items={a.timeline ?? []} emptyText={t('timeline.empty')} />
      case 'notes':        return <NotesTab application={a} />
      case 'extra':        return <CustomFieldsTab entityType="application" values={a.customFields ?? {}}
                              onSave={patch => onUpdateCustomFields?.(a.id, patch)} />
      default:             return null
    }
  }
  const tabIds = customFieldDefs.length > 0 ? [...TAB_IDS, 'extra'] : TAB_IDS

  return (
    <>
    <EntityDrawer
      entity={a}
      // An explicit deep-link always wins; otherwise fall back to the NAV-BACK-1
      // remembered tab (see rememberedTab above).
      initialTab={initialTab ?? rememberedTab ?? undefined}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: formatDateTime(a.created) })}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Detached → restore (primary); active → detach (danger, gated).
                BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            {a.archived ? (
              <button onClick={() => onRestore?.(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500, height: BTN_H, padding: '0 12px', borderRadius: 8,
                border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
                color: 'var(--color-primary)', cursor: 'pointer' }}>
                <ArchiveRestore size={12} /> {t('restore.button')}
              </button>
            ) : canManage ? (
              <>
              {/* Afwijzen (Danny 25-07): the reject FORM moved out of the tab into
                  this footer button + confirm modal — hidden once already rejected
                  or matched (a match can no longer be rejected). */}
              {a.bucket !== 'rejected' && a.bucket !== 'matched' && (
                <button onClick={() => setRejectModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500, height: BTN_H, padding: '0 12px', borderRadius: 8,
                    border: '1px solid var(--color-danger)', background: 'none',
                    color: 'var(--color-danger)', cursor: 'pointer' }}>
                  <XCircle size={12} /> {t('rejection.action')}
                </button>
              )}
              {/* No vacancy linked = nothing to detach — grey + disabled (Danny 13/7).
                  S15: opens the reason-required confirm modal instead of detaching
                  straight away (the BE 422s a bare DELETE now). */}
              <button onClick={() => a.vacancyId != null && setDetachModalOpen(true)} disabled={a.vacancyId == null}
                title={a.vacancyId == null ? t('detach.nothingLinked') : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 500, height: BTN_H, padding: '0 12px', borderRadius: 8,
                  border: `1px solid ${a.vacancyId == null ? 'var(--border)' : 'var(--color-danger)'}`, background: 'none',
                  color: a.vacancyId == null ? 'var(--text-muted)' : 'var(--color-danger)',
                  cursor: a.vacancyId == null ? 'not-allowed' : 'pointer', opacity: a.vacancyId == null ? 0.6 : 1 }}>
                <Unlink size={12} /> {t('detach.button')}
              </button>
              </>
            ) : null}
          </div>
        </div>
      )}
      tabs={tabIds.map(id => ({ id, label: t(`drawer.tabs.${id}`), render: () => renderTab(id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.label')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: a.candidateInitials, soft: true }}
          renderTitle={() => (
            // S4/S21 (Danny): no phase/outcome badge here — it duplicated the Fase
            // meta picker below and was flagged repeatedly ("kerstboom", "ACTIEF???").
            // Danny 2026-07-25: the candidate's name + function are now editable from
            // here (pencil in the header actions), mirroring the candidate drawer.
            <ApplicationHeaderTitle
              candidateName={a.candidateName} referenceNumber={a.referenceNumber}
              candidateFunction={a.candidate?.function ?? ''} vacancyTitle={a.vacancyTitle}
              editing={candidateEdit.editing} loading={candidateEdit.loading}
              form={candidateEdit.form} setField={candidateEdit.setField}
            />
          )}
          // Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — was a
          // cramped 360px dropdown with no focus trap; now the same 900px centred
          // panel as the candidate drawer.
          titleActions={<ChangelogPopover><ChangelogTab application={a} /></ChangelogPopover>}
          actions={canManage && a.candidateId != null ? (
            <>
              {/* "Voorstellen aan klant" — prepares the house-style CV + a drafted
                  message and records it (no send capability yet, see the modal's
                  own honest line). Outline style: sits next to the filled Save
                  pencil toggle without competing for attention (§4 calm header). */}
              {canPropose && (
                <button type="button" onClick={() => setProposeModalOpen(true)}
                  title={t('propose.trigger')} aria-label={t('propose.trigger')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, height: BTN_H, padding: '0 10px',
                    fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer',
                    border: '1px solid var(--color-primary)', background: 'none', color: 'var(--color-primary)' }}>
                  <Send size={12} /> {t('propose.trigger')}
                </button>
              )}
              {candidateEdit.editing ? (
                <>
                  {/* Save (diskette) + cancel (✕) — same 28x28 icon-button pair as the
                      candidate drawer's CandidateHeaderActions edit toggle (§4). */}
                  <button type="button" onClick={() => candidateEdit.saveEdit()} disabled={candidateEdit.saving}
                    title={t('common:save')} aria-label={t('common:save')}
                    style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none',
                      opacity: candidateEdit.saving ? 0.7 : 1, cursor: candidateEdit.saving ? 'not-allowed' : 'pointer' }}>
                    <Save size={14} />
                  </button>
                  <button type="button" onClick={candidateEdit.cancelEdit}
                    title={t('common:cancel')} aria-label={t('common:cancel')}
                    style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                // Idle → pencil. Gated on canManage AND a real candidateId (§3: no
                // fake affordance when there is no honest edit target).
                <button type="button" onClick={candidateEdit.startEdit}
                  title={t('drawer.editCandidate')} aria-label={t('drawer.editCandidate')}
                  style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  <Edit2 size={13} />
                </button>
              )}
            </>
          ) : undefined}
          meta={meta}
        >
          {/* APP-DELETED-AT-1: the in-body archived banner, now the ONE shared
              components/drawer/ArchivedBanner (§3A — extend, never duplicate); the
              existing archived.since/flag + restore.button i18n keys are unchanged. */}
          {a.archived && (
            <ArchivedBanner id={a.id} onRestore={onRestore}
              message={a.deletedAt ? t('archived.since', { date: formatDate(a.deletedAt) }) : t('archived.flag')}
              restoreLabel={t('restore.button')} />
          )}
        </EntityHeader>
      )}
    />
    {/* S15: the reason-required detach confirm — a small modal, not a native
        confirm(), since it collects the free-text reason the BE now requires. */}
    {detachModalOpen && (
      <DetachReasonModal
        onCancel={() => setDetachModalOpen(false)}
        onConfirm={reason => { setDetachModalOpen(false); onDetach?.(a.id, reason) }}
      />
    )}
    {/* Danny 25-07: the reject FORM — a footer button + confirm modal, mirroring
        the detach flow above, opened either from "Afwijzen" or from the phase
        picker (see meta.phase onChange). */}
    {rejectModalOpen && (
      <RejectionModal
        application={a}
        onCancel={() => setRejectModalOpen(false)}
        onConfirm={payload => { setRejectModalOpen(false); onReject?.(a.id, payload) }}
      />
    )}
    {/* Danny 25-07: propose-to-customer — CV in house style + optional motivation
        letter, mounted only while open (mirrors the detach/reject modals above). */}
    {proposeModalOpen && (
      <ProposeCandidateModal application={a} onClose={() => setProposeModalOpen(false)} />
    )}
    </>
  )
}
