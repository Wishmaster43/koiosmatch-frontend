/** OrganisationPolicySettings — org-wide policies as their OWN settings sub-menu
 * (Danny 23-07: "Organisatiebeleid — een eigen submenu naast nummering"). Today it
 * carries the MFA-enforcement policy (moved out of CompanySettings, where it sat
 * crammed under the company-profile form); future org policies land here too. */
import MfaEnforcementSetting from './MfaEnforcementSetting'

export default function OrganisationPolicySettings() {
  // MfaEnforcementSetting renders its own "Organisatiebeleid" section heading +
  // admin self-gate — this wrapper only gives it a dedicated menu home.
  return <MfaEnforcementSetting />
}
