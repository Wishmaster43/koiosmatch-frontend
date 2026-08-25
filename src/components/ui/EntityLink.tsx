/**
 * EntityLink — a clickable reference to a linked record (candidate, vacancy,
 * customer, application). Two independent affordances live side by side: the
 * NAME opens the record in-app, the trailing ICON opens it in a new browser
 * tab via its deep link — see the two docblocks below for the full contract.
 */
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
// eslint-disable-next-line react-refresh/only-export-components -- the ONE deep-link builder every "Open X" affordance shares (see docblock); HMR-nicety warning only
export function buildEntityDeepLink(page: string, id: Id): string {
  return `${window.location.pathname}#${page}?open=${encodeURIComponent(String(id))}`
}

/**
 * EntityLink — a clickable reference to a linked record (candidate, vacancy,
 * customer, application). Clicking the NAME opens that entity's page + drawer
 * in-app via the navigation context; clicking the trailing ICON opens the same
 * record in a NEW BROWSER TAB via its deep link (#page?open=id — the NAV-BACK-1
 * URL contract), per Danny's point 16 (16-07), verbatim: "…icon = nieuw
 * tabblad…naam = het item" (i.e. "click the icon = new tab, click the name =
 * the item"). Renders plain text when there is no target id.
 */
export default function EntityLink({ page, id, children, title, hideIcon = false, tone = 'accent' }: { page: string; id?: Id | null; children: ReactNode; title?: string; hideIcon?: boolean; tone?: 'accent' | 'neutral' }) {
  const { t } = useTranslation('common')
  const { openEntity } = useNavigation()
  // No target id (e.g. a lead without a candidate record): plain text, but KEEP
  // the truncation contract the linked form carries — a bare fragment let long
  // names overflow their row (Opus r3).
  if (id == null) {
    return (
      <span style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    )
  }
  // Deep link to this record: same-origin hash route the drawer-URL hook restores.
  const deepLink = buildEntityDeepLink(page, id)
  const stopThenAllow = (e: MouseEvent) => e.stopPropagation() // anchor default (new tab) proceeds
  // EntityLink's own canonical renders: the name is an unstyled-text BUTTON (it
  // acts in-app), the icon is a true LINK (it navigates to a new tab) — neither
  // is a button-lookalike copy, so both carry a block-form exception (the flagged
  // style attributes sit lines into their opening tags).
  /* eslint-disable huisstijlLegacy/no-restricted-syntax */
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}>
      <button type="button" title={title} onClick={() => openEntity(page, id)}
        style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', textAlign: 'left',
          // tone 'neutral' (Danny 13-08, PDF punt 4/7a: rijen pas uitgeklapt leesbaar):
          // a row TITLE reads as content — plain text colour; the link icon carries
          // the affordance. Default 'accent' keeps every existing caller unchanged.
          color: tone === 'neutral' ? 'var(--text)' : 'var(--color-primary-text)', cursor: 'pointer', textDecoration: 'none',
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
  /* eslint-enable huisstijlLegacy/no-restricted-syntax */
}
