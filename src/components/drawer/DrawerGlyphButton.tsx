/**
 * DrawerGlyphButton — the raw title-row icon glyph shared by candidate/customer
 * merge+archive, match archive+mark-deletion and outreach mark-deletion.
 */
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MouseEventHandler, ReactNode } from 'react'

// Tone → ink colour (frozen calm-header glyph control, Danny 08-08): muted for the
// merge icon, danger for archive/delete — opacity travels separately since it
// differs per call site (0.8 merge, 0.7 archive, none on the trash mark-deletion icon).
const TONE_COLOR: Record<'muted' | 'danger', string> = {
  muted: 'var(--text-muted)',
  danger: 'var(--color-danger-text)',
}

interface DrawerGlyphButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>
  title: string
  tone: 'muted' | 'danger'
  opacity?: number
  children: ReactNode
}

// DRY round 11, DRAWERS: the deliberate bare 14px icon button used by every drawer
// title row (Button iconOnly's 28px chrome would change the frozen calm-header
// look) — merged from candidates/customers ("frozen calm-header glyph control")
// and matches ("danger-ink ghost icon: no Button tone carries danger ink on a
// bare face"), one necessity-disable instead of four.
export default function DrawerGlyphButton({ onClick, title, tone, opacity, children }: DrawerGlyphButtonProps) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen calm-header glyph control (Danny 08-08): deliberate bare 14px icon; no Button tone carries danger ink on a bare face either (ghost=neutral, dangerSoft=tinted); Button iconOnly's 28px chrome would change the frozen look
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: TONE_COLOR[tone], opacity }}>
      {children}
    </button>
  )
}

// TRASH-OVERAL-2: the "mark for deletion" glyph — archived → trash — shared by
// every entity drawer's title row (matches, outreach, …). Hidden once the
// permission is absent (§7: no fake affordance) or the record is already in
// the trash.
export function MarkDeletionGlyphButton<TId extends string | number>({ onMarkDeletion, id, archived, inTrash }: {
  onMarkDeletion?: (id: TId) => void
  id: TId | undefined
  archived: boolean
  inTrash: boolean
}) {
  const { t } = useTranslation('common')
  if (!onMarkDeletion || !archived || inTrash || id == null) return null
  return (
    <DrawerGlyphButton onClick={() => onMarkDeletion(id)} title={t('trash.markAction')} tone="danger">
      <Trash2 size={14} />
    </DrawerGlyphButton>
  )
}
