import type { ComponentType, SVGProps } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle, Circle } from 'lucide-react'
import HelloFlexMark from './HelloFlexMark'
import ShiftManagerMark from './ShiftManagerMark'
import type { BackofficeLink } from '@/lib/backofficeLink'

// Both brand marks share the lucide-icon-shaped contract (size/title + native
// SVG props), so one type covers either one passed into CouplingMark below.
type BrandMark = ComponentType<{ size?: number; title?: string } & SVGProps<SVGSVGElement>>

// Compact footprint: a 14px brand mark (which system) + a 9px status glyph
// (which state) — small enough for a dense table row, never a text status column.
const MARK_SIZE = 14
const GLYPH_SIZE = 9

interface CouplingMarkProps {
  Mark: BrandMark
  link: BackofficeLink | null | undefined
  systemName: string
  notLinkedLabel: string
}

// One system's coupling cell. The brand mark always keeps its OWN colour (§0.11:
// a brand mark is DATA, not a themeable status colour) so the system stays
// recognisable regardless of state; the STATE (linked/failed/pending/never
// attempted) is carried by a separate glyph with its own SHAPE — never colour
// alone (§6) — Check / Alert / Circle read the same in greyscale. The mark's own
// <title> (rendered inside its <svg role="img">, see HelloFlexMark/ShiftManagerMark)
// is the element's real accessible name; the glyph is decorative reinforcement.
function CouplingMark({ Mark, link, systemName, notLinkedLabel }: CouplingMarkProps) {
  const { t } = useTranslation('common')
  const status = link?.status ?? null
  // Pending and "never attempted" both read as the same neutral outline glyph here —
  // a list is a scanning aid, not the full detail (that stays in the Koppelingen/
  // Links drawer tab); only linked/failed/never-attempted are the three states this
  // task calls out, so pending gets a distinct LABEL (still resolvable via
  // hover/screen reader) without inventing a fourth icon shape.
  const label = status === 'linked' ? `${systemName}: ${t('backofficeLinks.common.statusLinked')}`
    : status === 'failed' ? `${systemName}: ${t('backofficeLinks.common.statusFailed')}`
    : status === 'pending' ? `${systemName}: ${t('backofficeLinks.common.statusPending')}`
    : notLinkedLabel
  const Glyph = status === 'linked' ? CheckCircle2 : status === 'failed' ? AlertCircle : Circle
  const glyphColor = status === 'linked' ? 'var(--color-success)' : status === 'failed' ? 'var(--color-danger)' : status === 'pending' ? 'var(--color-warning)' : 'var(--text-muted)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Mark size={MARK_SIZE} title={label} />
      {/* Decorative: the mark's own aria-label already carries the accessible name. */}
      <Glyph size={GLYPH_SIZE} color={glyphColor} aria-hidden="true" />
    </span>
  )
}

export interface BackofficeCouplingIndicatorProps {
  helloflexLink?: BackofficeLink | null
  shiftmanagerLink?: BackofficeLink | null
  // Tenant app gate (mirrors BackofficeLinksTab's own isAppEnabled('hf'/'shiftmanager')):
  // a system the tenant never enabled is not shown at all, never rendered as "not linked".
  showHelloflex?: boolean
  showShiftmanager?: boolean
}

/**
 * BackofficeCouplingIndicator — the compact per-row scanning aid so a recruiter can
 * see, without opening the drawer, whether a record is linked/failed/not-linked to
 * HelloFlex and/or Shiftmanager (KOPPELINGEN-LIST-1). Reuses the existing brand marks
 * (HelloFlexMark/ShiftManagerMark) instead of a hand-rolled icon (§3A/§11 "extend,
 * never duplicate") — both were already built for the workflow-module picker and sat
 * unused everywhere else. Full detail (external id, who/when, retry) stays in the
 * BackofficeLinksTab drawer tab; this is scanning only, never a text status column.
 */
export default function BackofficeCouplingIndicator({
  helloflexLink, shiftmanagerLink, showHelloflex = true, showShiftmanager = true,
}: BackofficeCouplingIndicatorProps) {
  const { t } = useTranslation('common')
  if (!showHelloflex && !showShiftmanager) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {showHelloflex && (
        <CouplingMark Mark={HelloFlexMark} link={helloflexLink}
          systemName={t('backofficeLinks.helloflex.name')} notLinkedLabel={t('backofficeLinks.helloflex.notLinked')} />
      )}
      {showShiftmanager && (
        <CouplingMark Mark={ShiftManagerMark} link={shiftmanagerLink}
          systemName={t('backofficeLinks.shiftmanager.name')} notLinkedLabel={t('backofficeLinks.shiftmanager.notLinked')} />
      )}
    </span>
  )
}
