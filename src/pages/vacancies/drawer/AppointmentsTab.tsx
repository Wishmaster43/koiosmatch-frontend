import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import EntityLink from '@/components/ui/EntityLink'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useVacancyAppointments, VACANCY_APPOINTMENTS_PER_PAGE } from '../hooks/useVacancyAppointments'
// HUISSTIJL-1: the meta text (11px/muted) is the shared Caption atom.
import { Caption } from '@/components/ui/typography'
import type { VacancyDetail } from '@/types/vacancy'

/**
 * AppointmentsTab (AFSPRAKEN-VACATURE-1) — every appointment tied to this
 * vacancy across ALL candidates, newest-first as the backend already orders
 * them. Read-only (an appointment is scheduled from the candidate side, via
 * PlanIntakeModal — this tab is the vacancy's own view of that same data, it
 * never creates/edits). Server-paginated: GET /vacancies/{id}/appointments
 * (gated on vacancies.view, same permission the drawer itself needs to open).
 * Mirrors MatchesTab's anatomy (§3A: extend, never fork a new tab shape).
 */
export default function AppointmentsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const auth = useAuth()
  const { formatDateTime } = useDateFormat()
  const [page, setPage] = useState(1)

  // UI-side mirror of the backend's own permission:vacancies.view gate — the
  // server re-checks, this only avoids firing a request the user will 403 on.
  const canView = auth?.hasPermission?.('vacancies.view') ?? false

  const { rows, total, lastPage, loading, error } = useVacancyAppointments(canView ? v.id : undefined, page)

  if (!canView) {
    return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('appointmentsTab.noPermission')}</div></SectionCard>
  }
  // Four explicit UI states (§3): loading / error / empty / success.
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('appointmentsTab.loadError')}</div></SectionCard>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionCard>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('appointmentsTab.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                <Calendar size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                    {a.scheduledAt ? formatDateTime(a.scheduledAt) : '—'}
                  </span>
                  {a.isOverdue && <SoftChip label={t('appointmentsTab.overdue')} color="var(--color-danger)" size={10} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                    {a.candidateId != null
                      ? <EntityLink page="candidates" id={a.candidateId}>{a.candidateName || '—'}</EntityLink>
                      : (a.candidateName || t('appointmentsTab.noCandidate'))}
                  </span>
                  {a.locationName && <Caption>{a.locationName}</Caption>}
                </div>
                {a.type && <SoftChip label={a.type} color="var(--color-primary)" />}
                {a.status && <SoftChip label={a.status} color="var(--color-info)" />}
                {a.ownerName && <Caption style={{ flexShrink: 0 }}>{a.ownerName}</Caption>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      {total > VACANCY_APPOINTMENTS_PER_PAGE && (
        <Caption as="div" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <span>{t('appointmentsTab.pageOf', { page, lastPage })}</span>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? 'var(--border)' : 'var(--text-muted)' }}>‹</button>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page >= lastPage ? 'default' : 'pointer', color: page >= lastPage ? 'var(--border)' : 'var(--text-muted)' }}>›</button>
        </Caption>
      )}
    </div>
  )
}
