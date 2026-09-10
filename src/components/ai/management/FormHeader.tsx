/**
 * FormHeader — shared icon + title header for form panels (AgentForm, InterviewFlowsPanel).
 * Renders a violet-tinted icon, title, optional title-row subtitle, and right-side action buttons.
 * Keeps layout and styling consistent across panels.
 */
import { ReactNode } from 'react'
import { SectionTitle } from '@/components/ui/typography'
import { LucideIcon } from 'lucide-react'

export interface FormHeaderProps {
  icon: LucideIcon
  title: ReactNode
  titleSubtitle?: ReactNode
  // AgentForm always wrapped its title in a div on main, even without a subtitle;
  // InterviewFlowsPanel never did. The two consumers differ structurally here (not
  // only by whether a subtitle exists), so it rides as its own explicit prop.
  wrapTitle?: boolean
  rightActions?: ReactNode
}

// Shared header layout: icon + (title + optional subtitle) and right-side action buttons.
export function FormHeader({
  icon: Icon,
  title,
  titleSubtitle,
  wrapTitle,
  rightActions,
}: FormHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'var(--color-violet-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={15} color="var(--color-violet)" />
        </div>
        {/* wrapTitle reproduces AgentForm's always-wrapped title div (its Avatar row);
            without it and without a subtitle the title renders bare, matching
            InterviewFlowsPanel's original DOM. */}
        {wrapTitle || titleSubtitle ? (
          <div>
            <SectionTitle as="div">{title}</SectionTitle>
            {titleSubtitle}
          </div>
        ) : (
          <SectionTitle as="div">{title}</SectionTitle>
        )}
      </div>
      {rightActions && <div style={{ display: 'flex', gap: 6 }}>{rightActions}</div>}
    </div>
  )
}
