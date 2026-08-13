/**
 * candidateGenerateApi — GENERATE-FIELDS-1 (13-08): thin API layer for the
 * generic Koios text generator. Hand-typed: openapi export lags (13-08), shape
 * per CONTRACT-CHANGELOG PARSE-RAWTEXT-1 / KoiosEntityGenerateController (§10).
 * POST /ai/koios/generate returns a CONCEPT only — nothing here persists;
 * the caller applies it to the profile text draft exactly like GenerateDescriptionFlow.
 */
import api from '@/lib/api'

export interface GenerateFromFieldsPayload {
  entity: 'candidate'
  // Flat string map only — max 30 keys, key <=64 chars, value <=2000 chars
  // (server-enforced; the caller is expected to already respect this).
  fields: Record<string, string>
  instructions?: string
}

interface ApiGenerateResponse { text?: string }

/**
 * 402 = tenant AI credit exhausted, 503 = the Koios service is down right now —
 * both real, expected outcomes (never a stale null); `quietStatuses` keeps the
 * dev console/toast calm for them, mirroring vacancyGenerateApi's convention.
 */
export async function generateFromFields(payload: GenerateFromFieldsPayload, signal?: AbortSignal): Promise<string> {
  const res = await api.post<ApiGenerateResponse>('/ai/koios/generate', payload, { signal, timeout: 60000, quietStatuses: [402, 503] })
  return res.data.text ?? ''
}
