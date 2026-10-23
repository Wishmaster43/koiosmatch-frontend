/**
 * AuthLink — the one caption-sized primary link used on the public auth pages,
 * plus BackLink, the "back to sign-in" variant with the shared top margin.
 */
import { Link } from 'react-router-dom'
import { Caption } from '@/components/ui/typography'

// A real router link rendered in the shared caption face.
export function AuthLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to}>
      <Caption as="span" style={{ color: 'var(--color-primary-text)' }}>{label}</Caption>
    </Link>
  )
}

// Link back to the sign-in page, spaced under the page body.
export function BackLink({ label }: { label: string }) {
  return (
    <div style={{ marginTop: 24 }}>
      <AuthLink to="/login" label={label} />
    </div>
  )
}
