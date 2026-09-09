// Settings slugs whose screen moved OUT of settings (row 32, Danny 09-09: Mijn
// meldingen is a personal preference and lives on the profile). The old deep link
// keeps resolving: SettingsPage sends it to the profile page with the tab intent.
// Own module so the page file exports components only (react-refresh) and the
// deep-link regression test imports the map without mounting the page.
export const MOVED_TO_PROFILE = {
  'notifications/notif_my': { tab: 'notifications' },
}
