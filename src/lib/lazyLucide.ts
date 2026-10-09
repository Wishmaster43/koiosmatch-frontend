/**
 * lazyLucide — the ONE cache of code-split lucide icons, shared by LookupIcon and
 * lucideByName so the 1.9k-icon library never lands in the entry bundle (N-003).
 */
import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { LucideProps } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'

type IconComponent = ComponentType<LucideProps>

// True when the kebab slug (alias names included) exists in lucide's dynamic import map.
export const isLucideSlug = (slug: string): boolean => Object.prototype.hasOwnProperty.call(dynamicIconImports, slug)

// One lazy component per slug, created once and reused (never inside a render).
const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>()

// The cached lazy component for a known slug; the caller checks isLucideSlug first.
export function lazyFor(slug: string): LazyExoticComponent<IconComponent> {
  let Icon = lazyCache.get(slug)
  if (!Icon) {
    Icon = lazy(dynamicIconImports[slug as keyof typeof dynamicIconImports])
    lazyCache.set(slug, Icon)
  }
  return Icon
}
