/**
 * resolveReportKpiOrder — turns a tenant's stored KPI-slot choice into a safe
 * order, falling back to the report's default per slot when a stored key no
 * longer exists in the catalogue (renamed/removed card). Pure and unit-tested
 * in isolation (RAPPORT-KPI-INSTELBAAR §3): never throws, never renders a blank
 * slot (§0 no fake affordances). `fellBack` is true only on an unknown or
 * duplicate key, so the caller (report page + settings screen) surfaces a
 * visible notice for a real correction, never for a mere length difference.
 */
export interface ResolveReportKpiOrderResult {
  order: string[]
  fellBack: boolean
}

export function resolveReportKpiOrder(
  stored: string[] | undefined | null,
  catalogKeys: string[],
  defaultOrder: string[],
): ResolveReportKpiOrderResult {
  // Nothing stored yet — today's default, no correction to report.
  if (!stored || stored.length === 0) {
    return { order: [...defaultOrder], fellBack: false }
  }

  const catalogSet = new Set(catalogKeys)
  const result: string[] = []
  const seen = new Set<string>()
  let fellBack = false

  // Walk the stored order, dropping unknown/duplicate keys — each dropped slot
  // is patched from the default order below, never left blank.
  for (const key of stored) {
    if (catalogSet.has(key) && !seen.has(key)) {
      result.push(key)
      seen.add(key)
    } else {
      fellBack = true
    }
  }

  // Backfill from the default order (skipping keys already placed) so a dropped
  // or missing slot is patched, never blank; the target is the larger of stored
  // and default length. Backfilling alone never counts as a fallback.
  const target = Math.max(stored.length, defaultOrder.length)
  for (const key of defaultOrder) {
    if (result.length >= target) break
    if (!seen.has(key)) {
      result.push(key)
      seen.add(key)
    }
  }

  return { order: result, fellBack }
}
