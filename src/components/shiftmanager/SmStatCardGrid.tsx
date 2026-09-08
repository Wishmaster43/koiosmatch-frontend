/**
 * SmStatCardGrid — reusable stat card grid renderer for drawer KPI sections.
 * Takes an array of {label, value, Icon, color, bg} and renders them as a
 * bordered grid of cards with icon, value, and label.
 */
import React from 'react'
import { Caption } from '@/components/ui/typography'

interface StatCard {
  label: string
  value: number | string
  Icon?: React.ComponentType<{ size: number; color: string }>
  color: string
  bg: string
}

interface SmStatCardGridProps {
  cards: StatCard[]
}

export default function SmStatCardGrid({ cards }: SmStatCardGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 20,
      }}
    >
      {/* Render each stat card with icon, value, and label. */}
      {cards.map(s => (
        <div
          key={s.label}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {s.Icon && (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: s.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <s.Icon size={15} color={s.color} />
            </div>
          )}
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
            <Caption as="div" style={{ marginTop: 2 }}>
              {s.label}
            </Caption>
          </div>
        </div>
      ))}
    </div>
  )
}
