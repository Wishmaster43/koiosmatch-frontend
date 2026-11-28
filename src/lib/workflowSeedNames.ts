/**
 * workflowSeedNames (WORKFLOW-SEED-NAMES-TEMPLATE-KEY-FE-1; BE TEMPLATE-NAMES-ENTITY-ENGLISH-1, batch R2) - the template-key
 * branch of the workflowNames seed translation. Since R2 a bureau created in another language stores the seeded template
 * name in THAT language (en/it/pt), so the Dutch-label match of seedKeyFor alone no longer recognises it. A workflow row
 * carries `template_key` (null for a bureau-built workflow); this module turns that key, or the stored name in any seed
 * language, into the English i18n key of lookupSeeds.workflowNames. The rename guard stays: a name that matches none of
 * the seeded names of its template was typed by a human and renders as typed.
 *
 * Pure module on purpose (no react, no i18n import): lookupSeedI18n hands in its own normalise, which keeps this file free
 * of a cycle and of a second copy of that comparison.
 */
import { TEMPLATE_SEED_NAMES, type TemplateSeedName } from './workflowTemplateNames.generated'
import { SEED_LABEL_KEYS } from './lookupSeedCatalogueKeys'

// The row shape the seed translation receives: the template key as `value`, the stored name as `label`.
interface WorkflowSeedRow { value?: string | null; label?: string | null }
type Normalise = (s: string) => string

// Every seeded name of one template (it/pt repeat the English text where the BE has no row of their own).
const seedNamesOf = (entry: TemplateSeedName): string[] => [entry.nl, entry.en, entry.it, entry.pt]

// The no-key fallback's index, normalised name -> Dutch seed name, built once per normalise function (the render sites
// hand in the same one) instead of 580 normalise calls per bureau-built row per render. Names are unique across
// templates in every language (measured on the 145-key mirror), so the first writer of a name is its only owner.
let nameIndex: { normalise: Normalise; byName: Map<string, string> } | null = null
function indexFor(normalise: Normalise): Map<string, string> {
  if (nameIndex?.normalise === normalise) return nameIndex.byName
  const byName = new Map<string, string>()
  for (const entry of Object.values(TEMPLATE_SEED_NAMES)) {
    for (const name of seedNamesOf(entry)) if (!byName.has(normalise(name))) byName.set(normalise(name), entry.nl)
  }
  nameIndex = { normalise, byName }
  return byName
}

/**
 * The lookupSeeds.workflowNames key for a workflow row, or null when the row is not a seeded default (bureau-built, or
 * renamed by the tenant). With a known template key the stored name must still be one of that template's seeded names;
 * without one (older payloads, run and queue rows before their template_key landed) the name itself is matched against
 * every seeded name of every template.
 */
export function workflowSeedKey(item: WorkflowSeedRow, normalise: Normalise): string | null {
  const label = item?.label ?? ''
  if (!label) return null
  const keysByDutchName = SEED_LABEL_KEYS.workflowNames ?? {}
  const wanted = normalise(label)
  const templateKey = typeof item?.value === 'string' ? item.value : ''
  // hasOwn: a key such as 'constructor' must read as unknown, never as an Object prototype member.
  const own = templateKey && Object.hasOwn(TEMPLATE_SEED_NAMES, templateKey) ? TEMPLATE_SEED_NAMES[templateKey] : undefined
  if (own) {
    return seedNamesOf(own).some(n => normalise(n) === wanted) ? (keysByDutchName[own.nl] ?? null) : null
  }
  const dutchName = indexFor(normalise).get(wanted)
  return dutchName ? (keysByDutchName[dutchName] ?? null) : null
}
