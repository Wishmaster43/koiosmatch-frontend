import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Unlink, ArchiveRestore } from 'lucide-react'
import { useLookups } from '@/context/LookupsContext'
import { useDateFormat } from '@/lib/datetime'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import TitleBadge from '@/components/drawer/TitleBadge'
import ApplicationChangelogPopover from './drawer/ApplicationChangelogPopover'
import ApplicationTab from './drawer/ApplicationTab'
import CandidateTab from './drawer/CandidateTab'
import VacancyTab from './drawer/VacancyTab'
import InterviewsTab from './drawer/InterviewsTab'
import AppointmentsTab from './drawer/AppointmentsTab'
import NotesTab from './drawer/NotesTab'
import Timeline from './drawer/Timeline'
import type { ApplicationDetail } from '@/types/application'
import type { RejectPayload } from './drawer/RejectionBlock'
import type { Criterion } from './drawer/MatchScoreBlock'
import type { Id } from '@/types/common'

// The tab order (matches the screenshots).
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
  users?: Array<{ id: Id; name: string }>
  onDetach?: (id: Id | undefined) => void
  onRestore?: (id: Id | undefined) => void
  canManage?: boolean
}

/**
 * ApplicationDrawer — thin container: declares the header config + tab list and
 * wires them to the shared EntityDrawer shell. No heavy JSX, no business logic.
 */
export default function ApplicationDrawer({ application: a, onClose, expanded, onToggleExpand, onReject, onAdjustScore, onPhaseChange, onOwnerChange, onLinkVacancy, users, onDetach, onRestore, canManage }: ApplicationDrawerProps) {
  const { t } = useTranslation('applications')
  const { formatDateTime } = useDateFormat()
  // Funnel phases (Settings lookup) for the header phase picker + title badge; never hardcoded.
  const { funnelTypes } = useLookups() as unknown as { funnelTypes: Array<{ value: string; label: string; color?: string }> }
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
  const meta = [
    { key: 'phase', label: t('drawer.phase'), value: a.phaseKey,
      options: funnelTypes.map(f => ({ value: f.value, label: f.label })),
      onChange: (v: string) => onPhaseChange?.(a.id, v), menuWidth: 170, width: 160 },
    { key: 'owner', label: t('drawer.owner'), value: ownerValue, options: ownerOptions,
      onChange: (v: string) => { if (v !== '__current') onOwnerChange?.(a.id, String(v)) }, menuWidth: 200, width: 190 },
  ]
  // Phase badge next to the title — colour-coded, read-only (mirrors the candidate
  // phase badge, §3A(c)). NUMMER-3: applications carry no reference_number yet
  // (ApplicationDetailResource omits it) — no ReferenceNumberChip until that lands.
  const phaseMeta = funnelTypes.find(f => f.value === a.phaseKey)

  // Map a tab id to its content component.
  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'application':  return <ApplicationTab application={a} onReject={onReject} onAdjustScore={onAdjustScore} onLinkVacancy={onLinkVacancy} />
      case 'candidate':    return <CandidateTab application={a} />
      case 'vacancy':      return <VacancyTab application={a} onLinkVacancy={onLinkVacancy} />
      case 'interviews':   return <InterviewsTab application={a} />
      case 'appointments': return <AppointmentsTab application={a} />
      case 'timeline':     return <Timeline items={a.timeline ?? []} emptyText={t('timeline.empty')} />
      case 'notes':        return <NotesTab application={a} />
      default:             return null
    }
  }

  return (
    <EntityDrawer
      entity={a}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: formatDateTime(a.created) })}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Detached → restore (primary); active → detach (danger, gated). */}
            {a.archived ? (
              <button onClick={() => onRestore?.(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 8,
                border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
                color: 'var(--color-primary)', cursor: 'pointer' }}>
                <ArchiveRestore size={12} /> {t('restore.button')}
              </button>
            ) : canManage ? (
              // No vacancy linked = nothing to detach — grey + disabled (Danny 13/7).
              <button onClick={() => a.vacancyId != null && onDetach?.(a.id)} disabled={a.vacancyId == null}
                title={a.vacancyId == null ? t('detach.nothingLinked') : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 8,
                  border: `1px solid ${a.vacancyId == null ? 'var(--border)' : 'var(--color-danger)'}`, background: 'none',
                  color: a.vacancyId == null ? 'var(--text-muted)' : 'var(--color-danger)',
                  cursor: a.vacancyId == null ? 'not-allowed' : 'pointer', opacity: a.vacancyId == null ? 0.6 : 1 }}>
                <Unlink size={12} /> {t('detach.button')}
              </button>
            ) : null}
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500,
              padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
              <FileText size={12} /> {t('drawer.downloadCv')}
            </button>
          </div>
        </div>
      )}
      tabs={TAB_IDS.map(id => ({ id, label: t(`drawer.tabs.${id}`), render: () => renderTab(id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.label')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: a.candidateInitials, soft: true }}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{a.candidateName}</span>
                {/* Phase badge — colour-coded, read-only (mirrors the candidate phase badge, §3A(c)). */}
                <TitleBadge label={phaseMeta?.label} color={phaseMeta?.color} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.vacancyTitle || '—'}</div>
            </>
          )}
          titleActions={<ApplicationChangelogPopover application={a} />}
          meta={meta}
        />
      )}
    />
  )
}
