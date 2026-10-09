/**
 * lucideByName — resolves a lucide icon NAME from an API contract (kebab-case, e.g.
 * `building-2`, `sliders-horizontal`) to a component, so the FE hardcodes no icon
 * table for server-declared surfaces (CATALOG-GROUPS-1: section icons and group icons
 * ride in GET /settings/catalog). Unknown or empty names fall back to the given default.
 * The icon loads lazily per slug (N-003): the whole library never rides in the entry chunk.
 */
import { createElement, Suspense } from 'react'
import type { ComponentType } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { isLucideSlug, lazyFor } from './lazyLucide'

// One Suspense-wrapped component per slug, created once (exported for tests).
export const lucideWrapperCache = new Map<string, LucideIcon>()

// Builds the wrapper: a same-sized blank keeps the layout still while the icon chunk arrives.
function makeWrapper(slug: string): LucideIcon {
  const Lazy = lazyFor(slug)
  const Wrapper = (props: LucideProps) => {
    const size = props.size ?? 16
    return createElement(
      Suspense,
      { fallback: createElement('span', { 'aria-hidden': true, style: { display: 'inline-block', width: size, height: size } }) },
      createElement(Lazy, props),
    )
  }
  Wrapper.displayName = `LazyLucide(${slug})`
  return Wrapper as unknown as ComponentType<LucideProps> as LucideIcon
}

// The component for a contract icon name, or the fallback when the name is unknown. The
// dynamic map also carries lucide's ALIAS names (`bar-chart-3`), which a contract may still use.
export function lucideByName(name: string | null | undefined, fallback: LucideIcon): LucideIcon {
  const slug = (name ?? '').trim().toLowerCase()
  if (!slug || !isLucideSlug(slug)) return fallback
  let wrapper = lucideWrapperCache.get(slug)
  if (!wrapper) {
    wrapper = makeWrapper(slug)
    lucideWrapperCache.set(slug, wrapper)
  }
  return wrapper
}
