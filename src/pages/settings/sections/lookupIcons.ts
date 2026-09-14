/**
 * lookupIcons — curated generic lucide set for StatusListEditor's icon picker
 * (withIcon=true default set). Mirrors the pattern of useDocumentTypes'
 * DOC_TYPE_ICON_MAP/resolveDocTypeIcon: a stable name→component map plus a
 * resolve() that never crashes on an unknown/empty slug (falls back to Tag).
 */
import type { LucideIcon } from 'lucide-react'
import { lucideByName } from '@/lib/lucideByName'
import {
  Calendar, Clock, Phone, Smartphone, Mail, MessageCircle, MessageSquare, Video,
  MapPin, Building, Users, User, Briefcase, ClipboardList, CheckCircle,
  AlertTriangle, Star, Flag, Tag, Bell, Coffee, Car, Home, Globe, GraduationCap,
  ShieldAlert, Award, Layers,
} from 'lucide-react'

// Curated generic set for lookups without their own bespoke icon vocabulary
// (appointment types, task priorities, statuses, education levels, blacklist
// reasons, functions, nationalities, driver licences, pools, skill levels, …).
// Batch-12 additions: graduation-cap (education), shield-alert (blacklist),
// award (skill levels), layers (functions/pools) — extends the set, never a
// second hand-maintained icon map.
export const GENERIC_LOOKUP_ICON_MAP: Record<string, LucideIcon> = {
  calendar: Calendar,
  clock: Clock,
  phone: Phone,
  smartphone: Smartphone,
  mail: Mail,
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  video: Video,
  'map-pin': MapPin,
  building: Building,
  users: Users,
  user: User,
  briefcase: Briefcase,
  'clipboard-list': ClipboardList,
  'check-circle': CheckCircle,
  'alert-triangle': AlertTriangle,
  star: Star,
  flag: Flag,
  tag: Tag,
  bell: Bell,
  coffee: Coffee,
  car: Car,
  home: Home,
  globe: Globe,
  'graduation-cap': GraduationCap,
  'shield-alert': ShieldAlert,
  award: Award,
  layers: Layers,
}

// The backend seeds every lookup value with its own icon (LOOKUP-ICONEN-1, c2d53c46: 375
// values, kebab lucide names validated by LookupIconRules). Those names join the picker so a
// tenant can pick what the seeds use; they resolve through lucideByName, never a second map.
export const SEEDED_LOOKUP_ICON_NAMES: readonly string[] = [
  'circle-dashed', 'pause-circle', 'help-circle', 'unlock', 'lock', 'inbox', 'send',
  'calendar-check', 'calendar-days', 'signal-low', 'signal-medium', 'signal-high',
  'thumbs-down', 'angry', 'handshake', 'user-check', 'user-x', 'user-search',
  'building-2', 'school', 'book-open', 'wrench', 'truck', 'car', 'bike', 'motorbike', 'scooter',
  'mars', 'venus', 'venus-and-mars', 'phone-outgoing', 'phone-incoming', 'phone-off', 'phone-call',
  'file-text', 'file-edit', 'file-x', 'file-check', 'file-signature', 'sticky-note', 'puzzle',
  'shuffle', 'languages', 'map',
]

// Stable order for the Settings icon-picker grid: the curated set first, then the seeded names.
export const GENERIC_LOOKUP_ICON_NAMES = [
  ...Object.keys(GENERIC_LOOKUP_ICON_MAP),
  ...SEEDED_LOOKUP_ICON_NAMES.filter(name => !(name in GENERIC_LOOKUP_ICON_MAP)),
]

// Resolve a stored icon slug to its lucide component: the curated map first, then ANY lucide
// name the backend may serve (its rules accept every kebab lucide name, so a value's own icon
// must never collapse to the fallback); unknown/empty/null falls back to the Tag glyph.
export function resolveGenericLookupIcon(name?: string | null): LucideIcon {
  const key = (name ?? '').trim().toLowerCase()
  return GENERIC_LOOKUP_ICON_MAP[key] ?? lucideByName(key, Tag)
}
