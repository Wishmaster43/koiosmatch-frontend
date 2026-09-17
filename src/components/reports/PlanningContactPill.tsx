/**
 * PlanningContactPill — the soft-tinted yes/no pill for a contact's
 * `scheduled_order_contact` flag. Shared by ContactPersonsTable (table cell);
 * ContactPersonDrawer keeps its own header-badge variant for now (out of this
 * fix's touched-file scope — a follow-up adoption there is still open).
 */
import type { ReactNode } from 'react'
import { MessageCircle } from 'lucide-react'

// Renders the success-tinted pill when active, a muted dot pill otherwise.
export default function PlanningContactPill({ active, label }: { active: boolean; label: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500,
      background: active ? 'var(--color-success-bg)' : 'var(--hover-bg)',
      color:      active ? 'var(--color-on-success-bg)' : 'var(--text-muted)',
      border:     `1px solid ${active ? 'var(--color-success)' : 'var(--border)'}`,
    }}>
      {active
        ? <MessageCircle size={10} />
        : <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border)' }} />}
      {label}
    </span>
  )
}
