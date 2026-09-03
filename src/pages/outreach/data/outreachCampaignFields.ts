/**
 * outreachCampaignFields — the fixed status/channel enums (not tenant lookups,
 * hence the hardcoded colours) and the small row-field readers shared by the
 * outreach page's filter and insights hooks. Extracted from OutreachPage.tsx
 * (§0.3 size split) so both hooks read the exact same vocabulary/derivation.
 */
import type { Campaign } from '../hooks/useOutreachCampaigns'

// Fixed status enum (not a tenant lookup) → board columns, donut + colours (hex for the chart).
/* eslint-disable no-restricted-syntax -- DATA: fixed status/channel colour maps (incl. WhatsApp's real brand green), not UI styling */
export const STATUSES = [
  { key: 'draft',  color: '#9CA3AF' },
  { key: 'active', color: '#16A34A' },
  { key: 'done',   color: '#2563EB' },
]
export const CHANNELS = [
  { key: 'call',     color: '#2563EB' },
  { key: 'email',    color: '#D97706' },
  { key: 'whatsapp', color: '#25D366' },
]
/* eslint-enable no-restricted-syntax */

// Row-field readers — tolerant defaults for rows that predate a field.
export const statusKey  = (c: Campaign) => c.status ?? 'draft'
export const channelKey = (c: Campaign) => c.channel ?? 'call'
export const targetsOf  = (c: Campaign) => c.targets_count ?? c.target_count ?? 0
// Owner name reads defensively — a campaign row may carry either a nested
// object or a flat owner_name field depending on which endpoint populated it.
export const ownerNameOf = (c: Campaign) => (c.owner as { name?: string } | null)?.name ?? (c as Record<string, unknown>).owner_name as string | undefined ?? ''
// Target group = the source talent pool the campaign was seeded from. The real
// field (OutreachCampaignResource::toArray) is the flat `pool_name` string —
// confirmed by CMBE 2026-08-13, replacing the earlier tolerant
// pool/from_pool/target_group guesswork that never matched a real API shape.
export const targetGroupNameOf = (c: Campaign) => (c as Record<string, unknown>).pool_name as string | undefined ?? ''
