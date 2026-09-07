/**
 * WhatsAppWebGatewayBanner — the calm notice above a WhatsApp Web device list
 * when linking cannot work: the gateway is not configured on this platform, or
 * it is configured but not answering. Renders nothing while the gateway is fine.
 */
import { useTranslation } from 'react-i18next'
import CalloutBox from '@/components/ui/CalloutBox'
import type { WhatsAppWebGateway } from './useWhatsAppWebHealth'

export default function WhatsAppWebGatewayBanner({ gateway }: { gateway: WhatsAppWebGateway | null }) {
  const { t } = useTranslation('auth')
  if (!gateway || (gateway.configured && gateway.reachable)) return null
  // Not configured is a platform fact (info); configured-but-down is a warning.
  return (
    <div style={{ marginBottom: 12 }}>
      {gateway.configured
        ? <CalloutBox variant="warning">{t('profile.whatsappWeb.gatewayUnreachable')}</CalloutBox>
        : <CalloutBox variant="info">{t('profile.whatsappWeb.gatewayNotConfigured')}</CalloutBox>}
    </div>
  )
}
