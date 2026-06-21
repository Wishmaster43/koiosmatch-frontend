/**
 * statusMeta — pure mapping from a device status to its dot colour + i18n label
 * key (under the `profile.whatsappWeb` namespace). Kept separate so both the
 * device card and any future status badge read the same source of truth.
 *
 * Backend status ∈ disconnected | connecting | qr_pending | connected.
 */
export const STATUS_META = {
  connected:    { dot: 'var(--color-success)', labelKey: 'connected' },
  qr_pending:   { dot: 'var(--color-warning)', labelKey: 'waiting' },
  connecting:   { dot: 'var(--color-warning)', labelKey: 'connecting' },
  disconnected: { dot: 'var(--text-muted)',    labelKey: 'disconnected' },
}

// Statuses that are still "in progress" — the list must keep polling for these.
export const TRANSIENT_STATUSES = ['connecting', 'qr_pending']
