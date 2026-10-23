/**
 * InboundNumberSelect — the Source + WhatsApp number pickers of the webhook
 * trigger (INBOUND-TRIGGER-NUMBER, ONIX I-002): an inbound scenario is bound to
 * ONE number row per lane. The options come ONCE from GET /inbound-numbers and
 * are filtered on `group === source`; a failed fetch is an error, never "empty".
 */
import { useState, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrapList } from '@/lib/api'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Spinner from '@/components/ui/Spinner'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'
import { selectStyle, sectionLabel } from './scheduleModalStyles'

// One option of GET /inbound-numbers (contract LANE-B-R2): value = number ROW id.
interface InboundNumber { value: string; label: string; group: 'meta' | 'wa_web' }

// Lane ids the BE trigger schema serves for `source`.
const SOURCES = ['meta', 'wa_web'] as const

// Source picker plus the lane-filtered number picker, controlled by the form hook.
export function InboundNumberSelect({ source, numberId, onSourceChange, onNumberChange }: {
  source: string; numberId: string
  onSourceChange: (s: string) => void; onNumberChange: (id: string) => void
}) {
  const { t } = useTranslation('workflows')
  const [rows, setRows] = useState<InboundNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const sourceId = useId()
  const numberLabelId = useId()

  // Fetch the bureau's inbound numbers once (alive-guarded against unmount).
  useEffect(() => {
    let alive = true
    setLoading(true); setFailed(false)
    import('@/lib/api').then(m => m.default.get('/inbound-numbers'))
      .then(r => { if (alive) setRows(unwrapList<InboundNumber>(r).rows) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const laneRows = rows.filter(n => n.group === source)
  const sourceOptions = SOURCES.map(s => ({
    value: s, label: t(s === 'meta' ? 'scheduleModal.sourceMeta' : 'scheduleModal.sourceWaWeb'),
  }))

  // Switching lane drops a chosen number that belongs to the other lane.
  const changeSource = (s: string) => {
    if (!s || s === source) return
    onSourceChange(s)
    if (!rows.some(n => n.value === numberId && n.group === s)) onNumberChange('')
  }

  return (
    <>
      <div style={{ marginTop: 12 }}>
        <label id={sourceId} style={sectionLabel}>{t('fieldLabels.Source')}</label>
        {/* DROPDOWN-CLEAR-1: a webhook trigger always runs on one lane (default meta); '' is no lane and would save a trigger_config.source the BE cannot route. */}
        <CreatableSelect value={source} onChange={changeSource} aria-labelledby={sourceId}
          allowCreate={false} clearable={false} options={sourceOptions} style={selectStyle} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label id={numberLabelId} style={sectionLabel}>{t('fieldLabels.WhatsApp number')}</label>
        {loading && <Spinner label={t('scheduleModal.numberLoading')} />}
        {failed && <ErrorBanner>{t('common:actionFailed')}</ErrorBanner>}
        {!loading && !failed && laneRows.length === 0 && (
          <Caption as="p">{t('scheduleModal.noInboundNumbers')}</Caption>
        )}
        {!loading && !failed && laneRows.length > 0 && (
          <CreatableSelect value={numberId} onChange={onNumberChange} aria-labelledby={numberLabelId}
            allowCreate={false} placeholder={t('scheduleModal.numberSelect')}
            options={laneRows.map(n => ({ value: n.value, label: n.label }))} style={selectStyle} />
        )}
        <Caption as="p" style={{ marginTop: 6 }}>{t('scheduleModal.numberHint')}</Caption>
      </div>
    </>
  )
}
