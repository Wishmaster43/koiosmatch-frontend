/**
 * scheduleModalStyles — the inline-style tokens shared by the trigger/schedule
 * modal and its section components (ScheduleFields, WebhookAgentSelect).
 *
 * These live here because the same objects are now used from three modules; the
 * label style in particular was copy-pasted eight times inside the old single
 * file. One definition = one look, and a token change lands everywhere at once.
 * Values are unchanged from ScheduleModal (TRIGGER-POPUP-2, Danny 23-07 "groter
 * en overzichtelijker": each config group sits in its own bordered section card
 * with a small uppercase header).
 */
import type { CSSProperties } from 'react'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { groupLabelStyle } from '@/components/ui/typography'

// Text/number/time inputs and their select counterpart (G33 canon). `width: 'auto'`
// overrides the canon's 100% — these render inline in a flex row (several per line,
// e.g. hh:mm + hh:mm) and each call site opts into a specific width itself.
export const inputStyle: CSSProperties = { ...fieldInputStyle, width: 'auto' }
export const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' }

// A config group's bordered card + its small uppercase header.
export const sectionStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--surface)' }
export const sectionLabel: CSSProperties = { ...groupLabelStyle, display: 'block', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 }

// Field label inside a section card; the inline variant sits in a flex row and
// therefore carries no `display`/margin of its own.
export const fieldLabelInline: CSSProperties = { ...groupLabelStyle, letterSpacing: '0.05em' }
export const fieldLabel: CSSProperties = { ...fieldLabelInline, display: 'block', marginBottom: 6 }
