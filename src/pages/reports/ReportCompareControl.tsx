/**
 * ReportCompareControl (RAPPORT-COMPARE-1 adoption) — the ONE UI for picking a
 * report's comparison window: off / previous period / previous year / a custom
 * range. Backed by the `ReportCompareMode` discriminated union so "previous_period
 * AND a custom range" is not a state this control can produce — never two
 * independent booleans a caller could combine into the backend's 422.
 *
 * A searchable dropdown (§0 house rule) picks the mode; a custom mode reveals two
 * native date inputs (the one exempted case — a raw date picker — per §3B).
 * Rendered only by a report page that has a real compare slug (reportCompareSupport.ts);
 * a report with no slug simply never mounts this component — no disabled picker.
 */
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import type { ReportCompareMode } from './reportCompareMode'

const OPTIONS = ['off', 'previous_period', 'previous_year', 'custom'] as const

export default function ReportCompareControl({ mode, onChange }: {
  mode: ReportCompareMode
  onChange: (mode: ReportCompareMode) => void
}) {
  const { t } = useTranslation('analytics')

  const optionItems = OPTIONS.map(value => ({ value, label: t(`compare.mode.${value}`) }))

  const setKind = (kind: string) => {
    if (kind === 'previous_period') onChange({ kind: 'previous_period' })
    else if (kind === 'previous_year') onChange({ kind: 'previous_year' })
    else if (kind === 'custom') onChange({ kind: 'custom', from: '', to: '' })
    else onChange({ kind: 'off' })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)' }} htmlFor="report-compare-mode">
        {t('compare.label')}
      </label>
      <div style={{ minWidth: 200 }}>
        <CreatableSelect
          id="report-compare-mode"
          allowCreate={false}
          clearable
          clearLabel={t('compare.mode.off')}
          options={optionItems}
          value={mode.kind === 'off' ? '' : mode.kind}
          onChange={setKind}
          placeholder={t('compare.mode.off')}
        />
      </div>
      {mode.kind === 'custom' && (
        <>
          <input type="date" aria-label={t('compare.customFrom')} value={mode.from}
            onChange={e => onChange({ kind: 'custom', from: e.target.value, to: mode.to })}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('compare.rangeSeparator')}</span>
          <input type="date" aria-label={t('compare.customTo')} value={mode.to}
            onChange={e => onChange({ kind: 'custom', from: mode.from, to: e.target.value })}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }} />
        </>
      )}
    </div>
  )
}
