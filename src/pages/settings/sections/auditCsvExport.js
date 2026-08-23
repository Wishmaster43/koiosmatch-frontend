/**
 * exportAuditCsv — owns the audit log's CSV export: the column set, the AVG-safe cell
 * escaping and the browser download side effect. Pulled out of AuditLog.jsx so the
 * component stays declarative (§3: logic lives outside the JSX) and the export's
 * column order can change without touching the screen.
 */
import { escapeCsvCell } from '@/lib/csv'
import { entityLabel } from './auditShared'
import { buildDiffCells } from './auditDiffCells'

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
      new Date(e.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      new Date(e.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
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
