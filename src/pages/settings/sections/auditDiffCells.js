/**
 * buildDiffCells — turns ONE audit entry into the two compact before/after strings
 * shown in the audit log. Owns nothing else: no state, no rendering, no i18n keys of
 * its own beyond the audit.* namespace it formats with.
 *
 * Pulled out of AuditLog.jsx because it is consumed twice (the table row AND the CSV
 * export) and is pure — keeping it beside the component made both callers depend on a
 * render file, and hid a genuinely testable mapper inside a 400-line screen.
 */
import { KPI_KEYS, isAccessEvent, buildFieldDiff } from './auditShared'

// Build the compact before/after cells shown in the table row. Special-cased log
// names (roles/settings/sync) carry their own bespoke `properties` shape; every
// other write event (candidate/vacancy/task/opportunity/match/customer/…) uses the
// uniform CHANGELOG-3 diff (`entry.changes`), generalised via buildFieldDiff so this
// table renders exactly what the per-entity changelog popovers show.
export function buildDiffCells(entry, t) {
  const p = entry.properties ?? {}
  const kpiLabel = (k) => KPI_KEYS.includes(k) ? t(`audit.kpi.${k}`) : k

  if (entry.log_name === 'roles') {
    if (p.before !== undefined && p.after !== undefined) {
      const removed = (p.before ?? []).filter(x => !(p.after ?? []).includes(x))
      const added   = (p.after  ?? []).filter(x => !(p.before ?? []).includes(x))
      return { beforeCell: removed.length ? removed.join(', ') : '—', afterCell: added.length ? added.join(', ') : '—' }
    }
    if (p.name) return { beforeCell: '—', afterCell: p.name }
  }

  if (entry.log_name === 'settings') {
    if (p.before && p.after) {
      const changed = Object.keys(p.after).filter(k => String(p.before[k]) !== String(p.after[k]))
      if (!changed.length) return { beforeCell: '—', afterCell: t('audit.noChanges') }
      return {
        beforeCell: changed.map(k => `${kpiLabel(k)}: ${p.before[k] ?? '—'}`).join(' · '),
        afterCell:  changed.map(k => `${kpiLabel(k)}: ${p.after[k]}`).join(' · '),
      }
    }
    if (p.keys) return { beforeCell: '—', afterCell: t('audit.keysUpdated', { count: p.keys.length }) }
  }

  if (entry.log_name === 'sync') {
    return {
      beforeCell: '—',
      afterCell: [
        p.synced   != null && t('audit.cell.synced',   { count: p.synced }),
        p.errors   != null && p.errors > 0 && t('audit.cell.errors', { count: p.errors }),
        p.duration != null && p.duration,
      ].filter(Boolean).join(' · ') || '—',
    }
  }

  // Access (read) events never carry an old→new diff — the compliance log only
  // records WHO opened WHICH dossier, WHEN.
  if (isAccessEvent(entry)) return { beforeCell: '—', afterCell: '—' }

  // Generalised entity write (CHANGELOG-3): one compact "field: value" per changed
  // field, same field set/order as the per-entity changelog popover.
  const diffRows = buildFieldDiff(entry, t)
  if (diffRows.length) {
    return {
      beforeCell: diffRows.map(r => `${r.label}: ${r.before}`).join(' · '),
      afterCell:  diffRows.map(r => `${r.label}: ${r.after}`).join(' · '),
    }
  }

  return { beforeCell: '—', afterCell: '—' }
}
