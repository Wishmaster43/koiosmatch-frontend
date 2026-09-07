/**
 * BillingCardShell — shared card chrome (loading/error/ready states) for billing settings cards.
 * Renders the card wrapper, title, and handles the four UI states. Translations are passed by the
 * caller so each card can use its own i18n namespace.
 */
import { SectionTitle } from '@/components/ui/typography'
import { card, sub } from '../billingCardStyles'

interface BillingCardShellProps {
  phase: 'loading' | 'ready' | 'error'
  title: React.ReactNode
  subtitle?: React.ReactNode
  loadingLabel: React.ReactNode
  errorLabel: React.ReactNode
  children?: React.ReactNode
}

/**
 * Wraps billing card content with title, subtitle, and loading/error state handling.
 * Renders consistent card chrome and state messages across BillingBudgetsCard and BillingUsersCard.
 * The caller passes i18n-translated strings for labels so each card uses its own namespace.
 */
export default function BillingCardShell({
  phase, title, subtitle, loadingLabel, errorLabel, children,
}: BillingCardShellProps) {
  const isLoading = phase === 'loading'
  const isError = phase === 'error'

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{title}</SectionTitle>

      {isLoading && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loadingLabel}</p>
      )}

      {isError && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{errorLabel}</p>
      )}

      {!isLoading && !isError && (
        <>
          {subtitle && <div style={sub}>{subtitle}</div>}
          {children}
        </>
      )}
    </div>
  )
}
