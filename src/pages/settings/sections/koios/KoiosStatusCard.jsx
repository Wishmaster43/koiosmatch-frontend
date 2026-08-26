/**
 * KoiosStatusCard — three connection indicators: the Claude API key
 * (claude_configured), whether the policy is loaded (policy_loaded), and a
 * live probe (api_ok) — a real call proving the connection actually works,
 * which also surfaces credit exhaustion (a configured key with an empty
 * balance is not "connected"). State uses icon + colour + text (never colour
 * alone) for accessibility. `api_error` is a raw, untranslated backend string
 * (§5) — never rendered; only its ok/not-ok boolean drives the UI.
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

// Renders the three connection indicators (see the module doc above): each uses icon + colour + text so status is never colour-only, and the raw api_error string is never rendered directly (§5).
export default function KoiosStatusCard({ status, t }) {
  const s = status ?? {}
  return (
    <div style={card}>
      <div style={cardTitle}>{t('status.title')}</div>
      <Indicator label={t('status.connection')} ok={s.claude_configured === true}
        okText={t('status.connected')} badText={t('status.notConnected')} />
      <Indicator label={t('status.policy')} ok={s.policy_loaded === true}
        okText={t('status.loaded')} badText={t('status.notLoaded')} />
      {/* Only shown once the backend has actually run the probe (api_ok present) —
          an unset/undefined field means "not yet checked", not "failing". */}
      {typeof s.api_ok === 'boolean' && (
        <Indicator label={t('status.live')} ok={s.api_ok === true}
          okText={t('status.liveOk')} badText={t('status.liveBad')} />
      )}
    </div>
  )
}
