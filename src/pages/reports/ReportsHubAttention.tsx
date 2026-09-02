/**
 * ReportsHubAttention — the "Vraagt aandacht" block of the bare #reports hub:
 * the backend's nine attention signals (GET /reports → ReportsHubService::summary)
 * rendered as a compact LIST of only the signals that are non-zero, each row
 * clicking through to the sub-report it came from. Deliberately NOT a second
 * nine-card strip: Danny 31-08 on the first cut, "dubbele KPI's is niet mooi" —
 * the KPI band above already carries nine cards, and an attention list reads as
 * a to-do, not as a duplicate set of numbers. A zero signal takes no room (calm);
 * no signals at all shows one calm line. Rendered as a grid block so it sits
 * beside the trend chart, sharing the chart cards' chrome.
 */
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Mono } from '@/components/ui/typography'
import ReportChartCard from './ReportChartCard'
import ReportStateBlock from './ReportStateBlock'
import { useReportsHub, isReportsHubForbidden } from './useReportsHub'
import { useNavigation } from '@/context/NavigationContext'
import { useAuth } from '@/context/AuthContext'
import type { ReportId } from './reportIds'
import { REPORT_IDS } from './reportIds'

// A signal's `report` is not always a live reports.<id> route: the conversations
// signal lands on the WhatsApp report (CMBE: same ConversationsReport source),
// but only when the tenant has that module — otherwise the row is honestly
// non-clickable, and so is any unknown future signal (CEL-DOORKLIK-CANON: no
// link beats a guessed one).
function resolveReportId(report: string, hasWhatsapp: boolean): ReportId | null {
  if ((REPORT_IDS as readonly string[]).includes(report)) return report as ReportId
  if (report === 'conversations') return hasWhatsapp ? 'whatsapp' : null
  return null
}

// The attention list block: only non-zero signals, each a real button row.
export default function ReportsHubAttention() {
  const { t } = useTranslation('analytics')
  const { navigate } = useNavigation()
  const auth = useAuth()
  const hasWhatsapp = (auth?.hasModule ?? (() => false))('whatsapp')
  const { data, loading, error, errorObject, refetch } = useReportsHub()

  // No reports.view: the block is simply absent — the KPI band above stays.
  if (error && isReportsHubForbidden(errorObject)) return null

  // Zero is calm and takes no room; server order is the service's own severity order.
  const signals = (data?.signals ?? []).filter(s => s.count > 0)
  const empty = !loading && !error && signals.length === 0

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {signals.map(s => {
        // DEMO-TAAL/§5: the i18n key is the label; the server's Dutch label only backs an unmapped key.
        const label = t(`hub.attention.cards.${s.key}`, { defaultValue: s.label })
        const target = resolveReportId(s.report, hasWhatsapp)
        const body = (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Mono style={{ color: 'var(--color-warning-text)', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{s.count}</Mono>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          </span>
        )
        // No reachable report: the count still shows, but nothing pretends to be a link.
        if (!target) {
          return <div key={s.key} style={{ display: 'flex', alignItems: 'center', height: 28, padding: '0 8px' }}>{body}</div>
        }
        return (
          <Button key={s.key} variant="ghost" size="sm"
            onClick={() => navigate(`reports.${target}`)}
            aria-label={`${s.count} ${label}`}
            style={{ width: '100%', justifyContent: 'space-between', padding: '0 8px' }}>
            {body}
            <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </Button>
        )
      })}
    </div>
  )

  return (
    <ReportChartCard title={t('hub.attention.title')} chart={
      loading || error || empty ? (
        <ReportStateBlock loading={loading} error={!!error} empty={empty}
          loadingLabel={t('hub.attention.loading')} errorLabel={t('hub.attention.error')} emptyLabel={t('hub.attention.empty')}
          onRetry={() => refetch()} />
      ) : list
    } />
  )
}
