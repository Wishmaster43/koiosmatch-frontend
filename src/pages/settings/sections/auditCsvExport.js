/**
 * exportAuditCsv — owns the audit log's CSV export: the column set, the AVG-safe cell
 * escaping and the browser download side effect. Pulled out of AuditLog.jsx so the
 * component stays declarative (§3: logic lives outside the JSX) and the export's
 * column order can change without touching the screen.
 */
import { escapeCsvCell } from '@/lib/csv'
import { entityLabel } from './auditShared'
import { buildDiffCells } from './auditDiffCells'
// House numeric shapes (DATUM-1) — from lib/localDate, the init-free module, since
// this is a pure module (no react-i18next hook access) and must not drag in the
// i18n init that lib/datetime carries for its locale-aware month/weekday names.
import { ddmmyyyy, hhmm } from '@/lib/localDate'

// Export the currently-filtered log to CSV (UTF-8 BOM for Excel; AVG accountability).
// Cells go through the shared escapeCsvCell, which also guards against formula
// injection (a leading =+-@ opened as a live formula in Excel/Sheets — C-14).
export function exportAuditCsv(entries, t) {
  // actor_label ("<name>-KoiosAI") wins over the human causer_name when present.
  const who = (e) => e.causer_email
    ? `${e.actor_label ?? e.causer_name ?? t('audit.system')} (${e.causer_email})`
    : (e.actor_label ?? e.causer_name ?? t('audit.system'))
  const header = [t('audit.colDate'), t('audit.colTime'), t('audit.colWho'), t('audit.colType'), t('audit.colEntity'), t('audit.colAction'), t('audit.colOldValue'), t('audit.colNewValue')]
  const rows = entries.map(e => {
    const { beforeCell, afterCell } = buildDiffCells(e, t)
    const entityStr = e.subject_type ? entityLabel(e.subject_type, t) + (e.subject_label ? ` · ${e.subject_label}` : '') : ''
    return [
      ddmmyyyy(new Date(e.created_at)),
      hhmm(new Date(e.created_at)),
      who(e),
      t(`audit.logName.${e.log_name}`, { defaultValue: e.log_name }),
      entityStr,
      e.description ?? '', beforeCell, afterCell]
  })
  const csv = '﻿' + [header, ...rows].map(r => r.map(escapeCsvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}
