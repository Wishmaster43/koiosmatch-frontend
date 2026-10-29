/**
 * TextButton: a button that renders as inline, wrapping text. Right atom for text that
 * acts (notification titles, inline "show more", breadcrumb-like links); use Button for an
 * action in a row (fixed height, nowrap). Focus ring comes from the global :focus-visible rule.
 */
import type { ButtonHTMLAttributes, CSSProperties } from 'react'

interface Props extends Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'title' | 'aria-label' | 'disabled' | 'children'> {
  // Layout only (margin/alignment); identity stays here.
  style?: CSSProperties
}

export default function TextButton({ style, disabled, children, ...rest }: Props) {
  // Reset to plain wrapping text; caller layout extends it.
  const identity: CSSProperties = {
    background: 'none', border: 0, padding: 0, margin: 0, font: 'inherit', color: 'inherit',
    textAlign: 'left', whiteSpace: 'normal', cursor: disabled ? 'default' : 'pointer', ...style,
  }
  return <button type="button" disabled={disabled} {...rest} style={identity}>{children}</button>
}
