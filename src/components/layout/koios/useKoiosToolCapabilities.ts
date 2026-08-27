/**
 * useKoiosToolCapabilities — the ONE React Query wrapper around GET
 * /ai/koios/capabilities (KOIOS-AGENT-FE-1). Every consumer shares this cache:
 * the settings KoiosCapabilitiesCard (full payload + optimistic tool patches via
 * setQueryData) and KoiosPendingActionCard (the connection_active gate).
 * §10 note: the generated api-generated.ts only carries the 401 shape for this
 * route, so the payload below is hand-typed against the measured contract
 * (WORKLIST KOIOS-CAPABILITIES-FE-1) — the single hand-typed source, never
 * re-declared per consumer.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

// One tool entry — the full measured contract (settings card needs every field).
export interface KoiosCapabilityTool {
  name: string
  label_nl: string
  kind?: string | null
  confirm_required: boolean
  enabled_for_me: boolean
  enabled_for_tenant: boolean
  default_enabled: boolean
  connection_active: boolean | null
  connection: 'whatsapp' | 'shiftmanager' | 'helloflex' | 'pdok' | null
}

export interface KoiosCapabilities {
  surfaces: string[]
  tools: KoiosCapabilityTool[]
  limits: Record<string, unknown>
  models: { active_flavor: string; flavors: string[] }
}

// Shared query key — optimistic writers (the settings card's patchTool) address
// the same cache entry via queryClient.setQueryData with this key.
export const KOIOS_CAPABILITIES_QUERY_KEY = ['koios', 'capabilities'] as const

// The one fetch for this payload (unwrap peels the {data:...} envelope).
export const getKoiosCapabilities = () =>
  api.get('/ai/koios/capabilities').then(unwrap) as Promise<KoiosCapabilities>

// Deep-link hashes for a tool's backing integration — the single map (only
// WhatsApp has a confirmed settings screen today; the others speak through an
// honest title until their sections exist).
export const KOIOS_CONNECTION_HASH: Record<string, string> = { whatsapp: '#settings/whatsapp/whatsapp' }

// Shared cache read — loading/error surface so gates can render HONEST interim
// states instead of silently failing open (Opus-vondst: gate failed open).
export function useKoiosToolCapabilities() {
  const query = useQuery({
    queryKey: KOIOS_CAPABILITIES_QUERY_KEY,
    queryFn: getKoiosCapabilities,
    staleTime: 60_000,
  })
  return {
    capabilities: query.data ?? null,
    tools: query.data?.tools ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

// Convenience: one tool's entry, or undefined while unknown.
export const findToolCapability = (tools: KoiosCapabilityTool[], name: string | undefined) =>
  name ? tools.find((t) => t.name === name) : undefined
