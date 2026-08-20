/**
 * buttonMetrics — the two shared sizing constants for every button on the
 * platform (§4/§9 consistency; KANDIDAAT-100 punt 50, Danny 2026-07-16: "alle
 * knoppen moeten dezelfde hoogte hebben"). BTN_H feeds `components/ui/Button`'s
 * size="md" ONLY — the page-toolbar "+ Add" exception beside 34px search chrome
 * (Danny 19-08: "drill downs moeten allemaal zelfde zijn — zelfde geldt voor de
 * instellingen"). Settings save buttons, drawer/modal footers and bulk-bar
 * buttons use Button's DEFAULT size="sm" (28px) — this constant does not feed
 * them (HUISSTIJL slotaudit V1, 2026-08-20: this comment used to claim it did,
 * which is exactly what sent every settings save button to a hand-painted 34px
 * copy). Explicit height on a <button> (browsers default form controls to
 * box-sizing: border-box), so the rendered box is pixel-exact regardless of
 * padding/border/font differences.
 * (An ICON_BTN_SIZE spec for icon-only squares was exported here but never
 * adopted — removed per §11 no-dead-code, audit 22-07; re-add WITH adoption.)
 */
export const BTN_H = 34
// The sm-standard height (DE MAAT: 28 · 12px · r6) for the few RAW state-carrying
// faces that Button cannot express but that sit in a Button-sm row (ActionMenu's
// labeled trigger, a bulk bar's scope toggle). Mirrors components/ui/Button's
// SIZES.sm so those rows stay uniform — never hardcode 28 at a call site.
export const BTN_H_SM = 28
