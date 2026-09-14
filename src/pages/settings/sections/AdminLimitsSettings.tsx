/**
 * AdminLimitsSettings — Super Admin → Platform limits (LIMIET-MONITOR-1 +
 * LIMITS-BEHEER-1): editable platform-default cap/mode per connector
 * (AdminLimitsTable), the tenants at or near their own cap (click opens
 * TenantLimitsDrawer for that tenant), a tenant search to open any tenant's
 * drawer directly, and a calm notice when the sweep skipped tenants. Polls no
 * faster than once a minute.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import CalloutBox from '@/components/ui/CalloutBox'
import SearchSelect from '@/components/ui/SearchSelect'
import { SettingsScaffold, SettingCardList, SettingCard } from '../components/SettingsKit'
import { Caption, SectionTitle, BodyText } from '@/components/ui/typography'
import { useTenantSearch } from '@/hooks/useTenantSearch'
import { getPlatformLimits, type TenantNearCapEntry } from './integrations/limitsApi'
import AdminLimitsTable from './integrations/AdminLimitsTable'
import TenantLimitsDrawer from './integrations/TenantLimitsDrawer'

// One "connector · percent" line per meter the tenant is near; tolerant of the
// nested `rows[]` form and the flat {connector, percent} form of the contract.
function tenantLines(entry: TenantNearCapEntry): Array<{ key: string; label: string; percent: number | null }> {
  if (Array.isArray(entry.rows)) return entry.rows.map(r => ({ key: r.key, label: r.label, percent: r.percent }))
  return [{ key: entry.connector ?? 'connector', label: entry.connector ?? '', percent: entry.percent ?? null }]
}

export default function AdminLimitsSettings() {
  const { t } = useTranslation('settings')
  const { options: tenantOptions, onSearch: onTenantSearch } = useTenantSearch()
  // The tenant currently opened in the drawer (from a near-cap row or the search picker).
  const [drawerTenant, setDrawerTenant] = useState<{ id: string; name: string } | null>(null)

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
          <AdminLimitsTable rows={platform} />
        )}

        <div>
          <SectionTitle style={{ marginBottom: 8 }}>{t('limits.tenant_drawer.pick_label')}</SectionTitle>
          <div style={{ maxWidth: 320, marginBottom: 16 }}>
            <SearchSelect options={tenantOptions} selected={[]} onSearch={onTenantSearch}
              closeOnToggle triggerLabel={t('limits.tenant_drawer.pick_placeholder')}
              onToggle={(id) => {
                const found = tenantOptions.find(o => o.value === id)
                setDrawerTenant({ id, name: found?.label ?? id })
              }} />
          </div>

          <SectionTitle style={{ marginBottom: 8 }}>{t('limits.tenants_at_limit')}</SectionTitle>
          {nearCap.length === 0 ? (
            <Caption as="div">{t('limits.tenantsAtLimitEmpty')}</Caption>
          ) : (
            <SettingCardList>
              {nearCap.map(entry => (
                // role="button": a near-cap card opens that tenant's drawer — keyboard-operable too (§6).
                <div key={entry.tenant_id} role="button" tabIndex={0} style={{ cursor: 'pointer' }}
                  onClick={() => setDrawerTenant({ id: entry.tenant_id, name: entry.tenant_name })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDrawerTenant({ id: entry.tenant_id, name: entry.tenant_name }) }}>
                  <SettingCard style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <BodyText style={{ fontWeight: 600 }}>{entry.tenant_name}</BodyText>
                    {tenantLines(entry).map(line => (
                      <Caption key={line.key} as="div">{line.label}{line.percent === null ? '' : ` · ${line.percent}%`}</Caption>
                    ))}
                  </SettingCard>
                </div>
              ))}
            </SettingCardList>
          )}
        </div>
      </div>

      {drawerTenant && (
        <TenantLimitsDrawer tenantId={drawerTenant.id} tenantName={drawerTenant.name} onClose={() => setDrawerTenant(null)} />
      )}
    </SettingsScaffold>
  )
}
