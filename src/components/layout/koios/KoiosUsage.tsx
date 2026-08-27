/**
 * KoiosUsage — the small per-message footer: model · tokens.
 * KOIOS-CHAT (Danny screenshot): no cost is ever shown to the user — only
 * Danny's own API key is billed (§0 API-CREDITS-1), so a euro figure here is
 * both wrong context and noise. `usage.cost` is still tolerated in the payload
 * (unused) so the type stays compatible with the backend response.
 *
 * The model shown is the tenant-facing STAND name (Snel/Slim/Max), never the raw
 * vendor id the backend returns in `model`/`usage.model` (K-37, Danny 05-08). Same
 * shared id→tier match as the Settings model picker (`lib/koiosModelTiers`) — an
 * id outside that whitelist falls back to the raw id rather than a guessed label.
 */
import type { KoiosUsageData, TFn } from '@/types/koios'
import { tierKeyForModel } from '@/lib/koiosModelTiers'

// `locale` (DATUM-1/LANE-B): the real caller (KoiosPanel) always passes the
// active app locale explicitly; 'nl-NL' here is only the safe fallback for a
// caller that omits it (e.g. this component's own tests), mirroring cvLabels'
// fmtDate default.
export default function KoiosUsage({ usage, model, t, locale = 'nl-NL' }: {
  usage?: KoiosUsageData | null; model?: string | null; t: TFn; locale?: string
}) {
  if (!usage && !model) return null

  const tokens = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)

  // Locale-aware token formatting (thousands separator follows the app locale).
  const tokensFmt = new Intl.NumberFormat(locale).format(tokens)

  // Resolve the raw model id (this message's own, or the usage payload's) to its
  // stand label; ns 'koios' carries models.tier.* in all five locales already.
  const rawModel = model ?? usage?.model ?? null
  const tierKey = tierKeyForModel(rawModel)
  const modelLabel = tierKey ? t(`models.tier.${tierKey}`, { ns: 'koios' }) : (rawModel ?? '—')

  return (
    <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
      {t('koios.usageLine', { model: modelLabel, tokens: tokensFmt })}
    </div>
  )
}
