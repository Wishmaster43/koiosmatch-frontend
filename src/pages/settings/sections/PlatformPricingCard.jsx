/**
 * PlatformPricingCard (CREDITS-1 fase 1) — superadmin-only platform pricing knobs:
 * the AI markup percentage and the workflow credit price. Lives inside
 * ModulesSettings (the superadmin "packages/pricing" screen — Danny: "waar stel
 * ik prijzen in"). House pattern: optimistic save-on-blur with revert + toast on
 * failure (mirrors MatchRatesSettings' conversion-factor field). Units are always
 * shown next to the input (% / €) so a bare number never reads as ambiguous.
 * Danny 14-08 asked "where is the save button" — this field already persists
 * automatically on blur, so instead of adding a redundant explicit button we
 * made the existing autosave visible: a success toast confirms the write, so
 * the recruiter never wonders whether a typed value actually landed.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Percent, Euro } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { SectionTitle } from '@/components/ui/typography'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 28, background: 'var(--surface)' }
const sub = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }
const label = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }
const inputWrap = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--input-bg)' }
const inputStyle = { border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: "'JetBrains Mono', monospace" }

export default function PlatformPricingCard() {
  const { t } = useTranslation('settings')
  const [markup, setMarkup] = useState('')
  const [price, setPrice] = useState('')
  const [saved, setSaved] = useState({ markup: '', price: '' }) // last server-confirmed values, for revert-on-failure
  const [phase, setPhase] = useState('loading') // loading | ready | error

  // Load the current platform pricing knobs.
  useEffect(() => {
    let alive = true
    api.get('/admin/platform-pricing')
      .then((res) => {
        if (!alive) return
        const d = unwrap(res) ?? {}
        const m = d.ai_markup_percent != null ? String(d.ai_markup_percent) : ''
        const p = d.workflow_credit_price != null ? String(d.workflow_credit_price) : ''
        setMarkup(m); setPrice(p); setSaved({ markup: m, price: p })
        setPhase('ready')
      })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [])

  // Persist both knobs together (a small, complete pricing sheet — the backend
  // requires both fields). Optimistic: fields already show the typed value;
  // revert + toast on a validation/network failure.
  const save = async (nextMarkup, nextPrice) => {
    const mNum = Number(nextMarkup)
    const pNum = Number(nextPrice)
    if (nextMarkup === saved.markup && nextPrice === saved.price) return
    if (!isFinite(mNum) || mNum < 0 || mNum > 500 || !isFinite(pNum) || pNum < 0 || pNum > 1000) {
      setMarkup(saved.markup); setPrice(saved.price)
      return
    }
    try {
      await api.put('/admin/platform-pricing', { ai_markup_percent: mNum, workflow_credit_price: pNum })
      setSaved({ markup: nextMarkup, price: nextPrice })
      notifySuccess(t('platformPricing.saved'))
    } catch (err) {
      setMarkup(saved.markup); setPrice(saved.price)
      notifyError(extractApiError(err, t('common:actionFailed')))
    }
  }

  if (phase === 'loading') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('platformPricing.title')}</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('platformPricing.title')}</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('platformPricing.loadError')}</p>
      </div>
    )
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('platformPricing.title')}</SectionTitle>
      <div style={sub}>{t('platformPricing.subtitle')}</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <label style={label} htmlFor="platform-pricing-markup">{t('platformPricing.markupLabel')}</label>
          <div style={inputWrap}>
            <input id="platform-pricing-markup" type="number" min={0} max={500} step={0.01}
              value={markup} onChange={(e) => setMarkup(e.target.value)}
              onBlur={(e) => save(e.target.value, price)} style={inputStyle} />
            <Percent size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
          </div>
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <label style={label} htmlFor="platform-pricing-credit">{t('platformPricing.creditPriceLabel')}</label>
          <div style={inputWrap}>
            <Euro size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
            <input id="platform-pricing-credit" type="number" min={0} max={1000} step={0.0001}
              value={price} onChange={(e) => setPrice(e.target.value)}
              onBlur={(e) => save(markup, e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>
    </div>
  )
}
