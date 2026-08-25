/**
 * MatchContractLineRateSideSettings — Settings → Matches → which side of the
 * money a match's per-function rate line (CONTRACTREGELS, "CONTRACT LINES")
 * means (TARIEF-ZIJDE-1,
 * Danny 15-08: "via instellingen moet per tenant aangegeven worden welke de
 * klant wilt" — "settings must let each tenant indicate which one the customer
 * wants"). Persists the tenant setting `match_contract_line_rate_side`
 * ('sale' | 'purchase') via the shared /settings key/value store.
 *
 * `sale` = what the customer pays — stays open to anyone who may see the match.
 * `purchase` = what the bureau pays the candidate — gated behind
 * `matches.financial.view` on the backend, exactly like purchase_rate/margin
 * already are (see MatchDetailResource::visibleContractLines). The line itself
 * (function title, order) is NEVER gated by this choice — only the amount is.
 *
 * The backend fails safe to `purchase` (the guarded reading) for ANY value that
 * isn't exactly one of the two — `resolveSide` below mirrors that fallback
 * exactly, so a legacy/garbage stored value never renders a third, unrepresented
 * selection state here.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { notifyError } from '@/lib/notify'
import { useAllSettings, getStringSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { PageTitle } from '@/components/ui/typography'

const KEY = 'match_contract_line_rate_side'
const SALE = 'sale'
const PURCHASE = 'purchase'
type Side = typeof SALE | typeof PURCHASE

// Mirrors App\Support\ContractLineRateSide::resolve() — anything but the literal
// 'sale' is treated as the guarded default, never left "unselected".
function resolveSide(raw: string | null): Side {
  return raw === SALE ? SALE : PURCHASE
}

export default function MatchContractLineRateSideSettings() {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  const [side, setSide] = useState<Side>(() => resolveSide(getStringSetting(values, KEY, PURCHASE)))
  const [saving, setSaving] = useState(false)

  // Stay in sync with the shared /settings cache (e.g. a save made in another tab).
  useEffect(() => { setSide(resolveSide(getStringSetting(values, KEY, PURCHASE))) }, [values])

  // Optimistic pick; revert + toast on a rejected save. This setting decides
  // whether money is visible, so a failed write must never look like it landed.
  const pick = async (next: string) => {
    if (next === side || saving) return
    const prev = side
    setSide(next as Side)
    setSaving(true)
    try {
      await saveSettingsKeys({ [KEY]: next })
    } catch {
      setSide(prev)
      notifyError(t('matchContractLineRateSide.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // Each option's own description IS the consequence line (Danny: the agency
  // needs to know before choosing) — always visible next to that choice, never
  // a separate manual/tooltip.
  const options = [
    { value: SALE, label: t('matchContractLineRateSide.saleLabel'), description: t('matchContractLineRateSide.saleDescription') },
    { value: PURCHASE, label: t('matchContractLineRateSide.purchaseLabel'), description: t('matchContractLineRateSide.purchaseDescription') },
  ]

  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle>{t('matchContractLineRateSide.title')}</PageTitle>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>{t('matchContractLineRateSide.subtitle')}</p>
      <SegmentedControl ariaLabel={t('matchContractLineRateSide.title')} value={side} onChange={pick} options={options} />
    </div>
  )
}
