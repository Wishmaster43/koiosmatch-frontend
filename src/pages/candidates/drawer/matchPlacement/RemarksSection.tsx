/**
 * RemarksSection — the "Opmerkingen" block of the placement form, its OWN card
 * (Danny 24-07: split out of FinancialSection into its own left-column block
 * "zodat het beter past"). Starts COLLAPSED ("dicht geklapt laten") — a dashed
 * ghost affordance, not the RichTextEditor itself — and only reveals the editor
 * on an explicit click; never auto-opens. Mirrors the candidate profile summary
 * / vacancy description's pencil-to-edit idiom (ProfileTab/DescriptionTab),
 * simplified to a one-way reveal since a fresh create-form field has no prior
 * saved value to preview back. Pure presentational, all state via props from
 * useMatchPlacementForm.
 */
import { Pencil } from 'lucide-react'
import type { TFunction } from 'i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'

export default function RemarksSection({
  t, remarks, setRemarks, remarksExpanded, setRemarksExpanded, remarksEditing, setRemarksEditing,
}: {
  t: TFunction
  remarks: string; setRemarks: (v: string) => void
  remarksExpanded: boolean; setRemarksExpanded: (fn: (v: boolean) => boolean) => void
  remarksEditing: boolean; setRemarksEditing: (v: boolean) => void
}) {
  return remarksEditing ? (
    // Rich-text block (house rule, CLAUDE.md §3A/§4), not a bare textarea —
    // stored/POSTed as sanitised HTML.
    <RichTextEditor value={remarks} onChange={setRemarks}
      expanded={remarksExpanded} onToggleExpand={() => setRemarksExpanded(v => !v)} />
  ) : (
    // Collapsed ghost affordance (dashed border, mirrors SearchSelect's default
    // trigger) — clicking reveals the editor; never opens on its own.
    <button type="button" onClick={() => setRemarksEditing(true)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
        padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--bg)',
        cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
      <span>{t('placement.remarksAdd')}</span>
      <Pencil size={13} />
    </button>
  )
}
