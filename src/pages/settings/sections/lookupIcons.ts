/**
 * lookupIcons — curated generic lucide set for StatusListEditor's icon picker
 * (withIcon=true default set). Mirrors the pattern of useDocumentTypes'
 * DOC_TYPE_ICON_MAP/resolveDocTypeIcon: a stable name→component map plus a
 * resolve() that never crashes on an unknown/empty slug (falls back to Tag).
 */
import type { LucideIcon } from 'lucide-react'
import {
  Calendar, Clock, Phone, Smartphone, Mail, MessageCircle, MessageSquare, Video,
  MapPin, Building, Users, User, Briefcase, ClipboardList, CheckCircle,
  AlertTriangle, Star, Flag, Tag, Bell, Coffee, Car, Home, Globe,
} from 'lucide-react'

// Curated generic set for lookups without their own bespoke icon vocabulary
// (appointment types, task priorities, statuses, …). ~24 names, broad coverage.
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
}

// Stable, curated order for the Settings icon-picker grid.
export const GENERIC_LOOKUP_ICON_NAMES = Object.keys(GENERIC_LOOKUP_ICON_MAP)

// Resolve a stored icon slug to its lucide component — unknown/empty/null falls
// back to the generic Tag glyph instead of crashing (mirror resolveDocTypeIcon).
export function resolveGenericLookupIcon(name?: string | null): LucideIcon {
  const key = (name ?? '').trim().toLowerCase()
  return GENERIC_LOOKUP_ICON_MAP[key] ?? Tag
}
