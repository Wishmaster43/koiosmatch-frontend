/**
 * LocationBadge — the small identity tile in front of a branch (vestiging) name.
 *
 * VESTIGING-ICOON-1 (Danny 28-07): `locations.color`/`locations.icon` now exist
 * end-to-end (LocationResource + Store/UpdateLocationRequest, verified against the
 * running DB) — this badge renders the row's OWN colour/icon when the backend has
 * them. Older rows saved before these columns landed still have neither, so they
 * fall back to the same deterministic avatarColor hash + Building2 glyph this
 * badge always used (§11 reuse — one hash helper, shared with Avatar/Shiftmanager
 * entities), so every row stays identifiable at a glance either way.
 *
 * Its own file so the fallback reasoning lives with the visual, not inside the
 * table that happens to be today's only caller.
 */
import { Building2 } from 'lucide-react'
// Deterministic per-row colour hash — the SAME helper as Avatar/Shiftmanager
// entities (§11: reuse, never a second hash).
import { avatarColor } from '@/lib/avatarColor'
import { resolveLocationIcon } from '@/lib/locationIcons'

// Renders a branch's own colour/icon when the backend has them (see file docblock
// above), falling back to the shared deterministic hash for older rows without either.
export default function LocationBadge({ name, color, icon }) {
  const resolvedColor = color || avatarColor(name)
  const Icon = icon ? resolveLocationIcon(icon) : Building2
  return (
    <span aria-hidden="true" style={{ width: 26, height: 26, flexShrink: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center', borderRadius: 7,
      background: `color-mix(in srgb, ${resolvedColor} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${resolvedColor} 45%, transparent)`, color: resolvedColor }}>
      <Icon size={13} />
    </span>
  )
}
