/**
 * PlatformPricingCard — superadmin platform pricing knob: the AI markup percentage
 * (CREDITS-1). PRIJSMODEL-C (30-08): the workflow-token price lives on Pakket →
 * Staffels → Overage, so this card only points there. The USD→EUR rate the API
 * still returns is NOT shown (Danny 09-09: "nooit om gevraagd"); the PUT sends
 * ai_markup_percent alone and the backend keeps its stored rate (B-26 `sometimes`).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { SectionTitle, Caption } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { NumberField, SettingCardList, SettingRow } from '../components/SettingsKit'
import { card, sub } from './billingCardStyles'

export default function PlatformPricingCard() {
  const { t } = useTranslation('settings')
  const [markup, setMarkup] = useState(0)
  const [savedMarkup, setSavedMarkup] = useState(0) // last server-confirmed value, for revert-on-failure
  const [phase, setPhase] = useState('loading') // loading | ready | error

  // Load the current platform pricing knob; an alive guard drops a late response after unmount.
  const load = () => {
    setPhase('loading')
    return api.get('/admin/platform-pricing')
      .then((res) => {
        const d = unwrap(res) ?? {}
        const m = d.ai_markup_percent != null ? Number(d.ai_markup_percent) : 0
        setMarkup(m); setSavedMarkup(m); setPhase('ready')
      })
      .catch(() => setPhase('error'))
  }
  useEffect(() => {
    let alive = true
    api.get('/admin/platform-pricing')
      .then((res) => {
        if (!alive) return
        const d = unwrap(res) ?? {}
        const m = d.ai_markup_percent != null ? Number(d.ai_markup_percent) : 0
        setMarkup(m); setSavedMarkup(m); setPhase('ready')
      })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [])

  // Persist the markup once the field commits (blur). Optimistic: the field already
  // shows the typed value; revert + toast on a validation/network failure.
  const save = async (next) => {
    const value = next ?? 0
    if (value === savedMarkup) return
    try {
      await api.put('/admin/platform-pricing', { ai_markup_percent: value })
      setSavedMarkup(value)
      notifySuccess(t('platformPricing.saved'))
    } catch (err) {
      setMarkup(savedMarkup)
      notifyError(extractApiError(err, t('platformPricing.saveFailed')))
    }
  }

  if (phase === 'loading') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('platformPricing.title')}</SectionTitle>
        <Caption>{t('common.loadingShort')}</Caption>
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('platformPricing.title')}</SectionTitle>
        <ErrorBanner onRetry={load}>{t('platformPricing.loadError')}</ErrorBanner>
      </div>
    )
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('platformPricing.title')}</SectionTitle>
      <div style={sub}>{t('platformPricing.subtitle')}</div>
      <SettingCardList>
        <SettingRow label={t('platformPricing.markupLabel')} description={t('platformPricing.markupHint')}>
          <NumberField value={markup} min={0} max={500} step={0.01} unit="%" width={90}
            ariaLabel={t('platformPricing.markupLabel')} onChange={setMarkup} onCommit={save} />
        </SettingRow>
        <SettingRow label={t('platformPricing.workflowTokenPriceLabel')} description={t('platformPricing.workflowTokenPriceHint')}>
          <Caption>{t('platformPricing.workflowTokenPriceWhere')}</Caption>
        </SettingRow>
      </SettingCardList>
    </div>
  )
}
