/**
 * KoiosChoosesLeadsSwitch, LEADS-AI-1: the per-vacancy switch "Koios chooses the leads".
 * Renders nothing until the BE emits the boolean (§3 no fake affordance); the checked
 * state is the record's own value, flipped optimistically (and reverted) by the hook.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Toggle from '@/components/ui/Toggle'
import { BodyText, Caption } from '@/components/ui/typography'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

interface Props {
  vacancy: VacancyDetail
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void | Promise<boolean>
}

// The switch row with its help caption; hidden while the key is absent from the response.
export default function KoiosChoosesLeadsSwitch({ vacancy, onUpdate }: Props) {
  const { t } = useTranslation('vacancies')
  const helpId = useId()
  const [saving, setSaving] = useState(false)
  const value = vacancy.koiosChoosesLeads
  if (typeof value !== 'boolean') return null

  // Flip through the shared update path; the busy flag blocks double clicks.
  const toggle = () => {
    setSaving(true)
    Promise.resolve(onUpdate?.(vacancy.id, { koiosChoosesLeads: !value })).finally(() => setSaving(false))
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
        <Toggle checked={value} onChange={toggle} ariaLabel={t('candidateSearch.koiosChoosesLeads')}
          describedBy={helpId} disabled={!onUpdate || saving} />
        <BodyText as="span">{t('candidateSearch.koiosChoosesLeads')}</BodyText>
      </div>
      <Caption as="div" id={helpId}>{t('candidateSearch.koiosChoosesLeadsHelp')}</Caption>
    </div>
  )
}
