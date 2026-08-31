/**
 * channelColors — K-193: the three WhatsApp channel enum values each read their
 * own semantic token (colour is never the only signal: the chip label carries
 * the name). Shared by the message bubble and the thread header; anything
 * outside the enum renders no chip at all, never a raw code.
 */
// The enum in its canonical order, for charts that stack or list all three.
export const CHANNEL_KEYS = ['waba', 'waba_coex', 'wa_web'] as const

export const CHANNEL_COLORS: Record<string, string> = {
  waba: 'var(--color-primary)',
  waba_coex: 'var(--color-secondary)',
  wa_web: 'var(--color-info)',
}

// PUNT-2 (BE 0a8521df): owner-stempel van een beurt — Koios blijft het gezicht
// (engine = primary, workflow = de AI-modulefamilie violet, human = muted).
// Gedeeld door de bericht-badge (ConversationMessage) en de thread-kop
// (ConversationsSection); onbekende waarden renderen nergens.
export const HANDLED_BY_COLORS: Record<string, string> = {
  engine: 'var(--color-primary)',
  workflow: 'var(--color-violet)',
  human: 'var(--text-muted)',
}

