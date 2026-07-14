/**
 * PriceAgreementRow — one price agreement as a soft card: read mode shows the
 * match criteria (function/CAO/schaal/trede — wildcard fields render as a muted
 * "any"), the purchase→sale rate in JetBrains Mono, and the validity window.
 * The pencil flips the card to PriceAgreementForm (save/cancel); trash deletes
 * with a native confirm (mirrors StatusListEditor's in-use-safe delete).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { useCao } from '@/lib/useCao'
import { useDateFormat } from '@/lib/datetime'
import { sectionBlock } from '@/components/ui/SectionCard'
import SafeHtml from '@/components/ui/SafeHtml'
import PriceAgreementForm, { draftFromAgreement, draftToPayload } from './PriceAgreementForm'
import type { PriceAgreementDraft } from './PriceAgreementForm'
import type { PriceAgreement, PriceAgreementPayload } from '../hooks/usePriceAgreements'
import type { Id } from '@/types/common'

const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', flexShrink: 0 }
const mutedItalic: CSSProperties = { fontStyle: 'italic', color: 'var(--text-muted)' }
const criterionLabel: CSSProperties = { fontSize: 11, color: 'var(--text-muted)' }

// A criterion cell: the value, or a muted italic "any" placeholder when the
// backend wildcard (null) applies.
function Criterion({ label, value, any }: { label: string; value: string | null; any: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 12.5 }}>
      <span style={criterionLabel}>{label}</span>
      <span style={value ? { color: 'var(--text)' } : mutedItalic}>{value || any}</span>
    </span>
  )
}

export default function PriceAgreementRow({ agreement, onSave, onDelete }: {
  agreement: PriceAgreement
  onSave: (id: Id, payload: PriceAgreementPayload) => void
  onDelete: (id: Id) => void
}) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
  const { colorOf } = useCao()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<PriceAgreementDraft>(() => draftFromAgreement(agreement))

  const startEdit = () => { setDraft(draftFromAgreement(agreement)); setEditing(true) }
  const save = () => { onSave(agreement.id, draftToPayload(draft)); setEditing(false) }
  const remove = () => { if (window.confirm(t('priceAgreements.confirmDelete'))) onDelete(agreement.id) }

  const caoColor = agreement.cao ? (colorOf(agreement.cao) ?? '#6B7280') : undefined
  const margin = (agreement.purchaseRate != null && agreement.saleRate != null) ? agreement.saleRate - agreement.purchaseRate : null

  if (editing) {
    return (
      <div style={{ ...sectionBlock, marginBottom: 8, border: '1px solid var(--color-primary)' }}>
        <PriceAgreementForm draft={draft} onChange={patch => setDraft(d => ({ ...d, ...patch }))}
          onSave={save} onCancel={() => setEditing(false)} saveLabel={t('drawer.save')} />
      </div>
    )
  }

  return (
    <div style={{ ...sectionBlock, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Criterion label={t('priceAgreements.function')} value={agreement.functionTitle} any={t('priceAgreements.any')} />
          {agreement.cao
            ? <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: caoColor + '1A', color: caoColor, border: `1px solid ${caoColor}55` }}>
                {t('priceAgreements.cao')}: {agreement.cao}
              </span>
            : <Criterion label={t('priceAgreements.cao')} value={null} any={t('priceAgreements.any')} />}
          <Criterion label={t('priceAgreements.scale')} value={agreement.scale} any={t('priceAgreements.any')} />
          <Criterion label={t('priceAgreements.step')} value={agreement.step} any={t('priceAgreements.any')} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={startEdit} title={t('drawer.edit')} style={iconBtn}><Pencil size={12} /></button>
          <button onClick={remove} title={t('priceAgreements.delete')} style={{ ...iconBtn, color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
        <span style={{ color: 'var(--text)' }}>€ {agreement.purchaseRate != null ? agreement.purchaseRate.toFixed(2) : '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <span style={{ color: 'var(--text)' }}>{agreement.saleRate != null ? `€ ${agreement.saleRate.toFixed(2)}` : '—'}</span>
        {margin != null && (
          <span style={{ fontSize: 11, color: margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            ({t('priceAgreements.margin')} € {margin.toFixed(2)})
          </span>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        {t('priceAgreements.validFrom')} {formatDate(agreement.validFrom)}
        {' · '}
        {agreement.validUntil ? `${t('priceAgreements.validUntil')} ${formatDate(agreement.validUntil)}` : t('priceAgreements.indefinite')}
      </div>

      {/* Remarks is rich-text HTML (RichTextEditor in the form above) — sanitised render, never raw. */}
      {agreement.remarks && <SafeHtml html={agreement.remarks} style={{ fontSize: 12, color: 'var(--text-muted)' }} />}
    </div>
  )
}
