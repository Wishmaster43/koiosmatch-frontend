/**
 * DescriptionCard — Beschrijving (punt 9): the shared collapsed-ghost rich-text
 * block, the same "+ match" idiom every other create modal uses for its
 * optional prose field. The Koios-AI generate flow is SLICE 2 — see the marker
 * below; this slice only wires the plain field.
 */
import { useTranslation } from 'react-i18next'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface Props {
  value: string; onChange: (v: string) => void
  expanded: boolean; setExpanded: (fn: (v: boolean) => boolean) => void
  editing: boolean; setEditing: (v: boolean) => void
}

export default function DescriptionCard({ value, onChange, expanded, setExpanded, editing, setEditing }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('details.description')}</div>
      <div style={cardBox}>
        {/* SLICE-2: the Koios-AI generate button lands here — out of scope for this slice. */}
        <CollapsibleRichText t={t} value={value} onChange={onChange}
          expanded={expanded} setExpanded={setExpanded} editing={editing} setEditing={setEditing}
          placeholder={t('common:add')} ariaLabel={t('details.description')} />
      </div>
    </div>
  )
}
