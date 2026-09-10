/**
 * DrawerBackdrop — shared semi-transparent overlay behind drawer panels.
 * Stacked below the drawer panel; both live on the same z-rung for layering.
 */

interface DrawerBackdropProps {
  onClick: () => void
  zIndex?: number | string
}

// Semi-transparent backdrop that closes the drawer on click. The rgba literal stays
// (DRY round 10, DRAWERSHELLS): index.css defines no backdrop/overlay/scrim COLOUR
// token (only the z-index rungs `--z-drawer`/`--z-overlay`), so there is no token to
// adopt here — see `questions` in the round-10 report.
export default function DrawerBackdrop({ onClick, zIndex = 'var(--z-drawer)' }: DrawerBackdropProps) {
  return (
    <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex }} onClick={onClick} />
  )
}
