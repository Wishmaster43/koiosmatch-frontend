/**
 * Settings registry — logName validation (CHANGELOG-OVERAL-1)
 *
 * Rule: every registry item's logName must be either:
 *  — undefined (omitted): defaults to 'settings' (the key/value tenant settings table)
 *  — null: the section's tables are not yet audited (or multi-table)
 *  — a string: one of the audited table names from AUDIT-LOG-NAMES.md
 *
 * This test ensures no typos or invalid table names sneak in.
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './registry'

// All audited tables from koiosmatch-api/docs/reference/AUDIT-LOG-NAMES.md
const AUDITED_TABLES = new Set([
  'action_rules',
  'ai_agents',
  'ai_faqs',
  'ai_knowledge',
  'ai_prompts',
  'applications',
  'application_documents',
  'application_notes',
  'application_proposals',
  'application_stages',
  'appointments',
  'appointment_locations',
  'appointment_types',
  'assessment_criteria_groups',
  'assessment_criteria',
  'auth_invites',
  'branch_links',
  'candidates',
  'candidate_availabilities',
  'candidate_blacklist_reasons',
  'candidate_certifications',
  'candidate_documents',
  'candidate_document_types',
  'candidate_educations',
  'candidate_freelance_profiles',
  'candidate_genders',
  'candidate_languages',
  'candidate_notes',
  'candidate_phases',
  'candidate_planning_settings',
  'candidate_preferences',
  'candidate_references',
  'candidate_rejection_reasons',
  'candidate_skills',
  'candidate_sources',
  'candidate_statuses',
  'candidate_tags',
  'candidate_types',
  'candidate_work_experiences',
  'collective_labour_agreements',
  'contact_documents',
  'contact_functions',
  'contract_types',
  'custom_field_definitions',
  'customers',
  'customer_blacklist_reasons',
  'customer_contacts',
  'customer_contact_customer_department',
  'customer_contact_customer_location',
  'customer_contact_statuses',
  'customer_departments',
  'customer_department_statuses',
  'customer_documents',
  'customer_locations',
  'customer_location_statuses',
  'customer_notes',
  'customer_phases',
  'customer_sources',
  'customer_statuses',
  'customer_tags',
  'driver_licenses',
  'education_levels',
  'emergency_contact_relations',
  'escalation_reasons',
  'external_api_keys',
  'industries',
  'integration_mappings',
  'interview_flows',
  'invoices',
  'jargon_terms',
  'job_functions',
  'languages',
  'language_levels',
  'last_contact_types',
  'locations',
  'match_contract_lines',
  'match_documents',
  'match_notes',
  'match_renewals',
  'match_statuses',
  'match_stop_reasons',
  'match_terminations',
  'match_weight_templates',
  'matches',
  'messages',
  'message_purposes',
  'module_activations',
  'module_settings',
  'nationalities',
  'note_types',
  'opportunities',
  'opportunity_agreement_types',
  'opportunity_deal_types',
  'opportunity_documents',
  'opportunity_lost_reasons',
  'opportunity_notes',
  'opportunity_service_types',
  'opportunity_stages',
  'outreach_campaigns',
  'outreach_campaign_documents',
  'outreach_campaign_notes',
  'outreach_outcomes',
  'outreach_statuses',
  'outreach_targets',
  'planning_cancellation_reasons',
  'planning_connections',
  'planning_orders',
  'planning_preferences',
  'planning_schedules',
  'planning_shifts',
  'platform_settings',
  'pools',
  'price_agreements',
  'provinces',
  'reference_relations',
  'role_branches',
  'settings',
  'skill_levels',
  'sm_saved_filters',
  'tasks',
  'task_comments',
  'task_documents',
  'task_links',
  'task_priorities',
  'task_statuses',
  'task_types',
  'teams',
  'tenant_billing_tiers',
  'user_branches',
  'vacancies',
  'vacancy_channels',
  'vacancy_channel_publications',
  'vacancy_content_blocks',
  'vacancy_documents',
  'vacancy_education_levels',
  'vacancy_generation_profiles',
  'vacancy_languages',
  'vacancy_notes',
  'vacancy_seniority_levels',
  'vacancy_skills',
  'vacancy_statuses',
  'vacancy_tags',
  'webhooks',
  'webhook_lookups',
  'webhook_subscriptions',
  'whatsapp_connections',
  'whatsapp_message_types',
  'whatsapp_phone_numbers',
  'work_permit_types',
  'workflows',
  'workflow_folders',
  'workflow_steps',
])

describe('Settings registry logName validation', () => {
  it('every item has a valid logName (null or audited table name)', () => {
    const invalid = []

    NAV_GROUPS.forEach(group => {
      group.items.forEach(item => {
        // undefined logName is OK (defaults to 'settings')
        if (item.logName === undefined) return

        // null is OK (no audit trail yet / multi-table)
        if (item.logName === null) return

        // logName must be a string in the audited tables set
        if (typeof item.logName !== 'string' || !AUDITED_TABLES.has(item.logName)) {
          invalid.push(
            `${group.key}/${item.id}: logName='${item.logName}' is not a valid audited table name`
          )
        }
      })
    })

    expect(invalid).toEqual([], invalid.join('\n'))
  })

  it('every non-null logName appears in the audited tables list', () => {
    // Sanity check: extract all non-null logName values from the registry
    // and verify they're all in AUDITED_TABLES
    const found = new Set()
    NAV_GROUPS.forEach(group => {
      group.items.forEach(item => {
        if (typeof item.logName === 'string') {
          found.add(item.logName)
        }
      })
    })

    const invalid = Array.from(found).filter(name => !AUDITED_TABLES.has(name))
    expect(invalid).toEqual([], `These logName values are not in AUDITED_TABLES: ${invalid.join(', ')}`)
  })
})
