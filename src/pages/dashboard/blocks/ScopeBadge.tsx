/**
 * ScopeBadge — K-173 fase 1: says HONESTLY which scope the server actually
 * queried, above the KPI row. "Mijn kandidaten" when the response narrowed to
 * the viewer's own records (`owner_dimension` set), otherwise the role label;
 * plus a calm footnote when a branch filter is active and the server folded
 * unassigned rows in (`includes_unassigned`) — "incl. {n} zonder vestiging".
 * Renders nothing without a `scope` (older server payload, never a fake badge).
 */
import { useTranslation } from 'react-i18next'
import { Caption } from '@/components/ui/typography'
import type { DashScope } from '@/types/dashboard'

export default function ScopeBadge({ scope }: { scope: DashScope | null }) {
  const { t } = useTranslation('dashboard')
  if (!scope) return null

  // "Mijn X" when the server narrowed to the viewer's own records — per
  // DIMENSION (a recruiter's scope is candidates, an accountmanager's is
  // customers; DashboardController sets owner_dimension accordingly). Otherwise
  // the role label, with an explicit membership check so an unknown
  // dashboard_type never renders a raw i18n key.
  const KNOWN_ROLES = ['admin', 'management', 'recruitment', 'recruitment_manager', 'backoffice', 'sales', 'accountmanager', 'sales_manager', 'planning', 'readonly']
  const label = scope.owner_dimension === 'candidate'
    ? t('scope.mineCandidates')
    : scope.owner_dimension === 'customer'
      ? t('scope.mineCustomers')
      : scope.owner_dimension
        ? t('scope.mine')
        : t(`types.${KNOWN_ROLES.includes(scope.role ?? '') ? scope.role : 'readonly'}`)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Caption as="span" style={{ padding: '2px 8px', borderRadius: 99, background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
        {label}
      </Caption>
      {scope.includes_unassigned && (scope.unassigned_count ?? 0) > 0 && (
        <Caption as="span">{t('scope.includesUnassigned', { count: scope.unassigned_count })}</Caption>
      )}
    </div>
  )
}
