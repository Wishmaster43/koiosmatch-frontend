/**
 * outreachChannelMeta — the ONE icon + colour map for the outreach channel enum
 * (call / email / whatsapp). Fixed enum, not a tenant lookup, so the colours are
 * DATA rather than UI styling — extracted so OutreachList, OutreachBoard and
 * outreachCampaignFields all read the exact same map instead of three copies.
 */
import { Phone, Mail, MessageCircle } from 'lucide-react'
import type { ComponentType } from 'react'

// Icon + colour per outreach channel (soft-chip convention). Fixed enum
// palette, not tenant-brand colour, so the three hex values are DATA and sit
// under ONE block-form necessity disable (the same form the three former copies
// used). None of them has a house token that carries the same meaning without
// changing the rendered colour (--color-map is reserved for the
// Kaart/Blacklist/Gearchiveerd quick-view toggles per src/index.css, and
// --color-warning-text is a darkened AA-ink twin, not the plain warning colour).
/* eslint-disable no-restricted-syntax -- DATA: fixed channel-enum palette (call/email/whatsapp, incl. WhatsApp's real brand green), not UI styling */
export const CHANNEL_META: Record<string, { icon: ComponentType<{ size?: number; className?: string }>; color: string }> = {
  call:     { icon: Phone,         color: '#2563EB' },
  email:    { icon: Mail,          color: '#D97706' },
  whatsapp: { icon: MessageCircle, color: '#25D366' },
}
/* eslint-enable no-restricted-syntax */

// Lookup with the shared 'call' fallback for a missing/unknown channel value.
export function getChannelMeta(channel: string | null | undefined) {
  return CHANNEL_META[channel ?? 'call'] ?? CHANNEL_META.call
}
