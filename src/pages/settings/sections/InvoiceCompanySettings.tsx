/**
 * InvoiceCompanySettings (INVOICE-1, super-admin only) — the seller details, VAT
 * rate, invoice-number prefix and auto-finalize toggle that the PDF renderer and
 * the numbering sequence read. Danny must fill the company block before the FIRST
 * real invoice ships — while any of those fields is empty this renders a calm
 * notice instead of pretending the platform is invoice-ready (§3 no fake
 * affordances). House pattern: load once, optimistic save on the Save button,
 * revert the whole form to the last server-confirmed snapshot on failure
 * (mirrors CompanySettings.jsx) — a partial PUT (only changed keys) per the
 * backend contract, so a blank field is never coerced to '' on the wire.
 * Contract: GET/PUT /admin/invoice-settings.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, RefreshCw, Save } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import Toggle from '@/components/ui/Toggle'
import { BTN_H } from '@/config/buttonMetrics'
import { card, notice } from './usageCardStyles'

// The full settings shape (matches PUT /admin/invoice-settings request body 1:1).
interface InvoiceSettingsForm {
  invoice_company_name: string
  invoice_address: string
  invoice_postal_city: string
  invoice_coc_number: string
  invoice_vat_number: string
  invoice_iban: string
  invoice_email: string
  invoice_vat_percent: number
  invoice_number_prefix: string
  invoice_auto_finalize: boolean
}

const EMPTY: InvoiceSettingsForm = {
  invoice_company_name: '', invoice_address: '', invoice_postal_city: '',
  invoice_coc_number: '', invoice_vat_number: '', invoice_iban: '', invoice_email: '',
  invoice_vat_percent: 21, invoice_number_prefix: 'KM-', invoice_auto_finalize: false,
}

// The company-block fields Danny must fill before the first real invoice — VAT%,
// prefix and auto-finalize already carry sane defaults so they don't count.
const REQUIRED_KEYS: (keyof InvoiceSettingsForm)[] = [
  'invoice_company_name', 'invoice_address', 'invoice_postal_city',
  'invoice_coc_number', 'invoice_vat_number', 'invoice_iban', 'invoice_email',
]

const baseInput = {
  height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  outline: 'none', color: 'var(--text)', width: '100%', maxWidth: 360, boxSizing: 'border-box' as const,
}

// One labelled row — mirrors CompanySettings.jsx's Row so the two forms read as one family.
function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 0', borderBottom: last ? 'none' : '1px solid var(--hover-bg)', gap: 24 }}>
      <div style={{ width: 200, flexShrink: 0, fontSize: 13, color: 'var(--text-muted)', paddingTop: 8 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

export default function InvoiceCompanySettings() {
  const { t } = useTranslation('settings')
  const [form, setForm] = useState<InvoiceSettingsForm>(EMPTY)
  const [saved, setSaved] = useState<InvoiceSettingsForm>(EMPTY)
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Load the current knobs once — a fresh install returns the seeded defaults.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/admin/invoice-settings', { signal: ctrl.signal })
      .then((res) => {
        const data = { ...EMPTY, ...unwrap<Partial<InvoiceSettingsForm>>(res) }
        setForm(data)
        setSaved(data)
        setPhase('ready')
      })
      .catch(() => { if (!ctrl.signal.aborted) setPhase('error') })
    return () => ctrl.abort()
  }, [])

  const set = <K extends keyof InvoiceSettingsForm>(key: K, value: InvoiceSettingsForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Optimistic save: show success immediately, revert the WHOLE form to the last
  // confirmed snapshot on failure (house pattern) plus a toast with the real reason.
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/admin/invoice-settings', form)
      setSaved(form)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setForm(saved)
      notifyError(extractApiError(err, t('invoiceSettings.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const missing = REQUIRED_KEYS.filter((k) => !String(form[k] ?? '').trim())
  const notInvoiceReady = phase === 'ready' && missing.length > 0

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('invoiceSettings.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('invoiceSettings.subtitle')}</p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving || phase !== 'ready'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
                   cursor: phase === 'ready' ? 'pointer' : 'not-allowed',
                   background: justSaved ? 'var(--color-success)' : 'var(--color-primary)',
                   color: justSaved ? 'var(--color-on-success)' : 'var(--color-on-accent)' }}>
          {justSaved ? <><Check size={13} /> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
        </button>
      </div>

      {phase === 'loading' && <p style={notice}>{t('common.loading')}</p>}
      {phase === 'error' && <p style={notice}>{t('invoiceSettings.loadError')}</p>}

      {/* Calm notice while the company block is still empty — the first-invoice
          blocker Danny asked for, never a silent gap. */}
      {notInvoiceReady && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                      background: 'var(--color-warning-bg, var(--hover-bg))', border: '1px solid var(--color-warning, var(--border))',
                      borderRadius: 10, marginBottom: 16 }}>
          <AlertTriangle size={15} style={{ color: 'var(--color-warning, var(--text-muted))', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('invoiceSettings.notReadyTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('invoiceSettings.notReadyDesc')}</div>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section>
            <h3 style={cardHead}>{t('invoiceSettings.sectionCompany')}</h3>
            <div style={card}>
              <Row label={t('invoiceSettings.companyName')}>
                <input value={form.invoice_company_name} onChange={(e) => set('invoice_company_name', e.target.value)} style={baseInput} />
              </Row>
              <Row label={t('invoiceSettings.address')}>
                <input value={form.invoice_address} onChange={(e) => set('invoice_address', e.target.value)} style={baseInput} />
              </Row>
              <Row label={t('invoiceSettings.postalCity')}>
                <input value={form.invoice_postal_city} onChange={(e) => set('invoice_postal_city', e.target.value)} style={baseInput} />
              </Row>
              <Row label={t('invoiceSettings.cocNumber')}>
                <input value={form.invoice_coc_number} onChange={(e) => set('invoice_coc_number', e.target.value)} style={baseInput} />
              </Row>
              <Row label={t('invoiceSettings.vatNumber')}>
                <input value={form.invoice_vat_number} onChange={(e) => set('invoice_vat_number', e.target.value)} style={baseInput} />
              </Row>
              <Row label={t('invoiceSettings.iban')}>
                <input value={form.invoice_iban} onChange={(e) => set('invoice_iban', e.target.value)} style={baseInput} />
              </Row>
              <Row label={t('invoiceSettings.email')} last>
                <input type="email" value={form.invoice_email} onChange={(e) => set('invoice_email', e.target.value)} style={baseInput} />
              </Row>
            </div>
          </section>

          <section>
            <h3 style={cardHead}>{t('invoiceSettings.sectionNumbering')}</h3>
            <div style={card}>
              <Row label={t('invoiceSettings.vatPercent')}>
                <input type="number" min={0} max={100} value={form.invoice_vat_percent}
                  onChange={(e) => set('invoice_vat_percent', Number(e.target.value))}
                  style={{ ...baseInput, maxWidth: 120 }} />
              </Row>
              <Row label={t('invoiceSettings.numberPrefix')}>
                <input value={form.invoice_number_prefix} maxLength={20}
                  onChange={(e) => set('invoice_number_prefix', e.target.value)}
                  style={{ ...baseInput, maxWidth: 160 }} />
              </Row>
              <Row label={t('invoiceSettings.autoFinalize')} last>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle checked={form.invoice_auto_finalize} onChange={(v: boolean) => set('invoice_auto_finalize', v)} ariaLabel={t('invoiceSettings.autoFinalize')} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('invoiceSettings.autoFinalizeHint')}</span>
                </div>
              </Row>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

// Titled-card head style, hoisted (mirrors CompanySettings.jsx's cardHead import
// usage — kept local since it is only two style objects, not worth a shared import here).
const cardHead = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.03em', margin: '0 0 8px 4px' }
