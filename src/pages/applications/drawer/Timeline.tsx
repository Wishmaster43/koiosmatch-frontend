import type { ReactNode } from 'react'
import Avatar from '@/components/ui/Avatar'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import TimelineRail from '@/components/ui/TimelineRail'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

export interface TimelineItem { id?: Id; initials?: string; author?: string; time?: string; description?: ReactNode; ai?: boolean }

/**
 * Timeline — the application drawer's Tijdlijn tab: a vertical activity list
 * (connector rail + author avatar + description bubble + optional Koios AI mark +
 * time). `time` is the mapper's raw value (created_at, an ISO string) — formatted
 * here via the house DD-MM-YYYY HH:mm, never rendered as a raw ISO string
 * (Danny 05-08: "Datum en tijd staat niet goed").
 */
export default function Timeline({ items = [], emptyText }: { items?: TimelineItem[]; emptyText?: ReactNode }) {
  const { formatDateTime } = useDateFormat()
  if (!items.length) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText}</div>

  return (
    // No gap here: each row's own paddingBottom carries the spacing so the
    // TimelineRail's connector line reaches all the way to the next dot.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((ev, i) => (
        <div key={ev.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 14 }}>
          <TimelineRail isLast={i === items.length - 1} />
          <Avatar initials={ev.initials} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.author}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(ev.time)}</span>
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
