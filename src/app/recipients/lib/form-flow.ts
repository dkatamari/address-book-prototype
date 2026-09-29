import { partyFields } from './party-details.ts'
import type { AccountPurpose, FormField, Values } from './types.ts'

export const accountPurposes: { value: AccountPurpose; label: string }[] = [
  { value: 'deposit', label: 'Deposit funds from' },
  { value: 'withdraw', label: 'Withdraw/send funds to' },
]
export function purposeErrors(purposes?: AccountPurpose[]): Values {
  return accountPurposes.some(({ value }) => purposes?.includes(value))
    ? {}
    : { accountPurposes: 'Select at least one option to enable.' }
}
export function purposeBadge(purposes?: AccountPurpose[]): string | undefined {
  const deposit = purposes?.includes('deposit')
  const withdraw = purposes?.includes('withdraw')
  if (deposit && withdraw) return 'Deposit & Withdraw/Send'
  if (deposit) return 'Deposit'
  if (withdraw) return 'Withdraw/Send'
}
export function purposeSummary(purposes?: AccountPurpose[]): string {
  return (
    accountPurposes
      .filter((p) => purposes?.includes(p.value))
      .map((p) => p.label)
      .join(' · ') || 'Not specified'
  )
}
// Country-specific holder fields are collected after the country is selected.
export function fieldStep(field: FormField): 1 | 2 {
  return field.section === 'party' &&
    partyFields.some((base) => base.path === field.path)
    ? 1
    : 2
}
export function valuesForCountryChange(values: Values): Values {
  return Object.fromEntries(
    Object.entries(values).filter(([path]) =>
      partyFields.some((field) => field.path === path),
    ),
  )
}
export function stepErrors(
  step: number,
  errors: Values,
  fields: FormField[],
): Values {
  // The setup step only captures address-book metadata. Validate party details
  // before account details, then validate the whole account before review.
  if (step === 0)
    return errors.accountPurposes
      ? { accountPurposes: errors.accountPurposes }
      : {}
  if (step !== 1) return errors
  const partyPaths = fields.filter((f) => fieldStep(f) === 1).map((f) => f.path)
  return Object.fromEntries(
    Object.entries(errors).filter(
      ([path]) =>
        path === 'businessRelationship' ||
        partyPaths.includes(path) ||
        partyPaths.some((p) => p.startsWith(path + '.')),
    ),
  )
}
