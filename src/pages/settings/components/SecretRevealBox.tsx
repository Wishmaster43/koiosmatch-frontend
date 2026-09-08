/**
 * SecretRevealBox — shared one-time secret display with copy button.
 *
 * Replaces the duplicated Mono code box + copy-button pattern in ApiKeyDetail
 * and WebhookDetail (the inner box inside the CalloutBox). Renders the secret
 * in a monospace field with success-tinted border + a copy button with
 * 2-second confirmation flash. The parent supplies the CalloutBox wrapper.
 */
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Mono } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'
import Button from '@/components/ui/Button'

interface SecretRevealBoxProps {
  secret: string
  copyLabel: string
  copiedLabel: string
}

// Mono code box (success-tinted border) + copy button with confirmation flash.
export default function SecretRevealBox({
  secret,
  copyLabel,
  copiedLabel,
}: SecretRevealBoxProps) {
  const [copied, setCopied] = useState(false)

  // Copy the secret and flash a confirmation for 2 seconds.
  const handleCopy = () => {
    navigator.clipboard.writeText(secret ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Mono
        as="code"
        style={{
          flex: 1,
          fontSize: 12,
          background: 'var(--surface)',
          border: tintBorder('var(--color-success)'),
          borderRadius: 6,
          padding: '8px 10px',
          color: 'var(--text)',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {secret}
      </Mono>
      {/* The copy action is a "gelukt"-class action: the house success variant (Button, §4 pair), never a hand-painted tint. */}
      <Button variant="success" size="sm" onClick={handleCopy}>
        {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  )
}
