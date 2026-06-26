import type { ReactNode } from 'react'
import Avatar from '../../../components/ui/Avatar'
import KoiosAiMark from '../../../components/ui/KoiosAiMark'
import type { Id } from '../../../types/common'

export interface TimelineItem { id?: Id; initials?: string; author?: string; time?: string; description?: ReactNode; ai?: boolean }

/**
 * Timeline — a vertical activity list (dot + author avatar + description bubble +
 * optional Koios AI mark + time). Shared by the Candidate and Timeline tabs.
 */
export default function Timeline({ items = [], emptyText }: { items?: TimelineItem[]; emptyText?: ReactNode }) {
  if (!items.length) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((ev, i) => (
        <div key={ev.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
          <Avatar initials={ev.initials} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.author}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ev.time}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>{ev.description}</span>
              {ev.ai && <KoiosAiMark size={16} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
