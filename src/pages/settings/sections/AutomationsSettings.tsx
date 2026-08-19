/**
 * AutomationsSettings — Settings → Workflows → Automations. Lists the tenant's
 * workflows as rows, each with (a) an active/draft toggle, (b) for a
 * `date_relative` trigger the shared "days before" rijtje (DateRelativeFields —
 * same component the builder trigger panel uses), and (c) the target audience
 * (`segment.status[]` / `segment.phase[]`) against the candidate statuses/phases
 * lookups. One source of truth: every change is a PATCH to `/workflows/{id}` —
 * the builder reads/writes the exact same `trigger_config`/`segment` shape.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import Toggle from '@/components/ui/Toggle'
import MultiSelectField from '@/components/layout/workflow/MultiSelectField'
import { DateRelativeFields, DATE_RELATIVE_FIELDS, dateRelativeFieldLabel } from '@/components/layout/workflow/DateRelativeFields'
import { SettingsScaffold, SettingCard, SettingCardList } from '../components/SettingsKit'
import { Caption } from '@/components/ui/typography'

// One tenant workflow row, only the fields this screen reads/writes.
interface AutomationRow {
  id: string | number
  name: string
  status: string
  trigger_type?: string
  trigger_config?: { date_field?: string; offset_days?: number; [k: string]: unknown } | null
  segment?: { status?: string[]; phase?: string[] } | null
}

export default function AutomationsSettings() {
  const { t } = useTranslation(['settings', 'workflows', 'common'])
  const [rows, setRows] = useState<AutomationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Per-row save-in-flight guard so a fast double-click can't fire two PATCHes.
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})

  // Load the tenant's workflows once on mount.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    api.get('/workflows').then(res => {
      if (!alive) return
      setRows(unwrapList<AutomationRow>(res).rows)
    }).catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // One generic PATCH helper: optimistic update, roll back + toast on failure.
  const patchRow = (id: string | number, body: Record<string, unknown>, optimistic: Partial<AutomationRow>) => {
    const prev = rows
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...optimistic } : r))
    setSavingIds(s => ({ ...s, [id]: true }))
    api.patch(`/workflows/${id}`, body)
      .catch(() => { setRows(prev); notifyError(t('common:actionFailed')) })
      .finally(() => setSavingIds(s => ({ ...s, [id]: false })))
  }

  const toggleStatus = (row: AutomationRow) => {
    const nextStatus = row.status === 'active' ? 'draft' : 'active'
    patchRow(row.id, { status: nextStatus }, { status: nextStatus })
  }

  // Days-before edit: UI keeps a positive value, storage negates it (contract).
  const setOffsetDays = (row: AutomationRow, days: string) => {
    const n = Number(days)
    if (Number.isNaN(n) || n < 0) return
    const trigger_config = { ...row.trigger_config, offset_days: -n }
    patchRow(row.id, { trigger_config }, { trigger_config })
  }

  const setDateField = (row: AutomationRow, field: string) => {
    const trigger_config = { ...row.trigger_config, date_field: field }
    patchRow(row.id, { trigger_config }, { trigger_config })
  }

  const setSegment = (row: AutomationRow, axis: 'status' | 'phase', values: string[]) => {
    const segment = { ...row.segment, [axis]: values }
    patchRow(row.id, { segment }, { segment })
  }

  return (
    <SettingsScaffold title={t('automations.title')} subtitle={t('automations.subtitle')}
      form={{ loading, loadError: error }} maxWidth={720} actions={undefined}>
      {/* Scaffold already covers loading (skeleton) / error (banner); empty + success stay here (§3). */}
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('automations.empty')}</p>
      ) : (
        <SettingCardList>
          {rows.map(row => {
            const isDateRelative = row.trigger_type === 'date_relative'
            const days = Math.abs(row.trigger_config?.offset_days ?? 0)
            const dateField = row.trigger_config?.date_field ?? DATE_RELATIVE_FIELDS[0].value
            return (
              <SettingCard key={row.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{row.name}</div>
                    {isDateRelative && (
                      <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <CalendarClock size={12} />
                        {/* Read-only: the date field the offset is measured against. */}
                        {t('automations.dateFieldReadOnly', { field: dateRelativeFieldLabel(t, dateField) })}
                      </Caption>
                    )}
                  </div>
                  <Toggle checked={row.status === 'active'} onChange={() => toggleStatus(row)}
                    disabled={!!savingIds[row.id]}
                    ariaLabel={t('automations.toggleAriaLabel', { name: row.name })} />
                </div>

                {isDateRelative && (
                  <DateRelativeFields dateField={dateField} onDateFieldChange={v => setDateField(row, v)}
                    days={days} onDaysChange={v => setOffsetDays(row, v)} disabled={!!savingIds[row.id]} />
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {t('automations.segmentStatusLabel')}
                  </label>
                  <MultiSelectField
                    field={{ key: 'status', source: 'candidate_statuses', label: t('automations.segmentStatusLabel') }}
                    value={row.segment?.status ?? []}
                    onChange={(_key, value) => setSegment(row, 'status', value as string[])} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {t('automations.segmentPhaseLabel')}
                  </label>
                  <MultiSelectField
                    field={{ key: 'phase', source: 'candidate_phases', label: t('automations.segmentPhaseLabel') }}
                    value={row.segment?.phase ?? []}
                    onChange={(_key, value) => setSegment(row, 'phase', value as string[])} />
                </div>
              </SettingCard>
            )
          })}
        </SettingCardList>
      )}
    </SettingsScaffold>

  )
}
