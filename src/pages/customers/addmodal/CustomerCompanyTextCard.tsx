/**
 * CustomerCompanyTextCard — the "Bedrijfstekst" card of AddCustomerModal.
 * Extracted (§0.3 — the ~400-line split trigger, 2026-08-03); pure
 * presentational, the text VALUE and its `set()` callback come from the
 * parent's form state, but the expand/editing UI state is purely local to
 * this card (nothing outside it ever reads that state, so it moved in whole
 * rather than staying controlled by the container).
 *
 * BEDRIJFSTEKST-1 (Danny 02-08): "Schrijfstijl" was a single-line TextField —
 * the exact defect this pass fixes (prose in a one-line input). Uses the
 * shared collapsed-ghost block (COLLAPSIBLE-TEXT-1, same shape as +Match's
 * Opmerkingen), reusing the SAME overview.companyText key the drawer's merged
 * company-text field already uses (one label, not a second copy). The
 * internal `toneOfVoice` form key is unchanged — it POSTs under `description`
 * (useCustomerRecord's OPTIONAL_CREATE_FIELDS; the backend column
 * `tone_of_voice` was dropped and merged into `description`).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CustomerForm } from '../AddCustomerModal'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface CustomerCompanyTextCardProps {
  form: CustomerForm
  set: (k: keyof CustomerForm, v: string) => void
}

export default function CustomerCompanyTextCard({ form, set }: CustomerCompanyTextCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  // COLLAPSIBLE-TEXT-1: Bedrijfstekst's own collapsed/editing state (mirrors
  // useMatchForm's remarksExpanded/remarksEditing — local to this card).
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <div>
      <div style={cardHead}>{t('overview.companyText')}</div>
      <div style={cardBox}>
        <CollapsibleRichText t={t} value={form.toneOfVoice} onChange={v => set('toneOfVoice', v)}
          expanded={expanded} setExpanded={setExpanded}
          editing={editing} setEditing={setEditing}
          placeholder={t('common:add')} />
      </div>
    </div>
  )
}
