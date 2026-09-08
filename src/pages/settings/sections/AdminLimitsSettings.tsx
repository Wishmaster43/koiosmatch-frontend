/**
 * AdminLimitsSettings — Super Admin → Platform limits (LIMIET-MONITOR-1): the
 * platform-wide meters from GET /admin/limits (an `enforced: false` row is a
 * budget signal, never a hard limit), the tenants at or near their own cap, and
 * a calm notice when the sweep skipped tenants. Polls no faster than once a minute.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import LimitMeterRow from '@/components/ui/LimitMeterRow'
import CalloutBox from '@/components/ui/CalloutBox'
import { SettingsScaffold, SettingCardList, SettingCard } from '../components/SettingsKit'
import { Caption, SectionTitle, BodyText } from '@/components/ui/typography'
import { getPlatformLimits, type TenantNearCapEntry } from './integrations/limitsApi'

// One "connector · percent" line per meter the tenant is near; tolerant of the
// nested `rows[]` form and the flat {connector, percent} form of the contract.
function tenantLines(entry: TenantNearCapEntry): Array<{ key: string; label: string; percent: number | null }> {
  if (Array.isArray(entry.rows)) return entry.rows.map(r => ({ key: r.key, label: r.label, percent: r.percent }))
  return [{ key: entry.connector ?? 'connector', label: entry.connector ?? '', percent: entry.percent ?? null }]
}

export default function AdminLimitsSettings() {
  const { t } = useTranslation('settings')

  // The platform sweep is cached server-side for five minutes; a minute here is plenty.
  const { data, isPending, isError } = useQuery({ queryKey: ['admin-limits'], queryFn: getPlatformLimits, staleTime: 60_000 })
  const platform = data?.platform ?? []
  const nearCap = data?.tenants_near_cap ?? []
  const skipped = data?.skipped_tenants?.count ?? 0

  return (
    <SettingsScaffold title={t('limits.platformTitle')} subtitle={t('limits.platformSubtitle')}
      maxWidth={720} form={{ loading: isPending, loadError: isError }} actions={undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* The sweep could not check every tenant: say so, never let them silently vanish. */}
        {skipped > 0 && (
          <CalloutBox variant="warning">{t('limits.skipped_tenants_notice', { count: skipped })}</CalloutBox>
        )}

        {platform.length === 0 ? (
          <Caption as="div">{t('limits.empty')}</Caption>
        ) : (
          <SettingCardList>
            {platform.map(row => (
              <SettingCard key={row.key}><LimitMeterRow meter={row} /></SettingCard>
            ))}
          </SettingCardList>
        )}

        <div>
          <SectionTitle style={{ marginBottom: 8 }}>{t('limits.tenants_at_limit')}</SectionTitle>
          {nearCap.length === 0 ? (
            <Caption as="div">{t('limits.tenantsAtLimitEmpty')}</Caption>
          ) : (
            <SettingCardList>
              {nearCap.map(entry => (
                <SettingCard key={entry.tenant_id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <BodyText style={{ fontWeight: 600 }}>{entry.tenant_name}</BodyText>
                  {tenantLines(entry).map(line => (
                    <Caption key={line.key} as="div">{line.label}{line.percent === null ? '' : ` · ${line.percent}%`}</Caption>
                  ))}
                </SettingCard>
              ))}
            </SettingCardList>
          )}
        </div>
      </div>
    </SettingsScaffold>
  )
}
