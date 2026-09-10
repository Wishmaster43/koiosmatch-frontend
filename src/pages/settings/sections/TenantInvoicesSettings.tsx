/**
 * TenantInvoicesSettings (INVOICE-1, settings.billing_invoices) — the tenant's own
 * "Facturen" screen: a paginated list of the tenant's FINAL invoices only (drafts
 * never leave the superadmin console). Gated on `billing.view` at the registry
 * level (mirrors BillingUsageSettings) — this whole screen stays hidden, never a
 * disabled shell, for a user without the permission (§3). Replaces the old
 * PlaceholderSettings stub (BillingSettings.jsx, now retired).
 * Contract: GET /billing/invoices (paginated) · GET /billing/invoices/{id}/download
 * (blob PDF, IDOR-safe — a draft or another tenant's invoice 404s). The download
 * URL itself is never logged (§8 — no PII/IDs in logs), only the invoice id.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import StatusPill from '@/components/ui/StatusPill'
import Spinner from '@/components/ui/Spinner'
import PaginationBar from '@/components/ui/PaginationBar'
import { card, th as thBase, td as tdBase, numCell as numCellBase, notice } from './usageCardStyles'
import type { CSSProperties } from 'react'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/typography'
import type { TenantInvoice } from './invoiceTypes'
// SMZ-13: InvoiceController::index paginates at a hardcoded 20 per page —
// per_page is not honoured server-side, so the page-size selector is fixed.
const PAGE_SIZE = 20
const th = thBase as CSSProperties
const td = tdBase as CSSProperties
const numCell = numCellBase as CSSProperties

// Status → soft-chip colour (semantic tokens only, §4). Final invoices are always
// 'final' server-side, but a future 'credited' state is handled defensively.
const STATUS_COLOR: Record<string, string> = {
  final: 'var(--color-success)',
  credited: 'var(--color-info)',
}

/**
 * Streams one invoice PDF via the shared axios client (cookie/CSRF already
 * attached) into a temporary object URL — never a bare `<a href>` navigation, and
 * the download URL itself is never logged, only the (non-PII) invoice id.
 */
async function downloadInvoicePdf(id: string, number: string | null) {
  const res = await api.get(`/billing/invoices/${id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${number ?? id}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Read-only list of the tenant's own billing invoices, each downloadable as a PDF.
export default function TenantInvoicesSettings() {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()
  const { formatCurrency } = useNumberFormat()
  const [invoices, setInvoices] = useState<TenantInvoice[]>([])
  // Four explicit UI states (§3): loading | error | empty | success (ready).
  const [phase, setPhase] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  // Server pagination (SMZ-13): the endpoint paginates at 20/page, so page 2+
  // must be requested explicitly rather than only ever reading page 1.
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Fetch the tenant's own final invoices, newest first — abort-guarded (§9).
  // Empty means total === 0 (the SERVER count), never rows.length === 0 — a
  // page 2+ request that happens to land past the last row must never show
  // the "no invoices" empty state.
  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    api.get('/billing/invoices', { params: { page }, signal: ctrl.signal })
      .then((res) => {
        const { rows, lastPage: lp, total: t } = unwrapList<TenantInvoice>(res)
        setInvoices(rows)
        setLastPage(lp)
        setTotal(t)
        setPhase(t === 0 ? 'empty' : 'ready')
      })
      .catch(() => { if (!ctrl.signal.aborted) setPhase('error') })
    return () => ctrl.abort()
  }, [page])

  // Downloads one invoice's PDF, tracking its own id so only that row shows a busy state; failures surface the server's own reason.
  const handleDownload = async (invoice: TenantInvoice) => {
    setDownloadingId(invoice.id)
    try {
      await downloadInvoicePdf(invoice.id, invoice.number)
    } catch (err) {
      notifyError(extractApiError(err, t('billing.invoices.downloadError')))
    } finally {
      setDownloadingId(null)
    }
  }

  // Rows already in state stay visible across a page change or a failed
  // refetch — the spinner is reserved for the true first load (no rows yet),
  // and the pager stays mounted through an error so the user can navigate back.
  const hasRows = invoices.length > 0

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <PageTitle>{t('billing.invoices.title')}</PageTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('billing.invoices.desc')}</p>
      </div>

      <div style={card}>
        {phase === 'loading' && !hasRows && (
          <p style={notice}><span style={{ display: 'inline-flex' /* deliberate: inline-flex aligns the SVG baseline inside running text (was inline) */, marginRight: 6 }}><Spinner size={13} /></span>{t('common.loadingShort')}</p>
        )}
        {phase === 'error' && <p style={notice}>{t('billing.invoices.loadError')}</p>}
        {phase === 'empty' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <p style={notice}>{t('billing.invoices.empty')}</p>
          </div>
        )}

        {hasRows && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>{t('billing.invoices.colNumber')}</th>
                  <th style={th}>{t('billing.invoices.colPeriod')}</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>{t('billing.invoices.colTotal')}</th>
                  <th style={th}>{t('billing.invoices.colStatus')}</th>
                  <th style={th}>{t('billing.invoices.colDate')}</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>{t('billing.invoices.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const downloading = downloadingId === inv.id
                  return (
                    <tr key={inv.id}>
                      <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace" as const }}>{inv.number ?? '—'}</td>
                      <td style={td}>{inv.period}</td>
                      <td style={numCell}>{formatCurrency(inv.total)}</td>
                      <td style={td}>
                        <StatusPill label={t(`billing.invoices.status.${inv.status}`, inv.status)} color={STATUS_COLOR[inv.status] ?? 'var(--text-muted)'} />
                      </td>
                      <td style={td}>{formatDate(inv.finalized_at ?? inv.sent_at)}</td>
                      <td style={{ ...td, textAlign: 'right' as const }}>
                        <Button variant="secondary" size="sm" onClick={() => handleDownload(inv)} disabled={downloading}
                          aria-label={t('billing.invoices.download')}>
                          {downloading ? <Spinner size={13} /> : <Download size={13} aria-hidden="true" />}
                          {t('billing.invoices.download')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* SMZ-13: server-fixed page size (per_page is not honoured) — no
                onPageSizeChange/multi-option list, so PaginationBar itself
                hides the rows-per-page control (§3 no fake affordances). */}
            <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={PAGE_SIZE}
              onPageChange={setPage} pageSizeOptions={[PAGE_SIZE]} />
          </>
        )}
      </div>
    </div>
  )
}
