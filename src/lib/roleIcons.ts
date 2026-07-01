/**
 * roleIcons — the fixed icon set a tenant may pick for a role.
 *
 * The backend exposes the allowed names via GET /roles/icons (config/roles.php);
 * this map resolves a name → a lucide component. Unknown/absent names fall back to
 * Shield so the UI never renders a blank icon. Keep the keys lower-case + stable.
 */
import { createElement } from 'react'
import type { ComponentType, CSSProperties, ReactElement } from 'react'
import {
  Shield, ShieldCheck, User, Users, UserCog, UserCheck, Briefcase, Star, Crown, Key,
  Settings, Headphones, Phone, Calendar, CalendarDays, BarChart2, Building2, ClipboardList,
  Target, Megaphone, Wrench, Eye, Lock, Award, Zap, Flag, Handshake, HeartHandshake,
  GraduationCap, Stethoscope, Truck, Package, Sparkles, BookOpen, Globe,
} from 'lucide-react'

export type RoleIcon = ComponentType<{ size?: number; color?: string; style?: CSSProperties }>

// name → lucide component. Names mirror config/roles.php (GET /roles/icons).
const ICONS: Record<string, RoleIcon> = {
  shield: Shield, 'shield-check': ShieldCheck, shieldcheck: ShieldCheck,
  user: User, users: Users, 'user-cog': UserCog, usercog: UserCog,
  'user-check': UserCheck, usercheck: UserCheck,
  briefcase: Briefcase, star: Star, crown: Crown, key: Key, settings: Settings,
  headphones: Headphones, phone: Phone, calendar: Calendar, 'calendar-days': CalendarDays,
  chart: BarChart2, 'bar-chart': BarChart2, barchart: BarChart2,
  building: Building2, 'building-2': Building2, clipboard: ClipboardList, target: Target,
  megaphone: Megaphone, wrench: Wrench, eye: Eye, lock: Lock, award: Award, zap: Zap,
  flag: Flag, handshake: Handshake, 'heart-handshake': HeartHandshake,
  'graduation-cap': GraduationCap, graduationcap: GraduationCap,
  stethoscope: Stethoscope, truck: Truck, package: Package, sparkles: Sparkles,
  book: BookOpen, 'book-open': BookOpen, globe: Globe,
}

// The pickable set, in a stable order (used by the icon picker as a fallback when
// GET /roles/icons is unavailable). The backend list, when present, wins.
export const ROLE_ICON_NAMES: string[] = [
  'shield', 'shield-check', 'user', 'users', 'user-cog', 'user-check', 'briefcase',
  'star', 'crown', 'key', 'settings', 'headphones', 'phone', 'calendar', 'chart',
  'building', 'clipboard', 'target', 'megaphone', 'wrench', 'eye', 'lock', 'award',
  'zap', 'flag', 'handshake', 'heart-handshake', 'graduation-cap', 'stethoscope',
  'truck', 'package', 'sparkles', 'book', 'globe',
]

/** Resolve a role icon name to a lucide component; unknown → Shield. */
export function resolveRoleIcon(name?: string | null): RoleIcon {
  if (!name) return Shield
  return ICONS[name.toLowerCase()] ?? Shield
}

/**
 * Render a role icon as an element. Uses createElement (not JSX) so callers don't
 * assign a resolved component to a capitalised variable during render (which the
 * react-hooks/static-components lint rule forbids).
 */
export function roleIconEl(name?: string | null, props: { size?: number; color?: string; style?: CSSProperties } = {}): ReactElement {
  return createElement(resolveRoleIcon(name), props)
}
