/**
 * buttonMetrics — the two shared sizing constants for every button on the
 * platform (§4/§9 consistency; KANDIDAAT-100 punt 50, Danny 2026-07-16: "alle
 * knoppen moeten dezelfde hoogte hebben"). BTN_H is the ONE height for every
 * text/action button — page-header "+ Add", drawer header actions, drawer/modal
 * footers, bulk-bar buttons, settings save buttons. Explicit height on a
 * <button> (browsers default form controls to box-sizing: border-box), so the
 * rendered box is pixel-exact regardless of padding/border/font differences.
 * (An ICON_BTN_SIZE spec for icon-only squares was exported here but never
 * adopted — removed per §11 no-dead-code, audit 22-07; re-add WITH adoption.)
 */
export const BTN_H = 34
