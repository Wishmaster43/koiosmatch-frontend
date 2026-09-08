/**
 * Fixture response for GET /settings/catalog, built from the contract
 * (DRAFT-SETTINGS-CATALOG-1 §2). Used by tests and screen probes.
 */
import { SettingsCatalogResponse } from './catalogTypes'

export const catalogFixture: SettingsCatalogResponse = {
  data: {
    version: '2026-09-09',
    sections: [
      {
        id: 'windows',
        keys: [
          {
            key: 'no_contact_days',
            section: 'windows',
            type: 'integer',
            rules: ['integer', 'min:1', 'max:365'],
            default: 180,
            aliases: [],
            label_key: 'settings.windows.no_contact_days.label',
            help_key: 'settings.windows.no_contact_days.help',
            ui: 'generic',
            fe_screen: 'windows',
            constraints: { min: 1, max: 365 },
          },
          {
            key: 'stale_candidate_days',
            section: 'windows',
            type: 'integer',
            rules: ['integer', 'min:1', 'max:365'],
            default: 90,
            aliases: [],
            label_key: 'settings.windows.stale_candidate_days.label',
            ui: 'generic',
            fe_screen: 'windows',
            constraints: { min: 1, max: 365 },
          },
        ],
      },
      {
        id: 'retention',
        keys: [
          {
            key: 'retention_candidate_months',
            section: 'retention',
            type: 'integer',
            rules: ['integer', 'min:1', 'max:120'],
            default: 24,
            aliases: [],
            label_key: 'settings.retention.retention_candidate_months.label',
            ui: 'generic',
            fe_screen: 'retention',
            constraints: { min: 1, max: 120 },
          },
        ],
      },
      {
        id: 'messaging',
        keys: [
          {
            key: 'message_load_default_days',
            section: 'messaging',
            type: 'integer',
            rules: ['integer', 'min:1', 'max:365'],
            default: 30,
            aliases: [],
            label_key: 'settings.messaging.message_load_default_days.label',
            ui: 'generic',
            fe_screen: 'messaging',
            constraints: { min: 1, max: 365 },
          },
          {
            key: 'notifications_candidates_enabled',
            section: 'messaging',
            type: 'boolean',
            rules: ['boolean'],
            default: true,
            aliases: ['notif_kandidaten'],
            label_key: 'settings.messaging.notifications_candidates_enabled.label',
            ui: 'generic',
            fe_screen: 'messaging',
          },
          {
            key: 'notification_channel',
            section: 'messaging',
            type: 'enum',
            rules: ['string', 'in:email,whatsapp'],
            default: 'email',
            aliases: [],
            label_key: 'settings.messaging.notification_channel.label',
            ui: 'generic',
            fe_screen: 'messaging',
            options: [
              { value: 'email', label_key: 'settings.messaging.notification_channel.options.email' },
              { value: 'whatsapp', label_key: 'settings.messaging.notification_channel.options.whatsapp' },
            ],
          },
        ],
      },
      {
        id: 'email',
        keys: [
          {
            key: 'email_from_address',
            section: 'email',
            type: 'secret',
            rules: ['string', 'email'],
            default: null,
            aliases: [],
            label_key: 'settings.email.email_from_address.label',
            help_key: 'settings.email.email_from_address.help',
            ui: 'generic',
            fe_screen: 'email',
          },
        ],
      },
      {
        id: 'kpi',
        keys: [
          {
            key: 'dashboard_kpi_order',
            section: 'kpi',
            type: 'json',
            rules: ['json'],
            default: [],
            aliases: [],
            label_key: 'settings.kpi.dashboard_kpi_order.label',
            format: 'kpi_order',
            ui: 'generic',
            fe_screen: 'kpi',
          },
        ],
      },
    ],
  },
}
