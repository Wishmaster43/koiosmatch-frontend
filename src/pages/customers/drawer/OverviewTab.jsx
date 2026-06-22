/**
 * OverviewTab — the customer's company fields, grouped into titled cards
 * (General / Online / Settings / Texts) with in-place edit via the shared
 * EditableFieldTable. Industry options come from the /industries lookup (never
 * hardcoded). Saving flows back through onSave → the page's optimistic PATCH.
 */
import { useTranslation } from 'react-i18next'
import EditableFieldTable from '../../../components/forms/EditableFieldTable'
import { useIndustries } from '../../../lib/useIndustries'

export default function OverviewTab({ c, onSave }) {
  const { t } = useTranslation('customers')
  const { industries } = useIndustries()

  const gGeneral  = t('overview.general')
  const gOnline   = t('overview.online')
  const gSettings = t('overview.settings')
  const gTexts    = t('overview.textsTitle')

  // Field schema → grouped titled cards. Keys match the flat customer shape and
  // are translated to API keys in the page's updateCustomer.
  const fields = [
    { key: 'debtorNumber',  label: t('overview.debtorNumber'), group: gGeneral },
    { key: 'city',          label: t('overview.city'),         group: gGeneral },
    { key: 'industry',      label: t('overview.industry'),     type: 'select', options: industries, group: gGeneral },
    { key: 'employeeCount', label: t('overview.employeeCount'), inputType: 'number', group: gGeneral },
    { key: 'toneOfVoice',   label: t('overview.toneOfVoice'),  group: gGeneral },

    { key: 'website',          label: t('overview.website'),       group: gOnline },
    { key: 'privacyPolicyUrl', label: t('overview.privacyPolicyUrl'), group: gOnline },
    { key: 'hasCareerPage',    label: t('overview.hasCareerPage'), type: 'checkbox', group: gOnline },

    { key: 'hideCompanyName',     label: t('overview.hideCompanyName'),     type: 'checkbox', group: gSettings },
    { key: 'showInVacancies',     label: t('overview.showInVacancies'),     type: 'checkbox', group: gSettings },
    { key: 'excludeFromSourcing', label: t('overview.excludeFromSourcing'), type: 'checkbox', group: gSettings },

    { key: 'description',         label: t('overview.description'),         type: 'textarea', group: gTexts },
    { key: 'recruitmentProblems', label: t('overview.recruitmentProblems'), type: 'textarea', group: gTexts },
  ]

  return <EditableFieldTable title={t('drawer.tabs.overview')} fields={fields} value={c} onSave={onSave} />
}
