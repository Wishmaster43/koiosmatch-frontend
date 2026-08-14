/**
 * resolveReportKpiOrder — turns a tenant's stored KPI-slot choice into a safe,
 * always-correct-length order, falling back to the report's default per slot
 * when a stored key no longer exists in the catalogue (renamed/removed card).
 * Pure and unit-tested in isolation (RAPPORT-KPI-INSTELBAAR §3): never throws,
 * never returns a shorter/longer list than `defaultOrder`, never renders a blank
 * slot (§0 no fake affordances). `fellBack` tells the caller (report page +
 * settings screen) to surface a visible notice — a correction is never silent.
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

  // Backfill from the default order (skipping keys already placed) until the
  // result matches the expected length exactly.
  for (const key of defaultOrder) {
    if (result.length >= defaultOrder.length) break
    if (!seen.has(key)) {
      result.push(key)
      seen.add(key)
    }
  }

  // A stored list shorter than the default (e.g. an old, smaller catalogue) also
  // counts as a correction — it changed shape from what's stored today.
  if (result.length !== stored.length || result.length !== defaultOrder.length) {
    fellBack = true
  }

  return { order: result, fellBack }
}
