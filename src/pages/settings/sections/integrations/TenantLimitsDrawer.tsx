/**
 * TenantLimitsDrawer — the super-admin per-tenant limits panel (LIMITS-BEHEER-1
 * contract §3/§4): opened from AdminLimitsSettings on a chosen tenant, shows every
 * row of GET /admin/tenants/{tenant}/limits (usage bar, cap+mode override, cap
 * source, approval) and the ApprovalPanel per connector. `tenant_settable: false`
 * rows (wa_web/anthropic/whatsapp/opencage per the contract) render read-only.
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CalloutBox from '@/components/ui/CalloutBox'
import LimitMeterRow from '@/components/ui/LimitMeterRow'
import Spinner from '@/components/ui/Spinner'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'
import { getAdminTenantLimits, putAdminTenantLimits, type AdminTenantLimitRow } from './limitsApi'
import CapModeEditorRow from './CapModeEditorRow'
import { useCapModeSave, type CapModeDraft } from './useCapModeSave'
import ApprovalPanel from './ApprovalPanel'

const draftFromRow = (row: AdminTenantLimitRow): CapModeDraft => ({ cap: row.cap_source === 'tenant' ? row.cap : null, mode: row.mode })

// One connector row: usage meter, cap/mode override (cap=null inherits the platform default), the approval panel.
function TenantConnectorRow({ tenantId, row }: { tenantId: string; row: AdminTenantLimitRow }) {
  const { t } = useTranslation('settings')
  const { draft, setDraft, saved, saving, dirty, error, save } = useCapModeSave(
    draftFromRow(row),
    (d: CapModeDraft) => putAdminTenantLimits(tenantId, [{ connector: row.connector, cap: d.cap, mode: d.mode }]),
    ['admin-tenant-limits', tenantId],
    t('limits.save_error'),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <LimitMeterRow meter={row} />
      <Caption>{t('limits.cap_source', { source: t(`limits.cap_source_value.${row.cap_source}`, row.cap_source) })}</Caption>
      {!row.tenant_settable ? (
        <CalloutBox variant="info">{t('limits.not_tenant_scoped_notice')}</CalloutBox>
      ) : (
        <CapModeEditorRow draft={draft} onChange={setDraft} dirty={dirty} saved={saved} saving={saving} error={error}
          modeFixed={row.mode_fixed} capPlaceholder={t('limits.inherit_platform')}
          capAriaLabel={t('limits.platform.capLabel', { label: row.label })}
          onSave={() => save()} />
      )}
      {/* Grant form only where a POST can succeed (contract §3: not_tenant_scoped
          422s on wa_web/anthropic/whatsapp/opencage) — the read-only badge still shows either way. */}
      {row.tenant_settable ? (
        <ApprovalPanel tenantId={tenantId} connector={row.connector} approval={row.approval} />
      ) : row.approval ? (
        <ApprovalPanel tenantId={tenantId} connector={row.connector} approval={row.approval} readOnly />
      ) : null}
    </div>
  )
}

export default function TenantLimitsDrawer({ tenantId, tenantName, onClose }: { tenantId: string; tenantName: string; onClose: () => void }) {
  const { t } = useTranslation('settings')
  const { data, isPending, isError } = useQuery({
    queryKey: ['admin-tenant-limits', tenantId],
    queryFn: () => getAdminTenantLimits(tenantId),
  })

  return (
    <FloatingPanel open onClose={onClose} title={t('limits.tenant_drawer.title', { tenant: tenantName })}
      persistKey="admin-tenant-limits-drawer" width={520} maxWidth="min(92vw, 640px)">
      {isPending && <Spinner />}
      {isError && <ErrorBanner>{t('common.loadError')}</ErrorBanner>}
      {!isPending && !isError && (data ?? []).length === 0 && <Caption as="div">{t('limits.empty')}</Caption>}
      {!isPending && !isError && (data ?? []).map(row => (
        <TenantConnectorRow key={row.connector} tenantId={tenantId} row={row} />
      ))}
    </FloatingPanel>
  )
}
