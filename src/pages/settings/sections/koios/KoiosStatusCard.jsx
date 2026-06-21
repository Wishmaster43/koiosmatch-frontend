/**
 * KoiosStatusCard — two connection indicators: the Claude API connection
 * (claude_configured) and whether the policy is loaded (policy_loaded).
 * State uses icon + colour + text (never colour alone) for accessibility.
 */
import { CheckCircle2, XCircle } from 'lucide-react'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }
const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 13 }

// One status line: label left, green/red icon + verdict right.
function Indicator({ label, ok, okText, badText }) {
  const color = ok ? 'var(--color-success)' : 'var(--color-danger)'
  const Icon = ok ? CheckCircle2 : XCircle
  return (
    <div style={row}>
      <Icon size={16} color={color} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, color: 'var(--text)' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{ok ? okText : badText}</span>
    </div>
  )
}

export default function KoiosStatusCard({ status, t }) {
  const s = status ?? {}
  return (
    <div style={card}>
      <div style={cardTitle}>{t('status.title')}</div>
      <Indicator label={t('status.connection')} ok={s.claude_configured === true}
        okText={t('status.connected')} badText={t('status.notConnected')} />
      <Indicator label={t('status.policy')} ok={s.policy_loaded === true}
        okText={t('status.loaded')} badText={t('status.notLoaded')} />
    </div>
  )
}
