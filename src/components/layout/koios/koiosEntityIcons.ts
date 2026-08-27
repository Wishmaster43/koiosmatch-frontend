/**
 * koiosEntityIcons — one icon per entity type, shared by the "@" mention search
 * rows (Job 1) and the result-card deep links (Job 3) so a candidate/vacancy/…
 * always reads the same glyph everywhere in Koios. Mirrors the icons Sidebar.jsx
 * already uses for the matching nav item — no second icon vocabulary.
 */
import { createElement } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import {
  Users, FileText, Briefcase, Handshake, Target, ListChecks, PhoneCall,
  Building2, MessageCircle, Brain, User, Calendar, StickyNote,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Keyed by the context-ref `type` token (koiosMentionCategories.ts `refType`).
export const ENTITY_ICONS: Record<string, LucideIcon> = {
  candidate: Users,
  application: FileText,
  vacancy: Briefcase,
  match: Handshake,
  opportunity: Target,
  task: ListChecks,
  outreach_campaign: PhoneCall,
  calllist: PhoneCall,
  customer: Building2,
  location: Building2,
  department: Building2,
  contact: User,
  workflow: Brain,
  conversation: MessageCircle,
  // KOIOS-RESULT-CARDS-6-FE-1: child-ref types (routed through their parent's tab).
  appointment: Calendar,
  note: StickyNote,
  document: FileText,
}

// Resolves the shared icon for an entity type, falling back to a generic person
// icon for any type not in the map above.
export function entityIconFor(type: string): LucideIcon {
  return ENTITY_ICONS[type] ?? User
}

/**
 * Render an entity icon as an element via createElement (not JSX) — callers must
 * never assign the resolved component to a capitalised variable during render
 * (react-hooks/static-components), mirrors lib/roleIcons.ts's roleIconEl.
 */
export function entityIconEl(type: string, props: { size?: number; color?: string; style?: CSSProperties } = {}): ReactElement {
  return createElement(entityIconFor(type), props)
}
