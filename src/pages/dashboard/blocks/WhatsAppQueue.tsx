/**
 * WhatsAppQueue — a planning dashboard block: the outbound WhatsApp backlog
 * (queued) + failed sends, so a planner spots comms throughput problems at a
 * glance. Live from useWhatsAppQueue (values passed in from Dashboard). Click →
 * the WhatsApp screen to act.
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { MessageSquare } from 'lucide-react'

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: color + '1A', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MessageSquare size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

export default function WhatsAppQueue({ inQueue = 0, failed = 0, onOpen }: {
  inQueue?: number
  failed?: number
  onOpen?: () => void
}) {
  const { t } = useTranslation('dashboard')
  return (
    <div {...interactive(onOpen)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, cursor: onOpen ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('block.waQueue')}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Tile label={t('block.waQueued')} value={inQueue} color="var(--color-warning)" />
        <Tile label={t('block.waFailed')} value={failed} color="var(--color-danger)" />
      </div>
    </div>
  )
}
