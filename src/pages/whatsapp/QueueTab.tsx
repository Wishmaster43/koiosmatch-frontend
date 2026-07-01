/**
 * QueueTab — the WhatsApp-privé outbox (operational). Reads the shared queue hook,
 * handles the four UI states, and lets an authorized user act per row (send now /
 * pause / retry / cancel). Message type = soft-chip; the priority order itself is
 * configured in Settings → Berichten → Wachtrij.
 */
import type { ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Pause, RotateCw, Trash2, Clock } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { useAuth } from '@/context/AuthContext'
import type { useWhatsAppQueue } from './hooks/useWhatsAppQueue'

// Status → colour for the soft-chip.
const STATUS_COLOR: Record<string, string> = {
  queued: '#3B8FD4', sending: '#7C3AED', sent: '#16A34A',
  failed: '#DC2626', skipped: '#9CA3AF', paused: '#D97706',
}

export default function QueueTab({ queue }: { queue: ReturnType<typeof useWhatsAppQueue> }) {
  const { t } = useTranslation('whatsapp')
  const { formatDate } = useDateFormat()
  const auth = useAuth() as { hasPermission?: (p: string) => boolean }
  // Mutations are gated on messaging.manage (backend C-43). Absence-open: only hide
  // when the permission system exists and explicitly denies it.
  const canAct = typeof auth?.hasPermission === 'function' ? auth.hasPermission('messaging.manage') : true
  const { items, phase, act } = queue

  const note = (txt: string) => <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 4px' }}>{txt}</p>
  if (phase === 'loading') return note(t('queue.loading'))
  if (phase === 'error')   return note(t('queue.error'))
  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 16px' }}>
      <Clock size={26} color="var(--text-muted)" style={{ marginBottom: 10 }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('queue.emptyTitle')}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('queue.emptyDesc')}</p>
    </div>
  )

  const th: CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 12px 8px' }
  const td: CSSProperties = { fontSize: 13, color: 'var(--text)', padding: '10px 12px', borderTop: '1px solid var(--border)', verticalAlign: 'middle' }
  const mono: CSSProperties = { ...td, fontFamily: "'JetBrains Mono', monospace" }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>{t('queue.col.candidate')}</th>
            <th style={th}>{t('queue.col.type')}</th>
            <th style={th}>{t('queue.col.priority')}</th>
            <th style={th}>{t('queue.col.status')}</th>
            <th style={th}>{t('queue.col.scheduled')}</th>
            <th style={th}>{t('queue.col.attempts')}</th>
            {canAct && <th style={{ ...th, textAlign: 'right' }}>{t('queue.col.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {items.map(it => {
            const st = it.status ?? 'queued'
            return (
              <tr key={it.id}>
                <td style={td}>{it.candidate?.name ?? '—'}</td>
                <td style={td}>{it.message_type?.label ? <SoftChip label={it.message_type.label} color={it.message_type.color} /> : '—'}</td>
                <td style={mono}>{it.priority ?? '—'}</td>
                <td style={td}><SoftChip label={t(`queue.status.${st}`, { defaultValue: st })} color={STATUS_COLOR[st] ?? '#9CA3AF'} /></td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{it.scheduled_at ? formatDate(it.scheduled_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td style={mono}>{it.attempts ?? 0}</td>
                {canAct && (
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <ActionBtn title={t('queue.action.sendNow')} onClick={() => act(it.id, 'send-now')}><Send size={13} /></ActionBtn>
                    {st === 'failed'
                      ? <ActionBtn title={t('queue.action.retry')} onClick={() => act(it.id, 'retry')}><RotateCw size={13} /></ActionBtn>
                      : <ActionBtn title={t('queue.action.pause')} onClick={() => act(it.id, 'pause')}><Pause size={13} /></ActionBtn>}
                    <ActionBtn title={t('queue.action.cancel')} danger onClick={() => act(it.id, 'cancel')}><Trash2 size={13} /></ActionBtn>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Small icon action button (aria-label via title).
function ActionBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      style={{ width: 28, height: 28, marginLeft: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: danger ? 'var(--color-danger-bg)' : 'var(--hover-bg)', color: danger ? 'var(--color-danger)' : 'var(--text)',
        border: 'none', borderRadius: 6, cursor: 'pointer' }}>
      {children}
    </button>
  )
}
