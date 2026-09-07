/**
 * useWhatsAppWebHealth — reads GET /whatsapp-web/health for the two device
 * surfaces (profile + settings). Only the gateway verdict is used here:
 * `configured` (WAHA_BASE_URL set) and `reachable` (the gateway answered). A
 * 403/404 means the page permission or module is off: no banner, no error.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface WhatsAppWebGateway {
  configured: boolean
  reachable: boolean
}

// Pull the HTTP status off an axios-style error without leaking the rest.
const statusOf = (e: unknown) => (e as { response?: { status?: number } })?.response?.status

export function useWhatsAppWebHealth() {
  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-web-health'],
    queryFn: async ({ signal }): Promise<WhatsAppWebGateway | null> => {
      try {
        const res = await api.get('/whatsapp-web/health', { signal })
        const g = res?.data?.gateway
        return g ? { configured: Boolean(g.configured), reachable: Boolean(g.reachable) } : null
      } catch (e) {
        // Permission/module off: the surfaces render without a banner.
        if ([403, 404].includes(statusOf(e) ?? 0)) return null
        // The health route itself failed: treat the gateway as configured-but-unreachable.
        return { configured: true, reachable: false }
      }
    },
    retry: false,
    staleTime: 30_000,
  })
  const gateway = data ?? null
  // True when linking cannot work right now (not configured, or not answering).
  const gatewayDown = gateway != null && (!gateway.configured || !gateway.reachable)
  return { gateway, gatewayDown, loading: isLoading }
}
