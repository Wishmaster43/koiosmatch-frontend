import type { ReactNode } from 'react'
import { useNavigation } from '@/context/NavigationContext'
import type { Id } from '@/types/common'

/**
 * EntityLink — a clickable reference to a linked record (candidate, vacancy,
 * customer, application). Opens that entity's page + drawer via the navigation
 * context. Renders plain text when there is no target id, so it degrades safely.
 */
export default function EntityLink({ page, id, children, title }: { page: string; id?: Id | null; children: ReactNode; title?: string }) {
  const { openEntity } = useNavigation()
  if (id == null) return <>{children}</>
  return (
    <button type="button" title={title} onClick={() => openEntity(page, id)}
      style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', textAlign: 'left',
        color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
      {children}
    </button>
  )
}
