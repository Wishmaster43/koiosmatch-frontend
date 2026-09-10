/**
 * appointmentsTabGate — the no-permission/loading/error early-return states
 * shared by the customer and vacancy AppointmentsTab (DRY round 11, CUSTTABS2).
 * Success/empty stay with each caller's own AppointmentsList body. The
 * applications drawer's own AppointmentsTab renders a different shell (no
 * SectionCard, no !canView gate) and is not a third consumer.
 */
import type { ReactElement } from 'react'
import type { TFunction } from 'i18next'
import SectionCard from '@/components/ui/SectionCard'

// Four explicit UI states (§3): returns the early-return element for
// no-permission/loading/error, or undefined once none of those apply.
export function appointmentsTabGate({ canView, loading, error, t }: {
  canView: boolean
  loading: boolean
  error: boolean
  t: TFunction
}): ReactElement | undefined {
  if (!canView) {
    return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('appointmentsTab.noPermission')}</div></SectionCard>
  }
  if (loading) return <SectionCard><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div></SectionCard>
  if (error) return <SectionCard><div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('appointmentsTab.loadError')}</div></SectionCard>
  return undefined
}
