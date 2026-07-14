/**
 * KoiosResultCards — compact entity cards under an assistant bubble, one per
 * `refs[]` entry a read-tool step returned (KOIOS-AGENT-PLAN §7 Job 3, dormant
 * until the backend attaches `refs` — feature-detected by the caller). Clicking
 * a card whose type has a real page (koiosResultLinks) navigates via the
 * existing cross-entity intent (`useNavigation().openEntity`, the same
 * mechanism components/ui/EntityLink uses); a type without a page yet renders
 * the same card, just non-interactive — never a dead click.
 */
import { useNavigation } from '@/context/NavigationContext'
import { entityIconEl } from './koiosEntityIcons'
import { pageForResultRef } from './koiosResultLinks'
import type { KoiosResultRef } from './koiosTypes'

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

export default function KoiosResultCards({ refs }: { refs: KoiosResultRef[] }) {
  const { openEntity } = useNavigation()
  const unique = dedupeRefs(refs)
  if (unique.length === 0) return null

  return (
    <div data-testid="koios-result-cards" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {unique.map((ref) => {
        const page = pageForResultRef(ref.type)
        const clickable = page != null
        const Tag: 'button' | 'div' = clickable ? 'button' : 'div'
        return (
          <Tag key={`${ref.type}:${ref.id}`}
            {...(clickable ? { type: 'button' as const, onClick: () => openEntity(page!, ref.id) } : {})}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--text)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: clickable ? 'pointer' : 'default', textAlign: 'left',
            }}>
            {entityIconEl(ref.type, { size: 13, color: 'var(--color-primary)' })}
            {ref.label}
          </Tag>
        )
      })}
    </div>
  )
}
