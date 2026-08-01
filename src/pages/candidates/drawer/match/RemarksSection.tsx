/**
 * RemarksSection — the "Opmerkingen" block of the match form, its OWN card
 * (Danny 24-07: split out of FinancialSection into its own left-column block
 * "zodat het beter past"). Starts COLLAPSED ("dicht geklapt laten") — a dashed
 * ghost affordance, not the RichTextEditor itself — and only reveals the editor
 * on an explicit click; never auto-opens. Cancel (✕) reverts to the text as it
 * was when the editor opened and collapses again (Danny 24-07: "je moet ook
 * weer kunnen annuleren"), mirroring the house pencil ↔ ✕ idiom. Pure
 * presentational, all state via props from useMatchForm.
 */
import { useRef } from 'react'
import { Pencil, X } from 'lucide-react'
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
  // Snapshot at open, so ✕ can revert unsaved edits (form-local, no server call).
  const openedWithRef = useRef('')

  const open = () => { openedWithRef.current = remarks; setRemarksEditing(true) }
  const cancel = () => { setRemarks(openedWithRef.current); setRemarksEditing(false) }

  return remarksEditing ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Cancel above the block, house in-place-edit idiom (§3A). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={cancel} title={t('common:cancel')} aria-label={t('common:cancel')}
          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, cursor: 'pointer', background: 'var(--bg)', color: 'var(--text-muted)',
            border: '1px solid var(--border)' }}>
          <X size={13} />
        </button>
      </div>
      {/* Rich-text block (house rule, CLAUDE.md §3A/§4), not a bare textarea —
          stored/POSTed as sanitised HTML. */}
      <RichTextEditor value={remarks} onChange={setRemarks}
        expanded={remarksExpanded} onToggleExpand={() => setRemarksExpanded(v => !v)} />
    </div>
  ) : (
    // Collapsed ghost affordance (dashed border) — shows a one-line preview when
    // text exists; clicking reveals the editor; never opens on its own.
    <button type="button" onClick={open}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left',
        padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--bg)',
        cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {remarks ? remarks.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || t('placement.remarksAdd') : t('placement.remarksAdd')}
      </span>
      <Pencil size={13} style={{ flexShrink: 0 }} />
    </button>
  )
}
