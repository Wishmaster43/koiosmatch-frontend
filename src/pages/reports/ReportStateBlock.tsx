/**
 * ReportStateBlock — the ONE loading/error/empty renderer for every report page.
 * Before this, 17 report files each hand-typed their own `state` style object and
 * a bare centred `<div>` per state (some with a retry affordance, most without) —
 * four visibly different patterns across the same navigation list. This component
 * is the single source: same placement (inside the page's own outer card), same
 * icon+message shape, and — on error — the same retry button wired to the report's
 * own `refetch`. Callers still pass their own i18n message per report (the copy
 * differs by report, the STRUCTURE never does).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Inbox } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

// One centred layout shared by all three non-success states; only icon/color/message differ.
function StateRow({ icon, color, message, action }: { icon: ReactNode; color: string; message: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 40, textAlign: 'center' }}>
      <div style={{ color }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{message}</div>
      {action}
    </div>
  )
}

// Renders exactly one of loading/error/empty; renders nothing (success) when none apply.
export default function ReportStateBlock({ loading, error, empty, loadingLabel, errorLabel, emptyLabel, onRetry }: {
  loading: boolean
  error: boolean
  empty: boolean
  loadingLabel: string
  errorLabel: string
  emptyLabel: string
  onRetry?: () => void
}) {
  const { t } = useTranslation('common')
  if (loading) {
    return <StateRow icon={<Spinner size={20} />} color="var(--text-muted)" message={loadingLabel} />
  }
  if (error) {
    return (
      <StateRow
        icon={<AlertTriangle size={20} />}
        color="var(--color-danger)"
        message={errorLabel}
        action={onRetry ? (
          <Button variant="secondary"
            onClick={onRetry}
            style={{ marginTop: 4 }}
          >
            {t('error.retry')}
          </Button>
        ) : undefined}
      />
    )
  }
  if (empty) {
    return <StateRow icon={<Inbox size={20} />} color="var(--text-muted)" message={emptyLabel} />
  }
  return null
}
