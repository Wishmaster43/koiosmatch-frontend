/**
 * smParts — building blocks shared across the Shiftmanager parts modules
 * (departmentParts/locationParts). Only the square initial-avatar is
 * byte-identical between them (size/radius differ per caller, carried as
 * props); the STATUS_COLORS maps stay local because their keys differ
 * per entity (DRY round 11, SHIFTMANAGER).
 */
import { avatarColor as ac } from '@/lib/avatarColor'

// Square initial-avatar — deterministic background colour from the label,
// size/radius supplied by the caller so each parts module keeps its own default.
export function SmInitialBubble({ label, size, radius }: { label?: string; size: number; radius: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: ac(label), display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--surface)', fontSize: size * 0.34, fontWeight: 700 }}>
      {(label || '?').charAt(0).toUpperCase()}
    </div>
  )
}
