/**
 * statusMeta — pure mapping from a device status to its dot colour + i18n label
 * key (under the `profile.whatsappWeb` namespace). Kept separate so both the
 * device card and any future status badge read the same source of truth.
 *
 * Backend status ∈ disconnected | connecting | qr_pending | connected.
 */

// The device lifecycle status as returned by the backend.
export type DeviceStatus = 'disconnected' | 'connecting' | 'qr_pending' | 'connected'

// One linked WhatsApp Web device session for the logged-in user.
export interface WhatsAppDevice {
  id: string | number
  status: DeviceStatus
  qr?: string
  phone?: string
}

export const STATUS_META: Record<DeviceStatus, { dot: string; labelKey: string }> = {
  connected:    { dot: 'var(--color-success)', labelKey: 'connected' },
  qr_pending:   { dot: 'var(--color-warning)', labelKey: 'waiting' },
  connecting:   { dot: 'var(--color-warning)', labelKey: 'connecting' },
  disconnected: { dot: 'var(--text-muted)',    labelKey: 'disconnected' },
}

// Statuses that are still "in progress" — the list must keep polling for these.
export const TRANSIENT_STATUSES: DeviceStatus[] = ['connecting', 'qr_pending']
