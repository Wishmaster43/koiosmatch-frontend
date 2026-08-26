/**
 * DescriptionCard — Beschrijving (point 9): the shared collapsed-ghost rich-text
 * block, the same "+ match" idiom every other create modal uses for its
 * optional prose field. Point 17: the Koios-AI generate flow sits above the
 * editor — applying a concept seeds the draft AND opens the editor so the
 * recruiter reviews it before Create is even clickable-with-that-text.
 */
import { useTranslation } from 'react-i18next'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import GenerateDescriptionFlow from './GenerateDescriptionFlow'
import type { GenerateFormFields } from './useGenerateDescription'

interface Props {
  value: string; onChange: (v: string) => void
  expanded: boolean; setExpanded: (fn: (v: boolean) => boolean) => void
  editing: boolean; setEditing: (v: boolean) => void
  genFields: GenerateFormFields
}

// The vacancy description card (see file docblock above): a collapsed rich-text
// block plus the Koios-generate flow, which seeds the draft into review, never a
// silent overwrite.
export default function DescriptionCard({ value, onChange, expanded, setExpanded, editing, setEditing, genFields }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  // Apply a generated concept: seed the draft and open the editor — never a
  // silent overwrite, the recruiter still reviews/edits before Create persists it.
  const applyGenerated = (concept: string) => { onChange(concept); setEditing(true) }
  return (
    <div>
      <div style={cardHead}>{t('details.description')}</div>
      <div style={cardBox}>
        <GenerateDescriptionFlow fields={genFields} onApply={applyGenerated} />
        <CollapsibleRichText t={t} value={value} onChange={onChange}
          expanded={expanded} setExpanded={setExpanded} editing={editing} setEditing={setEditing}
          placeholder={t('common:add')} ariaLabel={t('details.description')} />
      </div>
    </div>
  )
}
