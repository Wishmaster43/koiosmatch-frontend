/**
 * ActivityChart — recharts area chart of daily inbound/outbound WhatsApp volume.
 * Own file, same reason as ChannelActivityChart (K-197): the chart pulls in
 * @/lib/datetime (via useLocale, for the locale-aware axis label), which
 * components.test.tsx's flat i18n mock cannot carry — src/i18n's real init
 * throws when react-i18next is mocked without initReactI18next.
 */
import { useTranslation } from 'react-i18next'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { SectionTitle, Caption } from '@/components/ui/typography'
import type { WaActivityDatum } from '@/types/whatsapp'
import { fmtAxisDate } from './data/axisDate'
// App-wide active locale (DATUM-1/LANE-B) — feeds the per-day axis label.
import { useLocale } from '@/lib/datetime'

// Daily inbound/outbound WhatsApp volume area chart (see file docblock above),
// kept in its own file since it pulls the locale-aware axis date formatter.
export default function ActivityChart({ data, loading }: { data: WaActivityDatum[]; loading?: boolean }) {
  const { t } = useTranslation('whatsapp')
  const locale = useLocale()
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
            <XAxis dataKey="date" tickFormatter={(v: string) => fmtAxisDate(v, locale)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                   axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)',
                              borderRadius: 8, fontSize: 12 }}
              labelFormatter={(label) => fmtAxisDate(String(label), locale)}
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
