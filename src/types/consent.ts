// Shared consent contract types (K-008 CONSENT-OPTIN-1): read-only, server-derived.

/** Per-channel consent state as the backend derives it. */
export type ConsentState = 'granted' | 'refused' | 'not_asked' | 'unconfirmed'

const CONSENT_STATES: readonly string[] = ['granted', 'refused', 'not_asked', 'unconfirmed']

/** Type guard: true only for the four documented state strings. */
export function isConsentState(x: unknown): x is ConsentState {
  return typeof x === 'string' && CONSENT_STATES.includes(x)
}

/** GDPR first-contact notice: when it was sent and whether the next send must carry it (null = BE did not say). */
export interface PrivacyNotice {
  sentAt: string | null
  due: boolean | null
}

/** Tolerant reader for the raw `privacy_notice` block; a missing block never fabricates a verdict. */
export function readPrivacyNotice(raw: unknown): PrivacyNotice {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { sent_at?: unknown; due?: unknown }
  return {
    sentAt: typeof r.sent_at === 'string' ? r.sent_at : null,
    due: typeof r.due === 'boolean' ? r.due : null,
  }
}
