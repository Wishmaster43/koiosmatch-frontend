/**
 * KoiosCapabilityFacts — two calm info blocks under the tool matrix heading:
 * (1) Oppervlakken — the six assistant surfaces as soft chips;
 * (2) Limieten — max tokens, monthly budget, warn-at %, and rate limits.
 * Render nothing for absent data; apply the card's own container style (§4 calm).
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { formatCurrency } from '@/lib/formatters'
import SoftChip from '@/components/ui/SoftChip'
import { GroupLabel, Caption, BodyText } from '@/components/ui/typography'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import type { KoiosSurface, KoiosLimits } from '@/components/layout/koios/useKoiosToolCapabilities'

const sectionStyle = { marginTop: 12, marginBottom: 12 } as const
const chipsRowStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' as const, margin: '8px 0' }
const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' } as const

// One tint for every surface chip: the list is a placemarker, not a status, and §4
// spends colour only where it carries meaning (one hue per surface would be decoration).
const SURFACE_CHIP_COLOR = 'var(--color-primary)'

function SurfacesBlock({ surfaces }: { surfaces: KoiosSurface[] }) {
  const { t } = useTranslation('koios')
  if (!surfaces || surfaces.length === 0) return null
  return (
    <div style={sectionStyle}>
      <GroupLabel>{t('capabilities.facts.surfaces')}</GroupLabel>
      <div style={chipsRowStyle}>
        {surfaces.map((surface) => {
          // Fall back to the API's label_nl only if the i18n key is missing.
          const label = t(`capabilities.surfaces.${surface.key}`, { defaultValue: surface.label_nl })
          return <SoftChip key={surface.key} label={label} color={SURFACE_CHIP_COLOR} />
        })}
      </div>
    </div>
  )
}

// Rate-limit unit, parsed from the backend's compact string ("20/min", "30/hour").
type RateUnit = 'perMinute' | 'perHour' | 'perSecond'

// Maps the string's unit token onto the i18n key that renders it translated.
const RATE_UNIT_KEY: Record<string, RateUnit> = {
  min: 'perMinute', minute: 'perMinute',
  hour: 'perHour', h: 'perHour',
  s: 'perSecond', sec: 'perSecond',
}

// Tolerant parse of a backend rate-limit string ("20/min", "30 / hour") into a
// count + unit pair; returns null when the shape is unrecognised so the caller
// can fall back to the raw string — never hide a value we cannot parse.
function parseRateLimit(raw: string): { count: number; unit: RateUnit } | null {
  const match = raw.match(/^(\d+)\s*\/\s*(min|minute|hour|h|s|sec)$/i)
  if (!match) return null
  const unit = RATE_UNIT_KEY[match[2].toLowerCase()]
  return unit ? { count: Number(match[1]), unit } : null
}

function LimitsBlock({ limits }: { limits?: KoiosLimits }) {
  const { t } = useTranslation('koios')
  const { locale, formatPercent } = useNumberFormat()
  if (!limits) return null
  const { max_tokens_per_request, monthly_budget_cents, warn_at_pct, rate_limits } = limits

  // Format budget: cents → euros via formatCurrency. `!= null` so a real 0-cent
  // budget still renders — a truthy check hides it, same bug as the old rate check.
  const budgetEuro = monthly_budget_cents != null ? monthly_budget_cents / 100 : null
  const budgetStr = budgetEuro !== null ? formatCurrency(budgetEuro, 'EUR', locale) : '—'

  // Renders a "20/min" rate-limit string as a translated, locale-formatted phrase.
  // An unparseable string still renders verbatim (honest fallback, never hides data).
  const renderRate = (raw: string) => {
    const parsed = parseRateLimit(raw)
    if (!parsed) return raw
    return t(`capabilities.facts.${parsed.unit}`, { count: new Intl.NumberFormat(locale).format(parsed.count) })
  }

  return (
    <div style={sectionStyle}>
      <GroupLabel>{t('capabilities.facts.limits')}</GroupLabel>
      <div>
        {max_tokens_per_request !== null && max_tokens_per_request !== undefined && (
          <div style={rowStyle}>
            <Caption style={CANON_LABEL_STYLE}>{t('capabilities.facts.maxTokens')}</Caption>
            <BodyText>{new Intl.NumberFormat(locale).format(max_tokens_per_request)}</BodyText>
          </div>
        )}
        {budgetEuro !== null && (
          <div style={rowStyle}>
            <Caption style={CANON_LABEL_STYLE}>{t('capabilities.facts.monthlyBudget')}</Caption>
            <BodyText>{budgetStr}</BodyText>
          </div>
        )}
        {warn_at_pct != null && (
          <div style={rowStyle}>
            <Caption style={CANON_LABEL_STYLE}>{t('capabilities.facts.warnAt')}</Caption>
            <BodyText>{formatPercent(warn_at_pct)}</BodyText>
          </div>
        )}
        {/* Empty string means "not configured" (distinct from a real numeric 0 above). */}
        {rate_limits?.chat != null && rate_limits.chat !== '' && (
          <div style={rowStyle}>
            <Caption style={CANON_LABEL_STYLE}>{t('capabilities.facts.rateChat')}</Caption>
            <BodyText>{renderRate(rate_limits.chat)}</BodyText>
          </div>
        )}
        {rate_limits?.other != null && rate_limits.other !== '' && (
          <div style={rowStyle}>
            <Caption style={CANON_LABEL_STYLE}>{t('capabilities.facts.rateOther')}</Caption>
            <BodyText>{renderRate(rate_limits.other)}</BodyText>
          </div>
        )}
      </div>
    </div>
  )
}

export default function KoiosCapabilityFacts({ surfaces, limits }: { surfaces?: KoiosSurface[]; limits?: KoiosLimits }) {
  // Render nothing if both blocks are empty.
  if ((!surfaces || surfaces.length === 0) && !limits) return null
  return (
    <div>
      <SurfacesBlock surfaces={surfaces ?? []} />
      <LimitsBlock limits={limits} />
    </div>
  )
}
