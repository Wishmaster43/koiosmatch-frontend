/**
 * idempotency — one key per logical submit (DOUBLE-SUBMIT-FE-1 point 2, BE IDEMP-1):
 * an irreversible action (start a workflow, send a message, send a contract, propose,
 * finalise an invoice) sends an `Idempotency-Key` generated at the CLICK; the client's
 * own retries of that call (419 re-prime, 409 request_in_flight) keep the same config
 * and therefore the same key, so the server replays the first answer instead of acting
 * twice (`Idempotent-Replayed: true`). A later click is a new submit and a new key.
 */
import type { AxiosRequestConfig } from 'axios'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

// A fresh UUID per submit; the fallback only exists for engines without crypto.randomUUID.
export function newIdempotencyKey(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

// Merges a per-submit key into a request config without touching the caller's other options.
export function withIdempotencyKey<T extends AxiosRequestConfig>(config?: T, key: string = newIdempotencyKey()): T {
  const headers = { ...((config?.headers as Record<string, unknown> | undefined) ?? {}), [IDEMPOTENCY_HEADER]: key }
  return { ...(config ?? {}), headers } as unknown as T
}

// True when the server answered a replay of an earlier identical submit (a success, not an error).
export function isIdempotentReplay(response: { headers?: Record<string, unknown> } | null | undefined): boolean {
  const h = response?.headers ?? {}
  const v = (h['idempotent-replayed'] ?? h['Idempotent-Replayed']) as unknown
  return v === true || v === 'true' || v === '1'
}
