import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { useNavigation } from '@/context/NavigationContext'
import type { Id } from '@/types/common'

/**
 * EntityLink — a clickable reference to a linked record (candidate, vacancy,
 * customer, application). Opens that entity's page + drawer via the navigation
 * context. Renders plain text when there is no target id, so it degrades safely.
 *
 * Trailing external-link icon (Danny 2026-07-16, job 16): every cross-entity
 * hyperlink gets a small, muted "opens elsewhere" affordance — default ON so it
 * shows up everywhere this component is already used (candidate/vacancy/match/
 * task drawers); pass `hideIcon` to opt a tight/inline spot out.
 */
export default function EntityLink({ page, id, children, title, hideIcon = false }: { page: string; id?: Id | null; children: ReactNode; title?: string; hideIcon?: boolean }) {
  const { openEntity } = useNavigation()
  if (id == null) return <>{children}</>
  return (
    <button type="button" title={title} onClick={() => openEntity(page, id)}
      style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', textAlign: 'left',
        color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
      {children}
      {!hideIcon && <ExternalLink size={12} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.55, color: 'var(--text-muted)' }} />}
    </button>
  )
}
