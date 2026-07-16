/**
 * buttonMetrics — the two shared sizing constants for every button on the
 * platform (§4/§9 consistency; KANDIDAAT-100 punt 50, Danny 2026-07-16: "alle
 * knoppen moeten dezelfde hoogte hebben"). BTN_H is the ONE height for every
 * text/action button — page-header "+ Add", drawer header actions, drawer/modal
 * footers, bulk-bar buttons, settings save buttons. ICON_BTN_SIZE is the
 * separate, legitimate size for icon-only square buttons (pencil/save/✕) — it
 * is its own spec, never mixed with BTN_H. Both are explicit height/width on a
 * <button> (browsers default form controls to box-sizing: border-box), so the
 * rendered box is pixel-exact regardless of padding/border/font differences.
 */
export const BTN_H = 34
export const ICON_BTN_SIZE = 28
