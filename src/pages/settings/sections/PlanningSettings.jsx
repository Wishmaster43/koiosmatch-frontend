/** Planning sections — currently placeholders (shift types, availability,
 * auto-match rules, planning board). One component per nav tab; all driven by i18n. */
import { useTranslation } from 'react-i18next'
import PlaceholderSettings from './PlaceholderSettings'

// Shift-types nav tab — not yet built; renders the shared placeholder screen.
export function ShiftTypesSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('planning.shiftTypes.title')} description={t('planning.shiftTypes.desc')} />
}
// Availability nav tab — not yet built; renders the shared placeholder screen.
export function AvailabilitySettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('planning.availability.title')} description={t('planning.availability.desc')} />
}
// Auto-match rules nav tab — not yet built; renders the shared placeholder screen.
export function AutoMatchSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('planning.automatch.title')} description={t('planning.automatch.desc')} />
}
// Planning-board nav tab — not yet built; renders the shared placeholder screen.
export function PlanningBoardSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('planning.board.title')} description={t('planning.board.desc')} />
}
