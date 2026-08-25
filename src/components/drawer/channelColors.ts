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
