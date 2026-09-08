/**
 * SettingsDetailHeader — shared detail page header (back button, icon tile, title/subtitle, optional status badge and actions).
 *
 * Replaces the ~10-line duplicated header blocks in ApiKeyDetail, WebhookDetail
 * and similar settings screens. Renders: back button + icon tile + title + optional
 * subtitle + optional status badge (inline) + optional actions on the right.
 */
import type { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { PageTitle, Caption } from '@/components/ui/typography'

interface SettingsDetailHeaderProps {
  onBack: () => void
  backLabel: string
  icon: LucideIcon
  title: string
  subtitle?: string
  statusBadge?: ReactNode
  loading?: boolean
  actions?: ReactNode
}

// Header: back button + icon tile + title (+ optional subtitle) + optional status badge (inline) + optional loading spinner + optional right-hand actions.
export default function SettingsDetailHeader({
  onBack,
  backLabel,
  icon: Icon,
  title,
  subtitle,
  statusBadge,
  loading,
  actions,
}: SettingsDetailHeaderProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginBottom: subtitle ? 8 : 0, gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Button
          variant="secondary"
          onClick={onBack}
          aria-label={backLabel}
        >
          {backLabel}
        </Button>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'var(--color-primary-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} style={{ color: 'var(--color-primary-text)' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <PageTitle
            style={{
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </PageTitle>
          {subtitle && (
            <Caption style={{ margin: '2px 0 0', color: 'var(--text-muted)' }}>
              {subtitle}
            </Caption>
          )}
        </div>
        {statusBadge}
        {loading && (
          <span style={{ color: 'var(--text-muted)' }}>
            <Spinner size={13} />
          </span>
        )}
      </div>
      {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
