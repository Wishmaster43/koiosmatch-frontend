/**
 * importRowAttention — which rows of an import report a user must actually look at.
 *
 * An `error` row is obvious. The subtle one is a row the backend WROTE (create/update)
 * that still carries messages: the importer reports there exactly what it could not
 * take as supplied — an unknown `klant_branche` left empty, a consent cell that was
 * not a ja/nee value and was ignored (EntityImporter::boolean), or, in a dry run, that
 * an earlier line already holds this record. Those rows landed only PARTLY as written
 * in the file, so hiding them behind "show all rows" is exactly the green-tick-over-a-
 * half-imported-row this screen exists to prevent.
 *
 * A `skip` row's message ("No changes — this row already matches the file") describes
 * a row where nothing happened at all, so it is not attention-worthy.
 */
import type { ImportRowResult } from './importApi'

/** Did this row write something? Only create/update reach persist() (RowPlan::writes). */
export function isWrittenRow(row: ImportRowResult): boolean {
  return row.action === 'create' || row.action === 'update'
}

/** A written row whose data did not fully land as supplied. */
export function hasRemarks(row: ImportRowResult): boolean {
  return isWrittenRow(row) && row.messages.length > 0
}

/** Failed, or landed only partly — the default view of the per-row report. */
export function needsAttention(row: ImportRowResult): boolean {
  return row.action === 'error' || hasRemarks(row)
}

/** How many rows landed with something dropped — drives the honest result subtitle. */
export function countRemarkRows(rows: readonly ImportRowResult[]): number {
  return rows.filter(hasRemarks).length
}
