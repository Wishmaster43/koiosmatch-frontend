/**
 * useWhatsappTextTemplates (WA-WEB-TEMPLATES-1): the react-query read of the tenant's wa_web
 * text templates AND the bureau's placeholder names (list `meta`), shared by the settings screen
 * and the conversation composer. Tenant-keyed like useUsers, so a super admin switching bureau
 * never sees the previous bureau's list. `enabled: false` keeps a caller without the whatsapp
 * page from firing a 403 (USERS-403-1).
 */
import { useQuery } from '@tanstack/react-query'
import { getActiveTenantId } from '@/lib/api'
import { listWhatsappTextTemplates, type WhatsappTextTemplate } from './whatsappTextTemplatesApi'

// ONE frozen empty array per shape, never a fresh [] per render (stable identity for effect deps).
const EMPTY_ROWS: WhatsappTextTemplate[] = []
const EMPTY_PLACEHOLDERS: string[] = []

// The query key, exported so the mutations in the settings screen can invalidate it.
export const whatsappTextTemplatesKey = (tenantId: string | null) => ['whatsapp-text-templates', tenantId ?? 'none'] as const

// Lists the templates + placeholders; `enabled` gates the request on the caller's own permission check.
export function useWhatsappTextTemplates(enabled = true) {
  const tenantId = getActiveTenantId()
  const query = useQuery({
    queryKey: whatsappTextTemplatesKey(tenantId),
    queryFn: ({ signal }) => listWhatsappTextTemplates(signal),
    enabled,
    retry: false,
    // The list changes only through Settings; a minute of freshness keeps a thread open from refetching every time.
    staleTime: 60_000,
  })
  return { ...query, templates: query.data?.rows ?? EMPTY_ROWS, placeholders: query.data?.placeholders ?? EMPTY_PLACEHOLDERS, tenantId }
}
