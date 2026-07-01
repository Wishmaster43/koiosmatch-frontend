import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Unlink, ArchiveRestore } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
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
  onDetach?: (id: Id | undefined) => void
  onRestore?: (id: Id | undefined) => void
  canManage?: boolean
}

/**
 * ApplicationDrawer — thin container: declares the header config + tab list and
 * wires them to the shared EntityDrawer shell. No heavy JSX, no business logic.
 */
export default function ApplicationDrawer({ application: a, onClose, expanded, onToggleExpand, onReject, onAdjustScore, onDetach, onRestore, canManage }: ApplicationDrawerProps) {
  const { t } = useTranslation('applications')
  if (!a) return null

  // Map a tab id to its content component.
  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'application':  return <ApplicationTab application={a} onReject={onReject} onAdjustScore={onAdjustScore} />
      case 'candidate':    return <CandidateTab application={a} />
      case 'vacancy':      return <VacancyTab application={a} />
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
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: a.created || '—' })}</span>
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
              <button onClick={() => onDetach?.(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 8,
                border: '1px solid var(--color-danger)', background: 'none',
                color: 'var(--color-danger)', cursor: 'pointer' }}>
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
          title={a.candidateName}
          subtitle={a.vacancyTitle}
        />
      )}
    />
  )
}
