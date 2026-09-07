/**
 * Report filter definitions — shared helpers for status and workflow filter groups
 * used by MessagesTable and RunsTable. Builds option lists from distinct values
 * present in the row data; onToggle follows the shared panel's select/deselect pattern.
 */
import type { TFunction } from 'i18next'
import type { ReportFilterGroup } from '@/types/reports'

/**
 * Builds a status filter group from distinct status values in the report rows.
 * Renders i18n labels via t(`<namespace>.status.<value>`), falling back to the raw value.
 * Messages lowercases the status key for i18n lookup; Runs uses it as-is.
 */
export function buildStatusGroup(
  t: TFunction,
  statusValues: (string | undefined)[],
  selectedStatuses: (string | number)[],
  rows: Array<{ status?: string }>,
  labelKey: string,
  onToggle: (v: string | number) => void,
  keyTransform?: (s: string) => string,
): ReportFilterGroup {
  const transform = keyTransform ?? ((s: string) => s)
  const namespace = labelKey.split('.')[0]
  return {
    key: 'status',
    label: t(labelKey),
    selected: selectedStatuses,
    options: statusValues.map(s => ({
      value: s || '',
      label: t(`${namespace}.status.${transform(s || '')}`, { defaultValue: s || '' }),
      count: rows.filter(r => r.status === s).length,
    })),
    onToggle,
  }
}

/**
 * Builds a workflow filter group from distinct workflow names in the report rows.
 * Renders a searchable select with workflow names as labels and row counts per workflow.
 */
export function buildWorkflowGroup(
  t: TFunction,
  workflowNames: (string | undefined)[],
  selectedWorkflows: (string | number)[],
  rows: Array<{ workflow_name?: string }>,
  labelKey: string,
  onToggle: (v: string | number) => void,
): ReportFilterGroup {
  return {
    key: 'workflow',
    label: t(labelKey),
    type: 'search-select',
    selected: selectedWorkflows,
    options: workflowNames.map(w => ({
      value: w || '',
      label: w || '',
      count: rows.filter(r => r.workflow_name === w).length,
    })),
    onToggle,
  }
}
