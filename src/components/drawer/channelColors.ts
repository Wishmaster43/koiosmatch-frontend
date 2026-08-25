/**
 * channelColors — K-193: the three WhatsApp channel enum values each read their
 * own semantic token (colour is never the only signal: the chip label carries
 * the name). Shared by the message bubble and the thread header; anything
 * outside the enum renders no chip at all, never a raw code.
 */
export const CHANNEL_COLORS: Record<string, string> = {
  waba: 'var(--color-primary)',
  waba_coex: 'var(--color-secondary)',
  wa_web: 'var(--color-info)',
}
