import { useTranslation } from 'react-i18next'
import KoiosAiMark from './KoiosAiMark'

interface AiGeneratedLabelProps {
  // One size knob (px) for both the icon and the text — defaults to the
  // house 11px meta-label scale (§4); callers needing a tighter spot (a
  // timeline bubble, a compact card) can pass 10.
  size?: number
}

/**
 * AiGeneratedLabel — THE one inline "AI-generated" disclosure label (EU AI
 * Act, AI-ACT-1: hoog-risico werving vereist AI-labels op elke Koios-uiting).
 * Icon (KoiosAiMark, the shared soft-tint mark, §4) + muted text, always
 * BOTH — never colour/icon-only (§6, colour is never the only signal) — so
 * the disclosure survives for colour-blind users and screen readers alike
 * (the mark's own title/aria-label carries the same hint).
 *
 * Use wherever Koios-generated CONTENT or ADVICE is shown. Where a surface
 * already has an explicit "Koios AI adviseert" heading, don't stack this on
 * top of it — that reads as a double badge; add the hint text to the
 * existing heading's mark instead (see KoiosAdviceBlock).
 */
export default function AiGeneratedLabel({ size = 11 }: AiGeneratedLabelProps) {
  const { t } = useTranslation('common')
  // Both keys ship with a Dutch defaultValue so the label never shows a raw
  // i18n key while the real translations land in the locale files (§5 — the
  // keys still need translating in all five locales; this is only the
  // fallback for the interim).
  const hint = t('aiGeneratedHint', { defaultValue: 'Door Koios AI gegenereerd — controleer voor gebruik.' })
  const label = t('aiGenerated', { defaultValue: 'AI-gegenereerd' })

  return (
    <span title={hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: size, fontWeight: 500, color: 'var(--text-muted)' }}>
      <KoiosAiMark size={size + 3} title={hint} />
      {label}
    </span>
  )
}
