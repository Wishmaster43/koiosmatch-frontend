/**
 * statusMeta — pure mapping from a device status to its dot colour + i18n label
 * key (under the `profile.whatsappWeb` namespace). Kept separate so both the
 * device card and any future status badge read the same source of truth.
 *
 * Backend status ∈ disconnected | connecting | qr_pending | connected (K-193 fase 1).
 */

// The device lifecycle status as returned by the backend.
export type DeviceStatus = 'disconnected' | 'connecting' | 'qr_pending' | 'connected'

// Warm-up stages (App\Messaging\WarmupStage, CMBE 25-08): 1 = new number
// (strictest daily cap), 2 = warming up, 0 = fully ramped (lane caps only).
// Stage 0 never shows a chip; 1 and 2 do. The server also ships a `warmup`
// object {stage, label, daily_cap}; the label is i18n-keyed on the stage with
// the server's (nl) label only as fallback.
export type WarmupStage = 0 | 1 | 2
export interface WarmupInfo { stage: WarmupStage; label?: string | null; daily_cap?: number | null }

// One linked WhatsApp Web device for the logged-in user (K-193 fase 1 shape).
export interface WhatsAppDevice {
  id: string | number
  type: 'wa_web'
  label: string | null
  phone_number: string | null
  status: DeviceStatus
  qr?: string | null
  warmup_stage?: WarmupStage | null
  warmup?: WarmupInfo | null
  daily_cap?: number | null
  weekly_cap?: number | null
  hourly_cap?: number | null
  last_connected_at?: string | null
}

// Status → dot token + i18n label key, all design tokens (§4), never hex.
export const STATUS_META: Record<DeviceStatus, { dot: string; labelKey: string }> = {
  connected:    { dot: 'var(--color-success)', labelKey: 'connected' },
  qr_pending:   { dot: 'var(--color-warning)', labelKey: 'waiting' },
  connecting:   { dot: 'var(--color-warning)', labelKey: 'connecting' },
  disconnected: { dot: 'var(--text-muted)',    labelKey: 'disconnected' },
}

// Statuses that are still "in progress" — the list must keep polling for these.
export const TRANSIENT_STATUSES: DeviceStatus[] = ['connecting', 'qr_pending']

// Warm-up stages with a known label. Stage 0 ("not warming") is deliberately
// excluded — see the WarmupStage comment above; an unlisted stage renders no chip.
export const WARMUP_STAGES: WarmupStage[] = [1, 2]
