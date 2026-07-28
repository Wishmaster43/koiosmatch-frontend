/**
 * DrillBreadcrumb — the ONE way back out of a drill-down inside a drawer tab.
 *
 * It replaces the per-level "← Terug" button. The moment a second level appeared (a
 * contact opened inside a location) that pattern produced TWO buttons both reading
 * "Terug", stacked in one narrow column, going to different places — measured as the
 * worst part of the nested-contacts design (28-07). A trail says where you are AND what
 * each hop returns to, in one line, however deep you stand.
 *
 * `trail` is the clickable ancestors, `current` the page you are on (plain text — you
 * cannot navigate to where you already are). Rendered as a real <nav> with buttons, not
 * links: these are in-app state changes, not URLs.
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'

export interface Crumb { label: string; onClick: () => void }

const crumbBtn = {
  padding: 0, background: 'none', border: 'none', font: 'inherit', fontSize: 12, fontWeight: 500,
  color: 'var(--color-primary)', cursor: 'pointer', whiteSpace: 'nowrap' as const,
}

export default function DrillBreadcrumb({ trail, current }: { trail: Crumb[]; current: string }) {
  const { t } = useTranslation('common')
  return (
    <nav aria-label={t('breadcrumb')}
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 12, padding: '5px 0' }}>
      <ArrowLeft size={13} color="var(--color-primary)" style={{ flexShrink: 0 }} />
      {trail.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          <button type="button" onClick={c.onClick} style={crumbBtn}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
            {c.label}
          </button>
          <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </Fragment>
      ))}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{current}</span>
    </nav>
  )
}
