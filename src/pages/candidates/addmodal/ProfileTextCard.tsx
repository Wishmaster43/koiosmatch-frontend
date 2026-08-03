/**
 * ProfileTextCard — the candidate's free-text "profile text" (summary), as a
 * collapsed ghost affordance (Danny 02-08: "bij popup Nieuwe kandidaat ...
 * moet altijd een tekstveld aanwezig zijn zoals we hebben bij + match!!").
 * Reuses the candidate drawer's own `profile.summary` label — never a second
 * "profile text" key — and the shared CollapsibleRichText block (components/ui)
 * so this create form gets the exact same low-height, always-present shape as
 * the +Match "Opmerkingen" card. Full width, own state (this modal has no
 * form-level hook to own it, unlike the match form).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import type { FormState } from '../AddCandidateModal'
import { cardHead, cardBox } from './fields'

interface ProfileTextCardProps {
  form: FormState
  set: (k: keyof FormState, v: string) => void
}

export default function ProfileTextCard({ form, set }: ProfileTextCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  // Collapsed by default, own local state (mirrors useMatchForm's remarksExpanded/
  // remarksEditing — this modal has no equivalent shared form hook to own it).
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{t('profile.summary')}</div>
      <div style={cardBox}>
        <CollapsibleRichText t={t} value={form.summary} onChange={v => set('summary', v)}
          expanded={expanded} setExpanded={setExpanded} editing={editing} setEditing={setEditing}
          placeholder={t('common:add')} />
      </div>
    </div>
  )
}
