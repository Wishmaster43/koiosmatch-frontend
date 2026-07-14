/**
 * LookupIcon — renders a tenant lookup's `icon` field. Settings stores either a
 * lucide slug ('mail', 'phone', …) or an emoji ('📋'); the slug used to leak as
 * literal text ("mail Email" — Danny 14/7) and consumers ignored the field via
 * hardcoded icon maps. One curated slug→lucide map, emoji/text passthrough.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Mail, MessageCircle, Building, Building2, Phone, PhoneCall, Video, Calendar,
  User, Users, Star, FileText, Briefcase, MapPin, Clock, CheckCircle, Bell, Globe,
} from 'lucide-react'

const SLUG_ICONS: Record<string, LucideIcon> = {
  mail: Mail, email: Mail, 'message-circle': MessageCircle, whatsapp: MessageCircle,
  building: Building, 'building-2': Building2, phone: Phone, call: PhoneCall,
  'phone-call': PhoneCall, video: Video, meet: Video, calendar: Calendar,
  user: User, users: Users, star: Star, 'file-text': FileText, note: FileText,
  briefcase: Briefcase, 'map-pin': MapPin, clock: Clock, 'check-circle': CheckCircle,
  bell: Bell, globe: Globe,
}

/** The lucide component for a slug, or null when the value is emoji/free text. */
export function lucideFor(icon?: string | null): LucideIcon | null {
  return icon ? (SLUG_ICONS[icon.trim().toLowerCase()] ?? null) : null
}

export default function LookupIcon({ icon, size = 13, color }: { icon?: string | null; size?: number; color?: string }) {
  if (!icon) return null
  const Icon = lucideFor(icon)
  if (Icon) return <Icon size={size} color={color} aria-hidden />
  // Emoji / free text (e.g. appointment types use 📋) — render as-is, sized to match.
  return <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>
}
