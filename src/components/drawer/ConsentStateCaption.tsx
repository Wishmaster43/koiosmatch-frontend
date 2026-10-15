/**
 * ConsentStateCaption — read-only caption for one channel's consent state (K-008).
 * Icon + text, never colour-only (§6); null/undefined renders nothing (no fake value).
 */
import { useTranslation } from 'react-i18next'
import { Check, X, HelpCircle } from 'lucide-react'
import { Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import type { ConsentState } from '@/types/consent'

export default function ConsentStateCaption({ state, at }: { state: ConsentState | null | undefined; at?: string | null }) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  if (!state) return null

  // Pick the icon and text per state; the date shows only when the server stamped one.
  const date = at ? formatDate(at) : null
  const Icon = state === 'granted' ? Check : state === 'refused' ? X : HelpCircle
  let text: string
  if (state === 'granted') text = date ? t('consentState.grantedAt', { date }) : t('consentState.granted')
  else if (state === 'refused') text = date ? t('consentState.refusedAt', { date }) : t('consentState.refused')
  else text = state === 'not_asked' ? t('consentState.notAsked') : t('consentState.unconfirmed')

  return (
    <Caption as="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} aria-hidden="true" />
      {text}
    </Caption>
  )
}
