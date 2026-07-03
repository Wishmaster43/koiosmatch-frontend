/**
 * TargetsTab — the call list itself: one row per target (candidate) with a status
 * soft-chip and quick check-off actions (contacted / answered / skipped / reset).
 * Presentational; data + mutation come from useOutreachDetail via the drawer.
 */
import { useTranslation } from 'react-i18next'
import { Phone, Check, X, RotateCcw } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { initialsOf } from '@/lib/initials'
import { useDateFormat } from '@/lib/datetime'
import type { OutreachTarget } from '../hooks/useOutreachDetail'

// Status → semantic token (soft-chip tint, §4). Todo stays muted; answered = success.
const STATUS_COLOR: Record<string, string> = {
  todo: 'var(--text-muted)', contacted: 'var(--color-primary)',
  answered: 'var(--color-success)', skipped: 'var(--color-warning)',
}

export default function TargetsTab({ targets, loading, error, onSetStatus }: {
  targets: OutreachTarget[]
  loading: boolean
  error: boolean
  onSetStatus: (id: string, status: string) => void
}) {
  const { t } = useTranslation('outreach')
  const { formatDate } = useDateFormat()

  const candidateName = (tg: OutreachTarget) =>
    tg.candidate?.name ?? [tg.candidate?.first_name, tg.candidate?.last_name].filter(Boolean).join(' ') ?? '—'

  // Four UI states — never a blank panel.
  if (loading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.loading')}</p>
  if (error)   return <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('drawer.error')}</p>
  if (!targets.length) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.empty')}</p>

  const actBtn = (title: string, onClick: () => void, icon: React.ReactNode, color: string) => (
    <button onClick={onClick} title={title} aria-label={title}
      style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, cursor: 'pointer', color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      {icon}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {targets.map(tg => {
        const st  = tg.status ?? 'todo'
        const col = STATUS_COLOR[st] ?? 'var(--text-muted)'
        return (
          <div key={tg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
            <Avatar initials={initialsOf(candidateName(tg))} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {candidateName(tg)}
              </div>
              {tg.contacted_at && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(tg.contacted_at)}</div>
              )}
            </div>
            {/* Status soft-chip */}
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, color: col,
              background: `color-mix(in srgb, ${col} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 35%, transparent)` }}>
              {t(`drawer.target.${st}`, { defaultValue: st })}
            </span>
            {/* Quick check-off: contacted / answered / skipped; done rows can reset to todo. */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {st === 'todo' ? (
                <>
                  {actBtn(t('drawer.action.contacted'), () => onSetStatus(tg.id, 'contacted'), <Phone size={12} />, 'var(--color-primary)')}
                  {actBtn(t('drawer.action.answered'),  () => onSetStatus(tg.id, 'answered'),  <Check size={12} />, 'var(--color-success)')}
                  {actBtn(t('drawer.action.skipped'),   () => onSetStatus(tg.id, 'skipped'),   <X size={12} />, 'var(--color-warning)')}
                </>
              ) : (
                actBtn(t('drawer.action.reset'), () => onSetStatus(tg.id, 'todo'), <RotateCcw size={12} />, 'var(--text-muted)')
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
