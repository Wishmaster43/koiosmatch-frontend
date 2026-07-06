/**
 * OutreachBoard — kanban of campaigns grouped by status (draft / active / done).
 * Drag a card to another column to change its status (optimistic; the page PATCHes).
 */
import { useState } from 'react'
import type { DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, Mail, MessageCircle, Users } from 'lucide-react'
import type { Campaign } from './hooks/useOutreachCampaigns'
import { useDragAutoScroll } from '@/lib/useDragAutoScroll'

// Icon + colour per outreach channel (soft-chip convention).
const CHANNEL_META: Record<string, { icon: typeof Phone; color: string }> = {
  call:     { icon: Phone,         color: '#2563EB' },
  email:    { icon: Mail,          color: '#D97706' },
  whatsapp: { icon: MessageCircle, color: '#25D366' },
}

export interface OutreachColumn { key: string; label: string; color: string }

interface Props {
  rows: Campaign[]
  columns: OutreachColumn[]
  onMove: (id: string, status: string) => void
  onOpen?: (c: Campaign) => void
}

export default function OutreachBoard({ rows, columns, onMove, onOpen }: Props) {
  // Edge-scroll the board while dragging (HTML5 DnD never scrolls itself).
  const { ref: boardScrollRef, onDragOver: boardAutoScroll } = useDragAutoScroll<HTMLDivElement>()
  const { t } = useTranslation('outreach')
  const [dragOver, setDragOver] = useState<string | null>(null)

  const onDrop = (e: DragEvent<HTMLDivElement>, colKey: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setDragOver(null)
    if (id) onMove(id, colKey)
  }

  return (
    <div ref={boardScrollRef} onDragOver={boardAutoScroll} style={{ flex: 1, overflow: 'auto', padding: '12px 24px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {columns.map((col) => {
        const cards = rows.filter((r) => (r.status ?? 'draft') === col.key)
        return (
          <div key={col.key}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.key) }}
            onDragLeave={() => setDragOver((prev) => (prev === col.key ? null : prev))}
            onDrop={(e) => onDrop(e, col.key)}
            style={{ minWidth: 260, width: 260, flexShrink: 0, borderRadius: 10, padding: 8,
              background: dragOver === col.key ? 'var(--hover-bg)' : 'transparent',
              border: `1px solid ${dragOver === col.key ? 'var(--color-primary)' : 'transparent'}` }}>

            {/* Column header: colour dot + label + count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 10px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{col.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{cards.length}</span>
            </div>

            {/* Cards */}
            {cards.map((c) => {
              const m = CHANNEL_META[c.channel ?? 'call'] ?? CHANNEL_META.call
              const Icon = m.icon
              const targets = c.targets_count ?? c.target_count
              return (
                <div key={c.id} draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(c.id))}
                  onClick={() => onOpen?.(c)}
                  style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                    cursor: onOpen ? 'pointer' : 'grab', userSelect: 'none', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>{c.name ?? '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
                      padding: '2px 8px', borderRadius: 99, background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>
                      <Icon size={12} /> {t(`channel.${c.channel}`, { defaultValue: c.channel ?? '—' })}
                    </span>
                    {targets != null && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <Users size={12} /> {targets}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {cards.length === 0 && (
              <div style={{ padding: '10px 6px', fontSize: 11, color: 'var(--text-muted)' }}>{t('board.empty')}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
