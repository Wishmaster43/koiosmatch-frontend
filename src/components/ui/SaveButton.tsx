/**
 * SaveButton — the ONE saved-state save action. §4's "aan/gelukt" token pair is
 * fill `--color-success-bg` + full `--color-success` BORDER; the ink is ALWAYS
 * `--color-on-success-bg` (16:1 light, ≈12:1 dark). Never the success colour
 * itself as text: that reads 3.0:1 on its own bg — a WCAG AA fail the Opus
 * slotaudit review caught on 9 hand-copied sites (20-08). Everything else is Button.
 */
import { forwardRef } from 'react'
import type { CSSProperties, ComponentProps } from 'react'
import Button from './Button'

type SaveButtonProps = ComponentProps<typeof Button> & { saved?: boolean }

// The saved identity, defined once — screens must never re-approximate the pair.
const SAVED_STYLE: CSSProperties = {
  background: 'var(--color-success-bg)',
  color: 'var(--color-on-success-bg)',
  border: '1px solid var(--color-success)',
}

// SAVED is FEEDBACK, not inertness. The normal post-save state is saved AND
// disabled (the form is clean again), and Button's disabled recipe wins over
// caller style by design — so passing `disabled` through would grey out the
// success pair for its whole confirmation window (Opus round-2 blocker, 20-08).
// While saved we keep the paint and enforce the inertness manually instead:
// no click, aria-disabled for AT, default cursor.
const SaveButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, SaveButtonProps>(
  function SaveButton({ saved = false, variant = 'primary', style, disabled, ...rest }, ref) {
    if (saved) {
      return (
        <Button ref={ref} variant={variant} {...rest}
          {...(disabled ? { onClick: undefined, 'aria-disabled': true } : {})}
          style={{ ...style, ...SAVED_STYLE, ...(disabled ? { cursor: 'default' } : {}) }} />
      )
    }
    return <Button ref={ref} variant={variant} disabled={disabled} {...rest} style={style} />
  },
)

export default SaveButton
