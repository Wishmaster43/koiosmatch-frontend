/**
 * hasDescriptionText — shared "is there real Kanstekst content?" check for the
 * OPP-DESCRIPTION-1 rich-text field (§11: one helper, not a copy per call site).
 * A TipTap editor left empty still emits stray markup (e.g. '<p></p>') instead
 * of a bare '' — both AddOpportunityModal (decide POST/PATCH key omission) and
 * the drawer's OpportunityDescriptionBlock (decide the PATCH clear value, via
 * DetailsTab's onSave) need the exact same "strip tags, is anything left?"
 * check, or the drawer clear path silently persists literal '<p></p>' instead
 * of null (measured live, 08-08: a plain `html || null` treats that string as
 * truthy since it is non-empty).
 */
export const hasDescriptionText = (html: string): boolean => html.replace(/<[^>]*>/g, '').trim().length > 0
