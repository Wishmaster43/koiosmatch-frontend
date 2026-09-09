/**
 * LookupIcon — renders a tenant lookup's `icon` field. Settings stores either a
 * lucide slug ('mail', 'phone', 'graduation-cap', …) or an emoji ('📋'); the slug
 * used to leak as literal text ("mail Email" — Danny 14/7). Since the seeders write
 * a fitting lucide slug for EVERY lookup value (LOOKUP-ICONEN, Danny 09-09: "loop
 * alle icons na"), the resolver is dynamic: any lucide slug loads its icon on demand
 * (code-split per icon, nothing of the 1500-icon set in the main bundle), the house
 * set stays static, and emoji/free text still pass through.
 */
import { lazy, Suspense } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { LucideProps } from 'lucide-react'
import {
  Mail, MessageCircle, Building, Building2, Phone, PhoneCall, Video, Calendar,
  User, Users, Star, FileText, Briefcase, MapPin, Clock, CheckCircle, Bell, Globe,
} from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'

type IconComponent = ComponentType<LucideProps>

// The house set stays statically imported (renders synchronously, no Suspense flash on
// the hot paths: status chips, table cells); aliases map old stored values onto lucide.
const STATIC_ICONS: Record<string, IconComponent> = {
  mail: Mail, email: Mail, 'message-circle': MessageCircle, whatsapp: MessageCircle,
  building: Building, 'building-2': Building2, phone: Phone, call: PhoneCall,
  'phone-call': PhoneCall, video: Video, meet: Video, calendar: Calendar,
  user: User, users: Users, star: Star, 'file-text': FileText, note: FileText,
  briefcase: Briefcase, 'map-pin': MapPin, clock: Clock, 'check-circle': CheckCircle,
  bell: Bell, globe: Globe,
}

// One lazy component per slug, created once and reused (never inside a render).
const lazyCache = new Map<string, LazyExoticComponent<IconComponent>>()
function lazyFor(slug: string): LazyExoticComponent<IconComponent> {
  let Icon = lazyCache.get(slug)
  if (!Icon) {
    Icon = lazy(dynamicIconImports[slug as keyof typeof dynamicIconImports])
    lazyCache.set(slug, Icon)
  }
  return Icon
}

/**
 * The lucide component for a slug, or null when the value is emoji/free text. The house
 * set returns a static component; any other lucide slug returns a lazy one, so a caller
 * that renders it must sit under a Suspense boundary (LookupIcon below brings its own).
 */
export function lucideFor(icon?: string | null): IconComponent | null {
  if (!icon) return null
  const slug = icon.trim().toLowerCase()
  if (STATIC_ICONS[slug]) return STATIC_ICONS[slug]
  return slug in dynamicIconImports ? lazyFor(slug) : null
}

// Renders the actual icon for a lookup: any lucide slug, or the raw value (emoji/free text) as-is.
export default function LookupIcon({ icon, size = 13, color }: { icon?: string | null; size?: number; color?: string }) {
  if (!icon) return null
  const slug = icon.trim().toLowerCase()
  const Static = STATIC_ICONS[slug]
  if (Static) return <Static size={size} color={color} aria-hidden />
  if (slug in dynamicIconImports) {
    const Lazy = lazyFor(slug)
    // A same-sized blank keeps the row from jumping while the icon chunk arrives.
    return (
      <Suspense fallback={<span aria-hidden style={{ display: 'inline-block', width: size, height: size }} />}>
        <Lazy size={size} color={color} aria-hidden />
      </Suspense>
    )
  }
  // Emoji / free text (e.g. appointment types use 📋) — render as-is, sized to match.
  return <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>
}
