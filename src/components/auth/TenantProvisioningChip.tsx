/**
 * TenantProvisioningChip — soft chip that says a bureau is still being set up or failed to.
 * Renders nothing for a ready bureau. Dumb: the caller decides disabling.
 */
import { useTranslation } from 'react-i18next'
import SoftChip from '@/components/ui/SoftChip'
import type { ProvisioningStatus } from '@/lib/tenantProvisioning'

export default function TenantProvisioningChip({ status }: { status: ProvisioningStatus | undefined }) {
  const { t } = useTranslation('auth')
  if (status === 'pending') return <SoftChip color="var(--color-warning)" label={t('tenantPick.statusPending')} />
  if (status === 'failed') return <SoftChip color="var(--color-danger)" label={t('tenantPick.statusFailed')} />
  return null
}
