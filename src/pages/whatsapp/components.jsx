/**
 * WhatsApp dashboard presentational pieces — KPI cards, the activity chart, the
 * message feed and the escalation list (+ date helpers). Extracted from WhatsAppPage.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'


export const PAD  = n => String(n).padStart(2, '0')
const initials = c => c
  ? `${(c.first_name ?? '')[0] ?? ''}${(c.last_name ?? '')[0] ?? ''}`.toUpperCase()
  : '?'
const fullName  = c => c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '—'
const timeAgo   = iso => {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}u`
  return `${Math.floor(diff / 86400)}d`
}
const DIRECTION_COLOR = { inbound: 'var(--color-success)', outbound: '#3B8FD4' }
// Escalation reason → colour. Label = t('reasons.<key>').
const REASON_COLOR = {
  failed_delivery:   { color: 'var(--color-danger)', bg: '#FEF2F2' },
  no_reply:          { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  negative_response: { color: '#7C3AED', bg: '#F5F3FF' },
}

// ─── sub-components ─────────────────────────────────────────────────────────

export function KpiCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>
          {loading ? '—' : (value ?? 0).toLocaleString('nl')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function Avatar({ candidate, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
    }}>
      {initials(candidate)}
    </div>
  )
}

function StatusDot({ status, direction }) {
  const color =
    status === 'read'      ? 'var(--color-success)' :
    status === 'delivered' ? '#3B8FD4' :
    status === 'failed'    ? 'var(--color-danger)' :
    direction === 'inbound' ? 'var(--color-success)' : '#9CA3AF'
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
}

export function MessageFeed({ messages, loading }) {
  const { t } = useTranslation('whatsapp')
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('feed.title')}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('feed.live')}</span>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 420 }}>
        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('feed.loading')}
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('feed.empty')}
          </div>
        )}
        {!loading && messages.map((msg, i) => (
          <div key={msg.id ?? i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            transition: 'background 0.1s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Avatar candidate={msg.candidate} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {fullName(msg.candidate)}
                </span>
                <span style={{ fontSize: 10, color: DIRECTION_COLOR[msg.direction] }}>
                  {msg.direction === 'inbound'
                    ? <ArrowDownLeft size={10} />
                    : <ArrowUpRight size={10} />}
                </span>
                <StatusDot status={msg.status} direction={msg.direction} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.body}
              </p>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
              {timeAgo(msg.sent_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EscalationList({ escalations, loading }) {
  const { t } = useTranslation('whatsapp')
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={14} color="var(--color-danger)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('escalations.title')}</span>
        {!loading && escalations.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--color-danger)',
                         background: '#FEF2F2', borderRadius: 999, padding: '1px 7px' }}>
            {escalations.length}
          </span>
        )}
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 320 }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('escalations.loading')}
          </div>
        )}
        {!loading && escalations.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('escalations.empty')}
          </div>
        )}
        {!loading && escalations.map((esc, i) => {
          const meta = REASON_COLOR[esc.reason] ?? { color: '#6B7280', bg: '#F9FAFB' }
          const reasonLabel = t(`reasons.${esc.reason}`, { defaultValue: esc.reason })
          return (
            <div key={esc.candidate_id ?? i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar candidate={esc.candidate} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  {fullName(esc.candidate)}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: meta.color,
                               background: meta.bg, borderRadius: 999, padding: '1px 6px' }}>
                  {reasonLabel}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3,
                            fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                <Clock size={10} />
                {esc.hours_waiting}u
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtAxisDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  const monthAbbr = new Date(2000, parseInt(m) - 1, 1).toLocaleString(undefined, { month: 'short' })
  return `${parseInt(d)} ${monthAbbr}`
}

export function ActivityChart({ data, loading }) {
  const { t } = useTranslation('whatsapp')
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', padding: '16px 20px 12px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
        {t('chartTitle')}
      </div>
      {loading ? (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', fontSize: 13 }}>{t('loading')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B8FD4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3B8FD4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 10, fill: '#9CA3AF' }}
                   axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)',
                              borderRadius: 8, fontSize: 12 }}
              labelFormatter={fmtAxisDate}
            />
            <Legend iconType="circle" iconSize={7}
              formatter={v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {v === 'outbound' ? t('outbound') : t('inbound')}
              </span>} />
            <Area type="monotone" dataKey="outbound" name="outbound"
              stroke="#3B8FD4" fill="url(#gradOut)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="inbound" name="inbound"
              stroke="var(--color-success)" fill="url(#gradIn)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
