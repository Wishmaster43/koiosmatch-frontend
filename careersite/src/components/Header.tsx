import { Link } from 'react-router-dom'
import type { SiteInfo } from '../types'
import { strings } from '../strings'

interface HeaderProps {
  site: SiteInfo | null
  loading: boolean
  tenant: string
}

// Branded header: shows the tenant logo + name once loaded, a calm placeholder
// while loading, and links back to the vacancy list. Never blocks rendering on
// the logo — a missing logo_url just shows the name as a text logotype.
export function Header({ site, loading, tenant }: HeaderProps) {
  return (
    <header className="site-header">
      <Link to={`/${tenant}/vacatures`} className="site-header__brand" aria-label={site?.name ?? strings.header.fallbackName}>
        {/* Logo OR text name — never both: most tenant logos are wordmarks, so
            logo + text rendered the name twice (Danny 23-07: "Yesway 2x"). */}
        {site?.logo_url ? (
          <img src={site.logo_url} alt={site?.name ?? strings.header.fallbackName} className="site-header__logo" />
        ) : (
          <span className="site-header__name">
            {loading ? ' ' : (site?.name ?? strings.header.fallbackName)}
          </span>
        )}
      </Link>
    </header>
  )
}
