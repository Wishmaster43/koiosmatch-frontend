import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { notifySuccess } from '@/lib/notify'

interface ReferenceNumberChipProps {
  // The human-readable reference number (K-00123, D-4, V-12, …); nothing renders without one.
  value?: string | null
}

/**
 * ReferenceNumberChip — the ONE place every entity drawer shows its human-readable
 * reference number (NUMMER-1): JetBrains Mono, muted, click-to-copy. Shared so the
 * candidate/customer/vacancy/match drawers stay pixel-identical (§3A "same spot").
 */
export default function ReferenceNumberChip({ value }: ReferenceNumberChipProps) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  if (!value) return null

  // Copy to the clipboard + a small success toast; the icon briefly confirms too.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      notifySuccess(t('referenceNumber.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard API unavailable (older browser/permissions) — no-op */ }
  }

  return (
    <button type="button" onClick={copy} title={t('referenceNumber.copy')} aria-label={t('referenceNumber.copy')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
        cursor: 'pointer', padding: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
      {value}
      {copied ? <Check size={10} /> : <Copy size={10} style={{ opacity: 0.6 }} />}
    </button>
  )
}
