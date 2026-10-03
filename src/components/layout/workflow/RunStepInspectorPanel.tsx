/**
 * RunStepInspectorPanel — RUN-INSPECTOR-1: the Make-style "Input | Output"
 * operation inspector for one run step. Loads the full step envelope
 * (GET /workflow-runs/{run}/steps/{step}, FINAL CONTRACT a08cc838), shows the
 * execution log (`attempts_log`, newest-25) as an attempt switcher, and renders
 * each attempt's input/output through the shared OutputTree (typed/counts/
 * bundles options) — one tree component, never a second. Load-more pages a
 * list key from the step's own `output` (never from an attempt row — those are
 * fixed at 50, no pagination) and is only reachable for the newest attempt,
 * since pagination tracks the step's current/merged output, not a past retry.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import SegmentedControl from '@/components/ui/SegmentedControl'
import SelectMenu from '@/components/ui/SelectMenu'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { Caption, SectionTitle, GroupLabel, Mono } from '@/components/ui/typography'
import { formatDateTimeStr } from '@/lib/localDate'
import { useNumberFormat } from '@/lib/formatters'
import { extractApiError } from '@/lib/extractApiError'
import { StepStatusBadge, formatDuration } from '@/components/reports/runFormat'
import OutputTree from './OutputTree'
import { useModuleCatalog } from './useModuleCatalog'
import { useRunStepDetail, useRunStepListPage } from './useRunStepDetail'
import type { RunStepAttemptLogRow } from './runStepApi'

// Byte size of a value as sent (rough: JSON length), for the header summary line.
function jsonByteSize(v: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(v ?? {})).length } catch { return 0 }
}

// True for a genuinely empty bundle ({} / null / undefined) — the honest empty caption, never "missing".
function isEmptyBundle(v: unknown): boolean {
  return v == null || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)
}

// One Input/Output column: search + typed tree, driven by the shared expand/collapse signals.
function RunStepColumn({ title, data, fields, ownKeys, emptyLabel, expandSignal, collapseSignal }: {
  title: string; data: unknown; fields: 'all' | 'own'; ownKeys: string[] | null; emptyLabel: string
  expandSignal: number; collapseSignal: number
}) {
  // "own" keeps only the module's own output_fields keys — everything else (an
  // upstream bundle slice riding along in the merged step output) is hidden;
  // "all" shows the full payload. No catalog match (ownKeys null) falls back to "all".
  const shown = useMemo(() => {
    if (fields !== 'own' || !ownKeys?.length || data == null || typeof data !== 'object' || Array.isArray(data)) return data
    const obj = data as Record<string, unknown>
    const picked: Record<string, unknown> = {}
    for (const k of ownKeys) if (k in obj) picked[k] = obj[k]
    return picked
  }, [data, fields, ownKeys])
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <GroupLabel style={{ marginBottom: 4 }}>{title}</GroupLabel>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {isEmptyBundle(data)
          ? <Caption style={{ fontStyle: 'italic', padding: 4, display: 'block' }}>{emptyLabel}</Caption>
          : <OutputTree data={shown} typed counts bundles fill expandSignal={expandSignal} collapseSignal={collapseSignal} />}
      </div>
    </div>
  )
}

// One attempts_log row: status pill + timestamp + a one-line summary.
function AttemptLogRow({ row, t }: { row: RunStepAttemptLogRow; t: (k: string, o?: Record<string, unknown>) => string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
      <StepStatusBadge status={row.status} />
      <Mono style={{ fontSize: 11 }}>{row.executed_at ? formatDateTimeStr(row.executed_at) : '—'}</Mono>
      {row.error && <Caption style={{ color: 'var(--color-danger-text)' }}>{String(row.error)}</Caption>}
      <Caption style={{ marginLeft: 'auto' }}>{t('inspector.attempt', { n: row.attempt ?? '—' })}</Caption>
    </div>
  )
}

// One loaded page of a list key, keyed by list name — merged into the newest
// attempt's Output column so load-more actually grows the visible rows.
interface ListPageState { rows: unknown[]; page: number; lastPage: number }

export default function RunStepInspectorPanel({ runId, stepId, moduleLabel, onClose }: {
  runId: string | number; stepId: string | number; moduleLabel: string; onClose: () => void
}) {
  const { t } = useTranslation('workflows')
  // GETALLEN-1: every count the user sees (log rows, list totals, bytes) goes through the active locale.
  const { formatFileSizeMb, formatNumber } = useNumberFormat()
  const { step, loading, error, forbidden, refetch } = useRunStepDetail(runId, stepId)
  const { catalog } = useModuleCatalog()
  const ownKeys = step?.module_type ? Object.keys(catalog[step.module_type]?.outputFields ?? {}) : null
  const [fields, setFields] = useState<'all' | 'own'>('all')
  const [expandSignal, setExpandSignal] = useState(0)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [attemptIdx, setAttemptIdx] = useState(0)
  // Newest first in the switcher — the contract's `attempts_log` arrives oldest→newest.
  const logNewestFirst = useMemo(() => [...(step?.attempts_log ?? [])].reverse(), [step?.attempts_log])
  const activeAttempt = logNewestFirst[attemptIdx] ?? null
  const isNewestAttempt = attemptIdx === 0

  // Per-key loaded pages (newest attempt only) — one pending fetch at a time.
  const [listPages, setListPages] = useState<Record<string, ListPageState>>({})
  const [pendingFetch, setPendingFetch] = useState<{ key: string; page: number } | null>(null)
  const { page: listPageResult, loading: listLoading, errorObj: listErrorObj } = useRunStepListPage(
    runId, stepId, pendingFetch ? { list: pendingFetch.key, page: pendingFetch.page, per_page: 50 } : null,
  )
  // Merge a resolved page into its key's state once (guards the effect against
  // re-firing on the same settled query result).
  useEffect(() => {
    if (!listPageResult || !pendingFetch || listPageResult.key !== pendingFetch.key) return
    setListPages(prev => {
      const existing = prev[pendingFetch.key]
      if (existing?.page === listPageResult.meta.current_page) return prev
      return { ...prev, [pendingFetch.key]: {
        rows: [...(existing?.rows ?? []), ...listPageResult.data],
        page: listPageResult.meta.current_page, lastPage: listPageResult.meta.last_page,
      } }
    })
    setPendingFetch(null)
  }, [listPageResult, pendingFetch])
  const listErrorMessage = listErrorObj ? extractApiError(listErrorObj, t('inspector.loadMoreFailed')) : null

  // Output for the newest attempt is the step's own output with loaded list
  // pages appended; an older attempt shows its own frozen output (no pagination).
  const mergedOutput = useMemo(() => {
    const base = (step?.output ?? {}) as Record<string, unknown>
    if (!isNewestAttempt || !Object.keys(listPages).length) return base
    const merged: Record<string, unknown> = { ...base }
    for (const [key, pageState] of Object.entries(listPages)) {
      const baseRows = Array.isArray(base[key]) ? (base[key] as unknown[]) : []
      merged[key] = [...baseRows, ...pageState.rows]
    }
    return merged
  }, [step?.output, listPages, isNewestAttempt])

  const operationCount = logNewestFirst.length || 1
  const titleText = `${moduleLabel} · ${t('inspector.operation', { n: operationCount })}`
  const size = jsonByteSize(step?.output) + logNewestFirst.reduce((n, r) => n + jsonByteSize(r.input) + jsonByteSize(r.output), 0)

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={titleText} title={titleText} width={960} maxWidth="96vw"
      persistKey="workflow-run-step-inspector" resizable maximizable bodyStyle={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      scrollBody={false}>
      {loading && <div style={{ padding: 24, textAlign: 'center' }}><Spinner size={18} /></div>}
      {!loading && error && (
        <ErrorBanner onRetry={() => refetch()}>{t('common:errorGeneric')}</ErrorBanner>
      )}
      {/* Honest "no access"/"no data" states — never a blank body (§3 four states). */}
      {!loading && !error && forbidden && (
        <Caption style={{ padding: 24, textAlign: 'center', display: 'block' }}>{t('inspector.forbidden')}</Caption>
      )}
      {!loading && !error && !forbidden && !step && (
        <Caption style={{ padding: 24, textAlign: 'center', display: 'block' }}>{t('inspector.noData')}</Caption>
      )}
      {!loading && !error && !forbidden && step && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
          {/* Header summary: status + started/duration + operation count + payload size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StepStatusBadge status={step.status} />
            <Caption>{t('inspector.summary', { count: operationCount, size: formatFileSizeMb(size / (1024 * 1024)) })}</Caption>
            {step.started_at && <Mono style={{ fontSize: 11 }}>{formatDateTimeStr(step.started_at)}</Mono>}
            {step.duration_ms != null && <Caption>{formatDuration(step.duration_ms)}</Caption>}
          </div>

          {/* Attempt switcher (execution log) — newest first */}
          {logNewestFirst.length > 1 && (
            <SegmentedControl
              ariaLabel={t('inspector.attemptCount', { count: logNewestFirst.length })}
              options={logNewestFirst.map((row, i) => ({ value: String(i), label: t('inspector.attempt', { n: row.attempt ?? i + 1 }) }))}
              value={String(attemptIdx)} onChange={v => setAttemptIdx(Number(v))} size="compact" />
          )}
          {step.attempts_total != null && step.attempts_total > logNewestFirst.length && (
            <Caption>{t('inspector.log', { shown: formatNumber(logNewestFirst.length), total: formatNumber(step.attempts_total ?? logNewestFirst.length) })}</Caption>
          )}

          {/* Toolbar: fields filter + expand/collapse-all */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* DROPDOWN-CLEAR-1: the Fields filter always has a value ("all" or "own") — an
                empty filter has no meaning for a tree that must show something. */}
            <SelectMenu value={fields} onChange={v => setFields(v as 'all' | 'own')} clearable={false}
              options={[{ value: 'all', label: t('inspector.fieldsAll') }, { value: 'own', label: t('inspector.fieldsOwn') }]}
              leading={<Caption>{t('inspector.fields')}</Caption>} />
            <Button variant="ghost" size="sm" iconOnly aria-label={t('inspector.expandAll')} title={t('inspector.expandAll')}
              onClick={() => setExpandSignal(s => s + 1)}>
              <ChevronsUpDown size={14} />
            </Button>
            <Button variant="ghost" size="sm" iconOnly aria-label={t('inspector.collapseAll')} title={t('inspector.collapseAll')}
              onClick={() => setCollapseSignal(s => s + 1)}>
              <ChevronsDownUp size={14} />
            </Button>
          </div>

          {/* Input | Output columns */}
          <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
            <RunStepColumn title={t('inspector.input')} data={activeAttempt ? activeAttempt.input : {}} fields={fields} ownKeys={ownKeys}
              emptyLabel={t('inspector.noInput')} expandSignal={expandSignal} collapseSignal={collapseSignal} />
            <RunStepColumn title={t('inspector.output')} data={isNewestAttempt ? mergedOutput : (activeAttempt?.output ?? {})}
              fields={fields} ownKeys={ownKeys}
              emptyLabel={t('inspector.noOutput')} expandSignal={expandSignal} collapseSignal={collapseSignal} />
          </div>

          {/* Load-more per list key — newest attempt only (pagination tracks the
              step's current/merged output, never a frozen past retry). */}
          {isNewestAttempt && !!step.list_keys?.length && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {step.list_keys.map(key => {
                  const out = step.output as Record<string, unknown> | undefined
                  const baseRows = Array.isArray(out?.[key]) ? (out![key] as unknown[]) : []
                  const loaded = listPages[key]
                  const shown = baseRows.length + (loaded?.rows.length ?? 0)
                  const total = typeof out?.[`${key}_total`] === 'number' ? (out![`${key}_total`] as number) : shown
                  if (total <= shown) return null
                  if (loaded && loaded.page >= loaded.lastPage) return null
                  const nextPage = (loaded?.page ?? 1) + 1
                  return (
                    <Button key={key} variant="secondary" size="sm" disabled={listLoading && pendingFetch?.key === key}
                      onClick={() => setPendingFetch({ key, page: nextPage })}>
                      {t('inspector.loadMore', { shown: formatNumber(shown), total: formatNumber(total) })}
                    </Button>
                  )
                })}
              </div>
              {listErrorMessage && <Caption style={{ color: 'var(--color-danger-text)' }}>{listErrorMessage}</Caption>}
            </div>
          )}

          {/* Execution log — the full attempts_log list, status + timestamp per row */}
          {logNewestFirst.length > 0 && (
            <div>
              <SectionTitle as="div" style={{ marginBottom: 4 }}>{t('inspector.log', { shown: formatNumber(logNewestFirst.length), total: formatNumber(step.attempts_total ?? logNewestFirst.length) })}</SectionTitle>
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                {logNewestFirst.map((row, i) => <AttemptLogRow key={i} row={row} t={t} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </FloatingPanel>
  )
}
