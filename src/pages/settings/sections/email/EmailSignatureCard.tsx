import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { Caption, SectionTitle } from '@/components/ui/typography'
import { cardStyle } from './emailStyles'

// Props: the HTML signature and its setter.
interface EmailSignatureCardProps {
  signature: string
  onSignatureChange: (value: string) => void
}

// Signature editor card (per context); fills the column height alongside the connection blocks.
export default function EmailSignatureCard({ signature, onSignatureChange }: EmailSignatureCardProps) {
  const { t } = useTranslation('settings')
  const [sigExpanded, setSigExpanded] = useState(false)
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
      <SectionTitle as="div" style={{ marginBottom: 2 }}>{t('email.signature')}</SectionTitle>
      <Caption as="div" style={{ marginBottom: 10 }}>{t('email.signatureHint')}</Caption>
      <RichTextEditor value={signature} onChange={onSignatureChange} fill
        expanded={sigExpanded} onToggleExpand={() => setSigExpanded(e => !e)} />
    </div>
  )
}
