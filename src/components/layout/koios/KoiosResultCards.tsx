/**
 * KoiosResultCards — compact entity cards under an assistant bubble, one per
 * `refs[]` entry a read-tool step returned (KOIOS-AGENT-PLAN §7 Job 3, dormant
 * until the backend attaches `refs` — feature-detected by the caller). Clicking
 * a card whose type has a real page (koiosResultLinks) navigates via the
 * existing cross-entity intent (`useNavigation().openEntity`, the same
 * mechanism components/ui/EntityLink uses); a type without a page yet renders
 * the same card, just non-interactive — never a dead click.
 * CHILD refs (appointment/note/document) carry a `parent:{type,id}` instead of
 * their own page — they route through the PARENT's page, landing on the
 * measured drawer sub-tab (koiosResultLinks.tabForChildRef); a parent whose
 * drawer has no matching tab still opens the parent record, just without a
 * tab param, and a child ref with no parent at all stays non-interactive.
 */
import { useNavigation } from '@/context/NavigationContext'
import { entityIconEl } from './koiosEntityIcons'
import { pageForResultRef, tabForChildRef } from './koiosResultLinks'
import { humanizeIsoDates } from '@/lib/localDate'
import { Caption } from '@/components/ui/typography'
import type { KoiosResultRef } from './koiosTypes'

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

// Renders one card per unique referenced record (see the module doc above); a type with no page yet still renders, just non-interactive, never a dead click.
export default function KoiosResultCards({ refs }: { refs: KoiosResultRef[] }) {
  const { openEntity } = useNavigation()
  const unique = dedupeRefs(refs)
  if (unique.length === 0) return null

  return (
    <div data-testid="koios-result-cards" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {unique.map((ref) => {
        const target = resolveTarget(ref)
        const clickable = target != null
        const Tag: 'button' | 'div' = clickable ? 'button' : 'div'
        return (
          <Tag key={`${ref.type}:${ref.id}`}
            {...(clickable ? { type: 'button' as const, onClick: () => (target!.tab ? openEntity(target!.page, target!.id, target!.tab) : openEntity(target!.page, target!.id)) } : {})}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              borderRadius: 8, fontSize: 12, fontWeight: 500, color: 'var(--text)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: clickable ? 'pointer' : 'default', textAlign: 'left',
            }}>
            {entityIconEl(ref.type, { size: 13, color: 'var(--color-primary-text)' })}
            <span>
              {/* DATUM-1: rewrite any embedded ISO date in a server-composed label (e.g. "intake · 2026-09-02") to DD-MM-YYYY. */}
              {humanizeIsoDates(ref.label)}
              {/* Optional caption line under the label — backend guarantees no PII, so it renders as plain text. */}
              {ref.subtitle && <Caption style={{ display: 'block' }}>{humanizeIsoDates(ref.subtitle)}</Caption>}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}
