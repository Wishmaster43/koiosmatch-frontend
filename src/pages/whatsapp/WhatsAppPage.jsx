/**
 * WhatsAppPage — overview dashboard for WhatsApp candidate messaging.
 *
 * Shows KPI cards (messages today, candidates contacted, shifts filled, open
 * escalations), an activity chart (inbound vs outbound over time), a live
 * message feed, and a list of escalations needing attention.
 * Data: GET /whatsapp/stats, /messages, /escalations, /activity.
 *
 * Main blocks below:
 *   - helpers           → date/time formatting (PAD, time-ago, etc.)
 *   - ActivityChart     → recharts area chart of inbound/outbound volume
 *   - MessageFeed       → recent messages with direction + status
 *   - EscalationList    → conversations flagged for human follow-up
 */
import { useState, useEffect } from 'react'
import {
  MessageCircle, Users, CheckSquare, AlertTriangle,
  Clock, ArrowDownLeft, ArrowUpRight, RefreshCw,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '../../lib/api'

// ─── helpers ────────────────────────────────────────────────────────────────

const PAD  = n => String(n).padStart(2, '0')
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
const formatDate = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${PAD(d.getDate())}-${PAD(d.getMonth()+1)} ${PAD(d.getHours())}:${PAD(d.getMinutes())}`
}

const DIRECTION_COLOR = { inbound: '#16A34A', outbound: '#3B8FD4' }
const REASON_LABEL = {
  failed_delivery:   { label: 'Niet bezorgd',     color: '#DC2626', bg: '#FEF2F2' },
  no_reply:          { label: 'Geen reactie',      color: '#D97706', bg: '#FFFBEB' },
  negative_response: { label: 'Negatief antwoord', color: '#7C3AED', bg: '#F5F3FF' },
}

// ─── sub-components ─────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, loading }) {
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
    status === 'read'      ? '#16A34A' :
    status === 'delivered' ? '#3B8FD4' :
    status === 'failed'    ? '#DC2626' :
    direction === 'inbound' ? '#16A34A' : '#9CA3AF'
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
}

function MessageFeed({ messages, loading }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Laatste berichten</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>live</span>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 420 }}>
        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Berichten ophalen…
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Geen berichten
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

function EscalationList({ escalations, loading }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={14} color="#DC2626" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Escalaties</span>
        {!loading && escalations.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#DC2626',
                         background: '#FEF2F2', borderRadius: 999, padding: '1px 7px' }}>
            {escalations.length}
          </span>
        )}
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 320 }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Ophalen…
          </div>
        )}
        {!loading && escalations.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Geen openstaande escalaties
          </div>
        )}
        {!loading && escalations.map((esc, i) => {
          const meta = REASON_LABEL[esc.reason] ?? { label: esc.reason, color: '#6B7280', bg: '#F9FAFB' }
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
                  {meta.label}
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

const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
function fmtAxisDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${MONTHS_NL[parseInt(m)-1]}`
}

function ActivityChart({ data, loading }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', padding: '16px 20px 12px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
        Berichtenactiviteit — afgelopen 14 dagen
      </div>
      {loading ? (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', fontSize: 13 }}>Laden…</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B8FD4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3B8FD4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
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
                {v === 'outbound' ? 'Uitgaand' : 'Inkomend'}
              </span>} />
            <Area type="monotone" dataKey="outbound" name="outbound"
              stroke="#3B8FD4" fill="url(#gradOut)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="inbound" name="inbound"
              stroke="#16A34A" fill="url(#gradIn)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [stats,       setStats]       = useState(null)
  const [messages,    setMessages]    = useState([])
  const [escalations, setEscalations] = useState([])
  const [activity,    setActivity]    = useState([])
  const [loading,     setLoading]     = useState({ stats: true, messages: true, escalations: true, activity: true })
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [noConnection, setNoConnection] = useState(false)

  const load = () => {
    setLoading({ stats: true, messages: true, escalations: true, activity: true })
    setNoConnection(false)

    api.get('/whatsapp/stats')
      .then(r => setStats(r.data))
      .catch(err => { if (err.response?.status === 404) setNoConnection(true) })
      .finally(() => setLoading(p => ({ ...p, stats: false })))

    api.get('/whatsapp/messages', { params: { per_page: 50 } })
      .then(r => setMessages(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, messages: false })))

    api.get('/whatsapp/escalations')
      .then(r => setEscalations(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, escalations: false })))

    api.get('/whatsapp/activity')
      .then(r => setActivity(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, activity: false })))

    setLastRefresh(new Date())
  }

  useEffect(() => { load() }, [])

  if (noConnection && !loading.stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F0FDF4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px' }}>
            <MessageCircle size={26} color="#16A34A" />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            Geen WhatsApp-verbinding
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>
            Er is nog geen WhatsApp Business-koppeling ingesteld voor deze tenant.
            Configureer een verbinding via de backend om berichten en statistieken hier te zien.
          </p>
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px',
                        border: '1px solid #F3F4F6', textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 8 }}>
              Foutmelding backend
            </div>
            <code style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
              No query results for model WhatsappConnection
            </code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            WhatsApp
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Bijgewerkt om {PAD(lastRefresh.getHours())}:{PAD(lastRefresh.getMinutes())}
          </p>
        </div>
        <button onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                   fontSize: 12, fontWeight: 500, borderRadius: 8,
                   border: '1px solid var(--border)', background: 'var(--surface)',
                   color: 'var(--text-muted)', cursor: 'pointer' }}>
          <RefreshCw size={12} /> Verversen
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={MessageCircle} label="Berichten vandaag"       value={stats?.messages_today}            color="#3B8FD4" loading={loading.stats} />
        <KpiCard icon={Users}         label="Kandidaten benaderd"     value={stats?.candidates_contacted}      color="#7C3AED" loading={loading.stats} />
        <KpiCard icon={CheckSquare}   label="Diensten gevuld via WA"  value={stats?.shifts_filled_via_whatsapp} color="#16A34A" loading={loading.stats} />
        <KpiCard icon={AlertTriangle} label="Open escalaties"         value={stats?.open_escalations}          color="#DC2626" loading={loading.stats} />
      </div>

      {/* Chart */}
      <div style={{ marginBottom: 20 }}>
        <ActivityChart data={activity} loading={loading.activity} />
      </div>

      {/* Feed + Escalaties */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
        <MessageFeed    messages={messages}       loading={loading.messages} />
        <EscalationList escalations={escalations} loading={loading.escalations} />
      </div>

    </div>
  )
}
