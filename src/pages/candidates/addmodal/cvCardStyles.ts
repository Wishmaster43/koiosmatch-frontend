/**
 * cvCardStyles — style constants shared by the CV-parse progress cards
 * (CvUploadCard, PasteCvCard). A value module of its own so the presentational
 * cards keep a type-only edge to useCvParse (which owns the axios client) and
 * fields.tsx keeps its component exports clean (DRY round 11, CREATEHOOKS).
 */
import { BTN_H } from '@/config/buttonMetrics'

// Ghost button used for cancel / retry / another-CV — one style, three labels per card.
export const ghostBtn = {
  height: BTN_H, padding: '0 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'none', color: 'var(--text)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
} as const
