/**
 * KoiosUsage — the small per-message footer: model · tokens · cost.
 * Tokens/cost can legitimately be 0 (e.g. before a key is configured); a zero
 * cost renders as an em-dash rather than "€0.00". Currency comes from the usage
 * payload (defaults to EUR).
 *
 * The model shown is the tenant-facing STAND name (Snel/Slim/Max), never the raw
 * vendor id the backend returns in `model`/`usage.model` (K-37, Danny 05-08). Same
 * shared id→tier match as the Settings model picker (`lib/koiosModelTiers`) — an
 * id outside that whitelist falls back to the raw id rather than a guessed label.
 */
import type { KoiosUsageData, TFn } from '@/types/koios'
import { tierKeyForModel } from '@/lib/koiosModelTiers'

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

  // Resolve the raw model id (this message's own, or the usage payload's) to its
  // stand label; ns 'koios' carries models.tier.* in all five locales already.
  const rawModel = model ?? usage?.model ?? null
  const tierKey = tierKeyForModel(rawModel)
  const modelLabel = tierKey ? t(`models.tier.${tierKey}`, { ns: 'koios' }) : (rawModel ?? '—')

  return (
    <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
      {t('koios.usageLine', { model: modelLabel, tokens: tokensFmt, cost: costFmt })}
    </div>
  )
}
