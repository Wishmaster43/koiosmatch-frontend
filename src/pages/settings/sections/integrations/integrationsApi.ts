/**
 * integrationsApi — typed client for the Shiftmanager / HelloFlex / Werkzoeken
 * integration settings (INTEGRATIONS-SETTINGS-1). These routes are NOT yet in
 * src/types/api-generated.ts (BE lands them separately per the contract), so
 * every shape below is hand-written against
 * koiosmatch-api/docs/contract/INTEGRATIONS-CONTRACT.md (CLAUDE.md §10 type-gen
 * rule: hand-write what the generated spec doesn't cover).
 */
import api, { unwrap, unwrapList } from '@/lib/api'

// The three supported connectors (contract §1).
export type ConnectorId = 'shiftmanager' | 'helloflex' | 'werkzoeken'

// Per-connector GET /integrations/{connector}/settings shapes (contract §2).
export interface ShiftmanagerSettings {
  two_way: boolean
  base_url: string | null
  has_api_key: boolean
  connected_as: string | null
}

export interface HelloflexSettings {
  two_way: boolean
  environment: 'uat' | 'live'
  client_id: string | null
  has_client_secret: boolean
  connected_as: string | null
}

export interface WerkzoekenSettings {
  two_way: boolean
  has_api_key: boolean
  connected_as: string | null
}

// Maps a connector id to its settings shape, so callers get the right type.
export interface ConnectorSettingsMap {
  shiftmanager: ShiftmanagerSettings
  helloflex: HelloflexSettings
  werkzoeken: WerkzoekenSettings
}

// PUT body = the GET shape plus optional write-only secret fields. Absent or
// '' leaves the secret unchanged; explicit null clears it (contract §2, PUT).
export type ConnectorSettingsUpdate<C extends ConnectorId> = ConnectorSettingsMap[C] &
  (C extends 'shiftmanager'
    ? { api_key?: string | null }
    : C extends 'helloflex'
      ? { client_secret?: string | null }
      : { api_key?: string | null })

// POST /integrations/{connector}/test result shapes (contract §2).
export type TestReasonCode =
  | 'auth_failed'
  | 'unreachable'
  | 'timeout'
  | 'rate_limited'
  | 'invalid_config'
  | 'scope_missing'

export interface TestSuccess {
  ok: true
  connected_as: string
  details: Record<string, unknown>
}

export interface TestFailure {
  ok: false
  reason_code: TestReasonCode
  message: string
  correlation_id: string
}

export type TestResult = TestSuccess

// A single tenant mapping row (contract "Mappings").
export interface MappingRow {
  id: string
  connector: ConnectorId
  domain: string
  koios_value: string
  external_value: string
  is_default: boolean
}

// Fields accepted on create; is_default is optional (contract defaults it).
export interface CreateMappingBody {
  domain: string
  koios_value: string
  external_value: string
  is_default?: boolean
}

// Partial update — any subset of the create fields.
export type UpdateMappingBody = Partial<CreateMappingBody>

// One row of GET /integrations — the per-connector summary for the group
// (always served, enabled=false when the module is off; never secrets).
export interface IntegrationSummary {
  connector: ConnectorId
  enabled: boolean
  configured: boolean
  two_way: boolean
  connected_as: string | null
  last_sync_at: string | null
  health: 'ok' | 'error' | 'unknown'
}

// Fetch the connector list (contract §2, GET /api/integrations).
export async function getIntegrations(): Promise<IntegrationSummary[]> {
  const res = await api.get('/integrations')
  return unwrapList<IntegrationSummary>(res).rows
}

// Fetch a connector's current settings.
export async function getIntegrationSettings<C extends ConnectorId>(
  connector: C,
): Promise<ConnectorSettingsMap[C]> {
  const res = await api.get(`/integrations/${connector}/settings`)
  return unwrap<ConnectorSettingsMap[C]>(res)
}

// Persist a connector's settings. Sends the body exactly as given — no field
// invention or stripping — so callers control secret write/leave/clear intent.
export async function putIntegrationSettings<C extends ConnectorId>(
  connector: C,
  body: ConnectorSettingsUpdate<C>,
): Promise<ConnectorSettingsMap[C]> {
  const res = await api.put(`/integrations/${connector}/settings`, body)
  return unwrap<ConnectorSettingsMap[C]>(res)
}

// Trigger a live connection test. On 422 the axios error is thrown as-is so
// callers read error.response.data (TestFailure shape) themselves.
export async function testIntegration(connector: ConnectorId): Promise<TestResult> {
  // quietStatuses: the 422 is a contract-expected, caller-rendered outcome —
  // the A-7 dev guard must not double it with a raw toast (house convention).
  const res = await api.post(`/integrations/${connector}/test`, undefined, { quietStatuses: [422] })
  return unwrap<TestResult>(res)
}

// List mappings for one connector + domain.
export async function listMappings(
  connector: ConnectorId,
  domain: string,
): Promise<MappingRow[]> {
  const res = await api.get(`/integrations/${connector}/mappings`, { params: { domain } })
  return unwrapList<MappingRow>(res).rows
}

// Create a mapping row. 422 on duplicate (domain, koios_value) — thrown as-is.
export async function createMapping(
  connector: ConnectorId,
  body: CreateMappingBody,
): Promise<MappingRow> {
  const res = await api.post(`/integrations/${connector}/mappings`, body, { quietStatuses: [422] })
  return unwrap<MappingRow>(res)
}

// Partially update a mapping row.
export async function updateMapping(
  connector: ConnectorId,
  id: string,
  body: UpdateMappingBody,
): Promise<MappingRow> {
  const res = await api.put(`/integrations/${connector}/mappings/${id}`, body, { quietStatuses: [422] })
  return unwrap<MappingRow>(res)
}

// Delete a mapping row. Always allowed in v1 (contract: a later sync missing a
// mapping fails visibly on that row, never silently picks a default).
export async function deleteMapping(connector: ConnectorId, id: string): Promise<void> {
  await api.delete(`/integrations/${connector}/mappings/${id}`)
}
