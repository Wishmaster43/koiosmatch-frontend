/**
 * KoiosResultCards — search results grouped by entity type (kandidaten, vacatures,
 * klanten, kansen, matches) with per-group truncation and "Toon meer" expansion.
 * Each group shows a translated entity name + count, up to 5 cards per group.
 * Skipped entities (no permission) render a calm notice instead. Clicking a card
 * navigates via the cross-entity intent (useNavigation().openEntity).
 * CHILD refs (appointment/note/document) route through their parent's drawer.
 */
import { useState } from 'react'
import { useNavigation } from '@/context/NavigationContext'
import { entityIconEl } from './koiosEntityIcons'
import { pageForResultRef, tabForChildRef } from './koiosResultLinks'
import { humanizeIsoDates } from '@/lib/localDate'
import { Caption, GroupLabel } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import type { KoiosSearchResultsGrouped, KoiosResultRef } from './koiosTypes'

// Entity label keys and their i18n paths (koios.results.group.*)
const ENTITY_LABELS: Record<string, string> = {
  candidate: 'koios.results.group.kandidaten',
  vacancy: 'koios.results.group.vacatures',
  customer: 'koios.results.group.klanten',
  opportunity: 'koios.results.group.kansen',
  match: 'koios.results.group.matches',
}

// Resolves the click target for one ref: a direct page for a mapped type, or
// (for a child ref) the parent's page + measured sub-tab; null when neither applies.
function resolveTarget(ref: KoiosResultRef): { page: string; id: string; tab?: string } | null {
  const directPage = pageForResultRef(ref.type)
  if (directPage) return { page: directPage, id: ref.id }
  if (ref.parent) {
    const parentPage = pageForResultRef(ref.parent.type)
    if (parentPage) return { page: parentPage, id: ref.parent.id, tab: tabForChildRef(ref.type, ref.parent.type) }
  }
  return null
}

// De-dupe by "type:id" — the same record may surface from more than one step.
function dedupeRefs(refs: KoiosResultRef[]): KoiosResultRef[] {
  const seen = new Set<string>()
  return refs.filter((r) => {
    const key = `${r.type}:${r.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// One card for a referenced record.
function ResultCard({ item }: { item: KoiosResultRef }) {
  const { openEntity } = useNavigation()
  const target = resolveTarget(item)
  const clickable = target != null
  const Tag: 'button' | 'div' = clickable ? 'button' : 'div'

  return (
    <Tag key={`${item.type}:${item.id}`}
      {...(clickable ? { type: 'button' as const, onClick: () => (target!.tab ? openEntity(target!.page, target!.id, target!.tab) : openEntity(target!.page, target!.id)) } : {})}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
        borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--text)',
        background: 'var(--surface)', border: '1px solid var(--border)',
        cursor: clickable ? 'pointer' : 'default', textAlign: 'left',
      }}>
      {entityIconEl(item.type, { size: 13, color: 'var(--color-primary-text)' })}
      <span>
        {/* DATUM-1: rewrite any embedded ISO date in a server-composed label to DD-MM-YYYY. */}
        {humanizeIsoDates(item.label)}
        {/* Optional caption line under the label — backend guarantees no PII, so it renders as plain text. */}
        {item.subtitle && <Caption style={{ display: 'block' }}>{humanizeIsoDates(item.subtitle)}</Caption>}
      </span>
    </Tag>
  )
}

export default function KoiosResultCards({
  groups,
  refs,
  t,
}: {
  groups?: KoiosSearchResultsGrouped
  refs?: KoiosResultRef[]
  t?: (key: string, opts?: Record<string, unknown>) => string
}) {
  // Support both old refs prop and new groups prop for backward compatibility.
  const { groups: actualGroups } = groups || {
    groups: refs && refs.length > 0
      ? [{ entity: 'candidate', refs, aantal: refs.length, meer: false }]
      : [],
  }
  const { skipped: actualSkipped } = groups || { skipped: [] }
  const mockT = t || ((key: string) => key)
  // Track which entity groups are expanded (show all refs instead of just 5).
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  if (actualGroups.length === 0 && actualSkipped.length === 0) return null

  const toggleExpanded = (entity: string) => {
    const next = new Set(expandedGroups)
    if (next.has(entity)) {
      next.delete(entity)
    } else {
      next.add(entity)
    }
    setExpandedGroups(next)
  }

  return (
    <div data-testid="koios-result-cards" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
      {/* Render each entity group with its label and truncated refs. */}
      {actualGroups.map((group) => {
        const unique = dedupeRefs(group.refs)
        if (unique.length === 0) return null

        const isExpanded = expandedGroups.has(group.entity)
        const ITEMS_PER_GROUP = 5
        const displayed = isExpanded ? unique : unique.slice(0, ITEMS_PER_GROUP)
        const hasMore = unique.length > ITEMS_PER_GROUP

        const labelKey = ENTITY_LABELS[group.entity] || `koios.results.group.${group.entity}`
        const entityLabel = mockT(labelKey, { defaultValue: group.entity })

        return (
          <div key={group.entity}>
            {/* Group label with entity name and count. */}
            <GroupLabel style={{ marginBottom: 6 }}>
              {entityLabel} ({unique.length})
            </GroupLabel>
            {/* Cards for this group. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: hasMore ? 6 : 0 }}>
              {displayed.map((item) => (
                <ResultCard key={`${item.type}:${item.id}`} item={item} />
              ))}
            </div>
            {/* "Toon meer" / "Toon minder" button when group is truncated or expanded. */}
            {hasMore && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleExpanded(group.entity)}
                style={{ fontSize: 12 }}
              >
                {isExpanded ? mockT('koios.results.showLess', { defaultValue: 'Toon minder' }) : mockT('koios.results.showMore', { defaultValue: 'Toon meer' })}
              </Button>
            )}
          </div>
        )
      })}

      {/* Render skipped entities (no permission). */}
      {actualSkipped.length > 0 && (
        <div style={{ marginTop: actualGroups.length > 0 ? 4 : 0 }}>
          {actualSkipped.map((skip) => (
            <Caption key={skip.entity} style={{ display: 'block', marginTop: 4 }}>
              {mockT('koios.results.skipped', { defaultValue: 'Overgeslagen: {{reason}}', reason: skip.reden })}
            </Caption>
          ))}
        </div>
      )}
    </div>
  )
}
