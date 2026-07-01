/**
 * KoiosUsage — the small per-message footer: model · tokens · cost.
 * Tokens/cost can legitimately be 0 (e.g. before a key is configured); a zero
 * cost renders as an em-dash rather than "€0.00". Currency comes from the usage
 * payload (defaults to EUR).
 */
import type { KoiosUsageData, TFn } from '@/types/koios'

export default function KoiosUsage({ usage, model, t, locale = 'nl-NL' }: {
  usage?: KoiosUsageData | null; model?: string | null; t: TFn; locale?: string
}) {
  if (!usage && !model) return null

  const currency = usage?.currency ?? 'EUR'
  const tokens   = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)
  const cost     = usage?.cost ?? 0

  // Locale-aware formatting; zero cost is shown as "—" (nothing billed yet).
  const tokensFmt = new Intl.NumberFormat(locale).format(tokens)
  const costFmt = cost > 0
    ? new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cost)
    : '—'

  return (
    <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
      {t('koios.usageLine', { model: model ?? usage?.model ?? '—', tokens: tokensFmt, cost: costFmt })}
    </div>
  )
}
