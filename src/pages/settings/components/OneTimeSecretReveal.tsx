/**
 * OneTimeSecretReveal — the settings "secret shown once" panel: a signing/API
 * secret in a copyable mono field inside a success CalloutBox, plus a Done
 * action. Shared by ApiKeyCreate and WebhookCreate's phase-2 (post-create) view
 * — the secret itself is never persisted client-side by either caller, and this
 * component holds no state beyond the transient "copied" flash.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import { Mono } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'

interface OneTimeSecretRevealProps {
  title: string
  secret: string
  copyLabel: string
  copiedLabel: string
  doneLabel: string
  onDone: () => void
  /** Optional extra line under the secret field — e.g. WebhookCreate's HMAC signing hint. */
  hint?: ReactNode
}

// One-time secret display + copy-to-clipboard (2s "copied" flash) + optional hint + a Done action.
export default function OneTimeSecretReveal({ title, secret, copyLabel, copiedLabel, doneLabel, onDone, hint }: OneTimeSecretRevealProps) {
  const [copied, setCopied] = useState(false)

  // Copies the secret to the clipboard and flashes a copied confirmation for 2s.
  const copySecret = () => {
    navigator.clipboard.writeText(secret ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <CalloutBox variant="success" title={title}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mono as="code" style={{ flex: 1, fontSize: 12, background: 'var(--surface)', border: tintBorder('var(--color-success)'), borderRadius: 6, padding: '9px 11px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{secret}</Mono>
            {/* Copy action flips into the shared saved-state confirmation (§4 pair via SaveButton). */}
            <SaveButton variant="secondary" saved={copied} onClick={copySecret} aria-label={copyLabel}
              style={{ whiteSpace: 'nowrap' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? copiedLabel : copyLabel}
            </SaveButton>
          </div>
          {hint && <p style={{ fontSize: 11, color: 'var(--color-success-text)', marginTop: 8, marginBottom: 0 }}>{hint}</p>}
        </CalloutBox>
      </div>
      <Button variant="primary" onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  )
}
