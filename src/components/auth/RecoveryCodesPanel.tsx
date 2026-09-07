/**
 * RecoveryCodesPanel — shared panel that shows recovery codes in a dark
 * terminal-style grid and lets the user copy or dismiss them. Used by both
 * the MFA enrollment wizard and the regenerate-codes flow. Extracted to avoid
 * duplication and keep both flows consistent.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import Button from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/typography'

interface RecoveryCodesPanelProps {
  // The codes to show (as an array of strings).
  codes: string[]
  // Called when the user clicks the Done button.
  onDone: () => void | Promise<void>
  // Optional — show a spinner on the Done button while the handler completes.
  busy?: boolean
  // Optional — render a custom headline instead of the default "Recovery codes" label.
  headline?: ReactNode
}

// Shared recovery-codes display: dark grid of monospace codes, Copy + Done buttons.
export default function RecoveryCodesPanel({ codes, onDone, busy, headline }: RecoveryCodesPanelProps) {
  const { t } = useTranslation('settings')
  const [copied, setCopied] = useState(false)

  // Copy all recovery codes at once so they can be stored in a password manager.
  const copyRecovery = () => {
    void navigator.clipboard.writeText(codes.join('\n')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const finish = async () => {
    await onDone()
  }

  return (
    <div style={{ maxWidth: 480 }}>
      {/* Optional headline — the wizard shows a success banner here, the
          regenerate flow shows a title + description. */}
      {headline && (
        typeof headline === 'string' ? (
          <SectionTitle style={{ marginBottom: 12 }}>{headline}</SectionTitle>
        ) : (
          <div style={{ marginBottom: 12 }}>{headline}</div>
        )
      )}
      {/* The fixed "terminal" token pair (index.css): recovery codes stay high-contrast
          and identical in light AND dark themes; the pair is gated in tokenContrast.test. */}
      <div style={{ background: 'var(--color-terminal-bg)', borderRadius: 10, padding: '16px 20px', marginBottom: 16,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
        {codes.map(c => (
          <span key={c} style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-terminal-ink)', letterSpacing: '0.05em' }}>
            {c}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={copyRecovery}>
          <Copy size={13} /> {copied ? t('security.copied') : t('security.copy')}
        </Button>
        <Button variant="primary" onClick={() => void finish()} disabled={busy}>
          {busy ? t('security.working') : t('security.done')}
        </Button>
      </div>
    </div>
  )
}
