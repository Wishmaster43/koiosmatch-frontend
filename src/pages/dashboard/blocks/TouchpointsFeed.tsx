/**
 * TouchpointsFeed — a recruitment dashboard block: today's candidate touchpoints
 * (birthday · first workday · available-again · follow-up due) so a recruiter
 * reaches out at the right moment. Owner-scoped by the backend feed; self-hides
 * when empty. Click a row → the candidate drawer.
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { Cake, CalendarPlus, RotateCcw, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Touchpoint } from '@/types/dashboard'

// Backend type slug → icon + i18n key.
const META: Record<string, { Icon: LucideIcon; key: string; color: string }> = {
  birthday:      { Icon: Cake,         key: 'birthday',      color: '#EC4899' },
  first_workday: { Icon: CalendarPlus, key: 'firstWorkday',  color: 'var(--color-success)' },
  back_available:{ Icon: RotateCcw,    key: 'backAvailable', color: 'var(--color-primary)' },
  followup_due:  { Icon: Clock,        key: 'followupDue',   color: 'var(--color-warning)' },
}

const fmtDate = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default function TouchpointsFeed({ items, onOpen }: {
  items: Touchpoint[]
  onOpen?: (id: string | number) => void
}) {
  const { t } = useTranslation('dashboard')
  if (!items.length) return null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        {t('block.touchpoints')}
      </div>
      {items.map((it, i) => {
        const m = META[it.type ?? ''] ?? META.followup_due
        const clickable = Boolean(onOpen && it.candidate_id != null)
        return (
          <div key={i} {...interactive(clickable ? () => onOpen?.(it.candidate_id!) : undefined)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: clickable ? 'pointer' : 'default',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: m.color + '1A', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <m.Icon size={14} color={m.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{it.name || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t(`touchpointType.${m.key}`)}</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtDate(it.date)}</span>
          </div>
        )
      })}
    </div>
  )
}
