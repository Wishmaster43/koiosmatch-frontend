/**
 * ChannelActivityChart — K-197 (Danny 25-08 "hier moet ik ook WABA, WABA-coex,
 * WhatsApp Web zien"): the 14-day WhatsApp activity stacked per channel
 * (inbound + outbound per day) on the shared WeeklyBarChartCard. The page only
 * mounts it when at least one day carries by_channel, so an older envelope
 * keeps the plain activity chart alone. Own file: the chart atom pulls in
 * @/lib/datetime, which components.tsx's flat i18n test mock cannot carry.
 */
import { useTranslation } from 'react-i18next'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import { CHANNEL_COLORS, CHANNEL_KEYS } from '@/components/drawer/channelColors'
import type { WaActivityDatum } from '@/types/whatsapp'
import { fmtAxisDate } from './data/axisDate'
// App-wide active locale (DATUM-1/LANE-B) — feeds the per-day axis label.
import { useLocale } from '@/lib/datetime'

export default function ChannelActivityChart({ data }: { data: WaActivityDatum[] }) {
  const { t } = useTranslation('whatsapp')
  // Channel names live in the candidates namespace (one label per enum value, app-wide).
  const { t: tCandidates } = useTranslation('candidates')
  const locale = useLocale()
  const series = CHANNEL_KEYS.map(key => ({ key, label: tCandidates(`conversations.channel.${key}`), color: CHANNEL_COLORS[key] }))
  // One row per day: each channel's inbound + outbound, `value` = the day total.
  const rows = data.map(d => {
    const per = Object.fromEntries(CHANNEL_KEYS.map(key => [key, (d.by_channel?.[key]?.inbound ?? 0) + (d.by_channel?.[key]?.outbound ?? 0)]))
    return { name: fmtAxisDate(d.date, locale), value: Object.values(per).reduce((a, b) => a + b, 0), ...per }
  })
  return <WeeklyBarChartCard title={t('overview.channelActivityTitle')} data={rows} series={series} stacked height={200} />
}
