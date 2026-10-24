// InterviewConsentRow — the shared "candidate consents to the AI interview" checkbox row
// of both apply modals (ONIX K-006: consent is a gate on every interview start path).
import { useId } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckboxField } from '@/components/forms/fields'
import { BodyText, Caption } from '@/components/ui/typography'

// Unchecked by default (the system never guesses consent); the parent decides what to send.
// `style` is layout only (the modals keep their field spacing, the start card its own gap).
export default function InterviewConsentRow({ checked, onChange, style }: {
  checked: boolean; onChange: (v: boolean) => void; style?: CSSProperties
}) {
  const { t } = useTranslation('applications')
  const id = useId()
  return (
    // CheckboxField does not forward aria-describedby, so the group carries the help text link.
    <div role="group" aria-describedby={`${id}-help`} style={{ marginBottom: 14, ...style }}>
      <BodyText as="label" htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <CheckboxField id={id} checked={checked} onChange={onChange} />
        {t('addModal.interviewConsent')}
      </BodyText>
      <Caption id={`${id}-help`} style={{ display: 'block', marginTop: 3, marginLeft: 22 }}>{t('addModal.interviewConsentHelp')}</Caption>
    </div>
  )
}
