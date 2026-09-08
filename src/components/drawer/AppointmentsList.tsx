/**
 * AppointmentsList — the shared row list of an entity drawer's Afspraken tab (vacancy and
 * customer drawers, X-38): one row per appointment (KANDIDAAT-EERST: candidate link first,
 * wall time DD-MM-YYYY HH:mm, type/modality/status chips, join button, owner, edit pencil),
 * the empty state and the page footer. The host owns the fetch, the permission gates, the
 * create flow and the edit modal; this list only renders rows and reports clicks.
 */
import { useTranslation } from 'react-i18next'
import { Calendar, ChevronLeft, ChevronRight, Video, Pencil } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import ModalityChip from '@/components/ui/ModalityChip'
import EntityLink from '@/components/ui/EntityLink'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { APPOINTMENTS_PER_PAGE } from '@/hooks/useAppointmentsPage'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'

export default function AppointmentsList({ rows, total, page, lastPage, onPageChange, emptyText, canManage, onEdit }: {
  rows: VacancyAppointmentRow[]
  total: number
  page: number
  lastPage: number
  onPageChange: (page: number) => void
  emptyText: string
  canManage: boolean
  // Edit is offered only for rows with a linked candidate (the PATCH route is candidate-scoped).
  onEdit: (row: VacancyAppointmentRow) => void
}) {
  const { t } = useTranslation('common')
  // scheduled_at is a zoneless WALL time (BUREAU-KLOK-FE-1) — never local-render it.
  const { formatWallTime } = useDateFormat()

  return (
    <>
      <SectionCard>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                <Calendar size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                    {a.scheduledAt ? formatWallTime(a.scheduledAt) : '—'}
                  </span>
                  {a.isOverdue && <SoftChip label={t('appointmentsList.overdue')} color="var(--color-danger)" size={10} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                    {a.candidateId != null
                      ? <EntityLink page="candidates" id={a.candidateId}>{a.candidateName || '—'}</EntityLink>
                      : (a.candidateName || t('appointmentsList.noCandidate'))}
                  </span>
                  {a.locationName && <Caption>{a.locationName}</Caption>}
                </div>
                {a.type && <SoftChip label={a.type} color="var(--color-primary)" />}
                {/* C.14: the modality axis, own chip — never inferred from location text alone. */}
                <ModalityChip modality={a.modality} />
                {a.status && <SoftChip label={a.status} color="var(--color-info)" />}
                {a.meetingUrl && <Button href={a.meetingUrl} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm"><Video size={13} /> {t('appointmentsList.joinMeeting')}</Button>}
                {a.ownerName && <Caption style={{ flexShrink: 0 }}>{a.ownerName}</Caption>}
                {a.candidateId != null && canManage && (
                  <Button variant="secondary" iconOnly size="sm" onClick={() => onEdit(a)} title={t('edit')} aria-label={t('edit')}>
                    <Pencil size={12} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      {total > APPOINTMENTS_PER_PAGE && (
        <Caption as="div" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <span>{t('appointmentsList.pageOf', { page, lastPage })}</span>
          <Button variant="secondary" iconOnly size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
            title={t('prevPage')} aria-label={t('prevPage')}><ChevronLeft size={13} /></Button>
          <Button variant="secondary" iconOnly size="sm" onClick={() => onPageChange(Math.min(lastPage, page + 1))} disabled={page >= lastPage}
            title={t('nextPage')} aria-label={t('nextPage')}><ChevronRight size={13} /></Button>
        </Caption>
      )}
    </>
  )
}
