/**
 * WhatsApp dashboard presentational pieces — KPI cards, the activity chart and
 * the escalation list (+ date helpers). Extracted from WhatsAppPage. The
 * message feed (MessageFeed) moved to messagesTable/MessagesTable.tsx (WA-MSG-
 * TABLE-1, 25-08) — a real DataTable with drilldown gateways, per CEL-DOORKLIK-
 * CANON — and was removed from here.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import SoftChip from '@/components/ui/SoftChip'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { useEscalationReasons } from './hooks/useEscalationReasons'
import type { WaCandidate, WaEscalation, WaActivityDatum } from '@/types/whatsapp'


export const PAD  = (n: number) => String(n).padStart(2, '0')
const initials = (c?: WaCandidate) => c
  ? `${(c.first_name ?? '')[0] ?? ''}${(c.last_name ?? '')[0] ?? ''}`.toUpperCase()
  : '?'
const fullName  = (c?: WaCandidate) => c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '—'
// LOOKUP-GAP-1(c): escalation-reason colour/label used to be this fixed 3-key
// map, ignoring the real tenant lookup (/escalation-reasons, Settings → WhatsApp
// → Escalatieredenen). EscalationList below now resolves a reason from that
// lookup FIRST (via useEscalationReasons), so a tenant-renamed/added reason
// renders its own colour/label. GET /whatsapp/escalations today still always
// sends one of these three DERIVED diagnostic keys instead of a real tenant
// reason (WhatsappDashboardController::deriveEscalationReason guesses from
// message timestamps — see useEscalationReasons.ts's file header for the
// verified backend gap) — this map is the honest fallback that keeps THOSE
// colour-coded until the backend actually returns a real reason; its label
// still always comes from t('reasons.<key>'), never a literal string here.
const DERIVED_REASON_STYLE: Record<string, string> = {
  failed_delivery:   'var(--color-danger)',
  no_reply:          'var(--color-warning)',
  negative_response: 'var(--color-violet)',
}
// ─── sub-components ─────────────────────────────────────────────────────────

function Avatar({ candidate, size = 32 }: { candidate?: WaCandidate; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
    }}>
      {initials(candidate)}
    </div>
  )
}

export function EscalationList({ escalations, loading }: { escalations: WaEscalation[]; loading?: boolean }) {
  const { t } = useTranslation('whatsapp')
  // Real tenant escalation-reason lookup (LOOKUP-GAP-1(c)) — see the file header
  // comment on DERIVED_REASON_STYLE for why today's rows still fall through to it.
  const { metaOf } = useEscalationReasons()
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={14} color="var(--color-danger)" />
        <SectionTitle as="span">{t('escalations.title')}</SectionTitle>
        {!loading && escalations.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--color-on-danger-bg)',
                         background: 'var(--color-danger-bg)', borderRadius: 999, padding: '1px 7px' }}>
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
          // Lookup match wins (a real tenant reason, current or renamed) — falls
          // back to the derived-diagnostic-key palette, then a neutral tint.
          const lookupMeta = metaOf(esc.reason)
          const color = lookupMeta?.color ?? (esc.reason ? DERIVED_REASON_STYLE[esc.reason] : undefined) ?? 'var(--text-muted)'
          const reasonLabel = lookupMeta?.label ?? t(`reasons.${esc.reason}`, { defaultValue: esc.reason })
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
                {/* SoftChip — the §4 shared soft-tint chip (never a hand-rolled
                    color-mix badge); size=10 matches this row's previous footprint. */}
                <SoftChip label={reasonLabel} color={color} round size={10} />
              </div>
              <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <Clock size={10} />
                {esc.hours_waiting}u
              </Caption>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtAxisDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  const monthAbbr = new Date(2000, parseInt(m) - 1, 1).toLocaleString('nl-NL', { month: 'short' })
  return `${parseInt(d)} ${monthAbbr}`
}

export function ActivityChart({ data, loading }: { data: WaActivityDatum[]; loading?: boolean }) {
  const { t } = useTranslation('whatsapp')
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', padding: '16px 20px 12px',
    }}>
      <SectionTitle as="div" style={{ marginBottom: 16 }}>
        {t('chartTitle')}
      </SectionTitle>
      {loading ? (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', fontSize: 13 }}>{t('loading')}</div>
      ) : (
        // Local boundary — one broken chart must not take down the WhatsApp page.
        <ErrorBoundary fallback={() => (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>—</div>
        )}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-secondary)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                   axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)',
                              borderRadius: 8, fontSize: 12 }}
              labelFormatter={(label) => fmtAxisDate(String(label))}
            />
            <Legend iconType="circle" iconSize={7}
              formatter={v => <Caption as="span">
                {v === 'outbound' ? t('outbound') : t('inbound')}
              </Caption>} />
            <Area type="monotone" dataKey="outbound" name="outbound"
              stroke="var(--color-secondary)" fill="url(#gradOut)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="inbound" name="inbound"
              stroke="var(--color-success)" fill="url(#gradIn)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
        </ErrorBoundary>
      )}
    </div>
  )
}
