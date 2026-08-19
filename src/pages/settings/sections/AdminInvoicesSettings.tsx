/**
 * AdminInvoicesSettings (INVOICE-1, super-admin only) — the platform-wide invoice
 * console: pick a month, generate that month's draft invoices for every tenant,
 * then finalize (or re-send) each one. Finalize semantics per the backend
 * contract: a 422 fires ONLY when the invoice is already final AND delivered
 * (sent_at set) — a final-but-undelivered invoice re-uses the SAME endpoint as a
 * genuine re-send path, so the button reads "Opnieuw versturen" instead of firing
 * a dead/misleading "Finaliseren" that would just 422 (Danny's explicit note).
 * Contract: GET /admin/invoices?month= · POST /admin/invoices/generate {month} ·
 * POST /admin/invoices/{id}/finalize · GET /admin/invoices/{id}/download ·
 * GET /admin/invoices/export?month= (superadmin-only reconciliation sheet).
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileSpreadsheet, RefreshCw, Send } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useNumberFormat } from '@/lib/formatters'
import { useLocale } from '@/lib/datetime'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import StatusPill from '@/components/ui/StatusPill'
import Spinner from '@/components/ui/Spinner'
import SearchSelect from '@/components/ui/SearchSelect'
import { card, th as thBase, td as tdBase, numCell as numCellBase, notice } from './usageCardStyles'
import type { CSSProperties } from 'react'
import type { operations } from '@/types/api-generated'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/typography'
const th = thBase as CSSProperties
const td = tdBase as CSSProperties
const numCell = numCellBase as CSSProperties

// Invoice row + generate-result shapes lifted from the generated spec
// (RAPPORTEN-SUITE-1 portie 1 / 923-ops drop carries the 2xx invoice schemas) —
// `Required` because the generated element type marks every field optional while
// the backend always populates them for a real invoice row.
type AdminInvoice = Required<
  NonNullable<operations['getAdminInvoices']['responses'][200]['content']['application/json']['data']>[number]
>
type GenerateResult = operations['postAdminInvoicesGenerate']['responses'][200]['content']['application/json']

// Last 12 months as { value: 'YYYY-MM', label } — newest first (mirrors TenantUsageSettings).
// Locale comes from the caller (house `useLocale()`) so the month name follows
// the active UI language instead of a hardcoded 'nl-NL' (§5 locale-aware formatting).
function buildMonths(locale: string) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    return { value, label }
  })
}

// Stream a blob response to disk via a temporary object URL (never a bare <a
// href> navigation) — the download URL itself is never logged, only the id (§8).
async function downloadBlob(route: string, params: Record<string, string>, filename: string) {
  const res = await api.get(route, { params, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AdminInvoicesSettings() {
  const { t } = useTranslation('settings')
  const { formatCurrency } = useNumberFormat()
  const locale = useLocale()
  const months = useMemo(() => buildMonths(locale), [locale])
  const [month, setMonth] = useState(months[0].value)
  const [invoices, setInvoices] = useState<AdminInvoice[]>([])
  const [phase, setPhase] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading')
  const [generating, setGenerating] = useState(false)
  const [finalizingId, setFinalizingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Reload the month's invoices — shared by the initial load and every action
  // that changes server state (generate/finalize), so the list always reflects reality.
  const reload = () => {
    setPhase('loading')
    return api.get('/admin/invoices', { params: { month } })
      .then((res) => {
        const data = unwrap<AdminInvoice[] | { data: AdminInvoice[] }>(res)
        const rows: AdminInvoice[] = Array.isArray(data) ? data : (data?.data ?? [])
        setInvoices(rows)
        setPhase(rows.length > 0 ? 'ready' : 'empty')
      })
      .catch(() => setPhase('error'))
  }

  useEffect(() => { reload() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [month])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      // Response shape from the generated spec: { month, generated, already_final } —
      // the toast reports what really happened instead of a generic "done".
      const res = await api.post('/admin/invoices/generate', { month })
      const body = (res?.data?.data ?? res?.data ?? {}) as GenerateResult
      notifySuccess(body.generated != null
        ? t('adminInvoices.generateResult', { generated: body.generated, alreadyFinal: body.already_final ?? 0 })
        : t('adminInvoices.generateSuccess'))
      await reload()
    } catch (err) {
      notifyError(extractApiError(err, t('adminInvoices.generateFailed')))
    } finally {
      setGenerating(false)
    }
  }

  // Finalize / re-send — the SAME call for both; only the button label differs
  // (see file header). A 422 here means the backend genuinely refused (already
  // final + delivered, some other guard) and surfaces its own message.
  const handleFinalize = async (invoice: AdminInvoice) => {
    setFinalizingId(invoice.id)
    try {
      await api.post(`/admin/invoices/${invoice.id}/finalize`)
      notifySuccess(t(invoice.status === 'final' ? 'adminInvoices.resendSuccess' : 'adminInvoices.finalizeSuccess'))
      await reload()
    } catch (err) {
      notifyError(extractApiError(err, t('adminInvoices.finalizeFailed')))
    } finally {
      setFinalizingId(null)
    }
  }

  const handleDownload = async (invoice: AdminInvoice) => {
    setDownloadingId(invoice.id)
    try {
      await downloadBlob(`/admin/invoices/${invoice.id}/download`, {}, `${invoice.number ?? invoice.id}.pdf`)
    } catch (err) {
      notifyError(extractApiError(err, t('adminInvoices.downloadFailed')))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadBlob('/admin/invoices/export', { month }, `invoices-${month}.xlsx`)
    } catch (err) {
      notifyError(extractApiError(err, t('adminInvoices.exportFailed')))
    } finally {
      setExporting(false)
    }
  }

  const monthOptions = months.map((m) => ({ value: m.value, label: m.label }))
  const selectedMonthLabel = months.find((m) => m.value === month)?.label ?? month

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <PageTitle>{t('adminInvoices.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('adminInvoices.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Searchable month picker (§4 — never a bare native select). */}
          <SearchSelect
            options={monthOptions}
            selected={[month]}
            onToggle={(v: string) => setMonth(v)}
            closeOnToggle
            renderTrigger={(toggle: () => void) => (
              <Button variant="secondary" onClick={toggle}>
                {selectedMonthLabel}
              </Button>
            )}
          />
          <Button variant="primary" onClick={handleGenerate} disabled={generating}>
            {generating ? <Spinner size={13} /> : <RefreshCw size={13} aria-hidden="true" />}
            {t('adminInvoices.generate')}
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={exporting || invoices.length === 0}
            title={t('adminInvoices.exportXlsx')}>
            {exporting ? <Spinner size={13} /> : <FileSpreadsheet size={13} aria-hidden="true" />}
            {t('adminInvoices.exportXlsx')}
          </Button>
        </div>
      </div>

      <div style={card}>
        {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
        {phase === 'error' && <p style={notice}>{t('adminInvoices.loadError')}</p>}
        {phase === 'empty' && <p style={notice}>{t('adminInvoices.empty')}</p>}

        {phase === 'ready' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>{t('adminInvoices.colTenant')}</th>
                <th style={th}>{t('adminInvoices.colNumber')}</th>
                <th style={{ ...th, textAlign: 'right' as const }}>{t('adminInvoices.colTotal')}</th>
                <th style={th}>{t('adminInvoices.colStatus')}</th>
                <th style={{ ...th, textAlign: 'right' as const }}>{t('adminInvoices.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const finalizing = finalizingId === inv.id
                const downloading = downloadingId === inv.id
                // Undelivered final invoice → the re-send path, never a dead/misleading button.
                const isResend = inv.status === 'final' && !inv.sent_at
                return (
                  <tr key={inv.id}>
                    <td style={td}>{inv.tenant_name ?? inv.tenant_id}</td>
                    <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace" as const }}>{inv.number ?? '—'}</td>
                    <td style={numCell}>{formatCurrency(inv.total)}</td>
                    <td style={td}>
                      <StatusPill
                        label={t(`adminInvoices.status.${inv.status}`)}
                        color={inv.status === 'final' ? 'var(--color-success)' : 'var(--text-muted)'}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'right' as const }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        {(inv.status === 'draft' || isResend) && (
                          <Button variant="secondary" size="sm" onClick={() => handleFinalize(inv)} disabled={finalizing}>
                            {finalizing ? <Spinner size={13} /> : <Send size={13} aria-hidden="true" />}
                            {t(isResend ? 'adminInvoices.resend' : 'adminInvoices.finalize')}
                          </Button>
                        )}
                        {inv.status === 'final' && (
                          <Button variant="secondary" size="sm" onClick={() => handleDownload(inv)} disabled={downloading}
                            aria-label={t('adminInvoices.download')}>
                            {downloading ? <Spinner size={13} /> : <Download size={13} aria-hidden="true" />}
                            {t('adminInvoices.download')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
