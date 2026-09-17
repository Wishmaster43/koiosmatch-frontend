/**
 * kpiUnitOptions — pure lookups for the KPI-builder form's unit field. A metric's
 * `kind` decides whether the tenant can pick among several equivalent units (a
 * duration metric can be shown in days/workdays/weeks/months) or is locked to its
 * one `default_unit` (a count/percent/currency metric has no equivalent unit).
 */
import type { KpiUnit } from './kpiDefinitionsApi'

// Metric kinds whose value is a duration — the only case with more than one unit choice.
export const DAY_KINDS = ['avg_days', 'avg_workdays']

// Unit choices offered for a given metric kind; duration kinds fan out to every
// duration unit, everything else is locked to its own default (a single-option list).
export function unitOptionsFor(kind: string, defaultUnit: KpiUnit): KpiUnit[] {
  if (DAY_KINDS.includes(kind)) return ['days', 'workdays', 'weeks', 'months']
  return [defaultUnit]
}

// i18n key per unit — the duration/hour words already exist on the threshold
// screens (settings namespace); count/percent/currency are new KPI-builder keys.
export const UNIT_LABEL_KEY: Record<KpiUnit, string> = {
  days: 'settings:settings.options.window_unit.days',
  workdays: 'settings:settings.options.window_unit.workdays',
  weeks: 'settings:settings.options.window_unit.weeks',
  months: 'settings:settings.options.window_unit.months',
  hours: 'settings:settings.options.window_unit.hours',
  minutes: 'settings:settings.options.window_unit.minutes',
  count: 'kpiBuilder.unit.count',
  percent: 'kpiBuilder.unit.percent',
  currency: 'kpiBuilder.unit.currency',
}

// The `koios` entity has no report page reading `custom_kpis` yet (§3 no fake
// affordance) — its sub-tab is hidden from the KPI-builder until one does (R9).
export const ENTITIES_WITHOUT_REPORT_SURFACE = ['koios']

// Where a KPI definition can be shown. `dashboard` is withheld in this slice:
// GET /api/dashboard carries no custom_kpis yet, so offering that chip would
// persist a setting nothing renders (§1.7, follow-up row KPI-BUILDER-DASH).
export const SURFACE_OPTIONS: Array<'report'> = ['report']
