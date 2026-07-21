import type { ReactNode, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { useNavigation } from '@/context/NavigationContext'
import type { Id } from '@/types/common'

/**
 * The same-origin hash deep link to a record's own page + drawer (the
 * NAV-BACK-1 URL contract the drawer-URL hook restores from). Shared by
 * EntityLink's own trailing icon AND every explicit "Open X" affordance
 * (candidate/vacancy/match "Open …" links) so the link shape lives in one
 * place instead of being re-derived per caller.
 */
export function buildEntityDeepLink(page: string, id: Id): string {
  return `${window.location.pathname}#${page}?open=${encodeURIComponent(String(id))}`
}

/**
 * EntityLink — a clickable reference to a linked record (candidate, vacancy,
 * customer, application). Clicking the NAME opens that entity's page + drawer
 * in-app via the navigation context; clicking the trailing ICON opens the same
 * record in a NEW BROWSER TAB via its deep link (#page?open=id — the NAV-BACK-1
 * URL contract), per Danny's punt 16 (16-07): "drukken op icon = nieuw tabblad,
 * drukken op de naam = het item". Renders plain text when there is no target id.
 */
export default function EntityLink({ page, id, children, title, hideIcon = false }: { page: string; id?: Id | null; children: ReactNode; title?: string; hideIcon?: boolean }) {
  const { t } = useTranslation('common')
  const { openEntity } = useNavigation()
  if (id == null) return <>{children}</>
  // Deep link to this record: same-origin hash route the drawer-URL hook restores.
  const deepLink = buildEntityDeepLink(page, id)
  const stopThenAllow = (e: MouseEvent) => e.stopPropagation() // anchor default (new tab) proceeds
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}>
      <button type="button" title={title} onClick={() => openEntity(page, id)}
        style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', textAlign: 'left',
          color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'none',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
        onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
        {children}
      </button>
      {!hideIcon && (
        <a href={deepLink} target="_blank" rel="noopener noreferrer" onClick={stopThenAllow}
          title={t('openInNewTab')} aria-label={t('openInNewTab')}
          style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--text-muted)', opacity: 0.65 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.65' }}>
          <ExternalLink size={12} />
        </a>
      )}
    </span>
  )
}
