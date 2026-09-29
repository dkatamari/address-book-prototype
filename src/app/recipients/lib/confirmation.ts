import type { Draft, FormField } from './types.ts'
import { fieldStep } from './form-flow.ts'
import { displayFieldValue } from './identification.ts'
import { businessRelationshipLabel } from './business-relationship.ts'

export type ConfirmationItem = { label: string; value: string }
const PARTY = 'payment.creditor.party.'
const BANK = 'payment.creditor.agent.financialInstitutionId.'
export function confirmationDetails(
  draft: Draft,
  fields: FormField[],
  countryName: (code: string) => string,
) {
  const value = (path: string) => draft.values[path]?.trim() ?? ''
  const address = (key: string) => value(PARTY + 'address.' + key)
  const addressText = [
    [address('streetName'), address('buildingNumber')]
      .filter(Boolean)
      .join(' '),
    [address('postalCode'), address('city')].filter(Boolean).join(' '),
    address('region'),
    address('country') ? countryName(address('country')) : '',
  ]
    .filter(Boolean)
    .join('\n')
  const party: ConfirmationItem[] = [
    { label: 'Account Holder Name', value: value(PARTY + 'name') },
    { label: 'Address', value: addressText },
  ]
  if (draft.relationship === 'external' && draft.businessRelationship)
    party.push({
      label: 'Relationship',
      value: businessRelationshipLabel(draft.businessRelationship),
    })
  const account: ConfirmationItem[] = []
  for (const field of fields) {
    if (
      !value(field.path) ||
      field.path === PARTY + 'name' ||
      field.path.startsWith(PARTY + 'address.')
    )
      continue
    const item = {
      label: field.label,
      value:
        field.path.endsWith('.country') ||
        field.path.endsWith('.issuerCountry') ||
        field.path.endsWith('.countryOfResidence')
          ? countryName(value(field.path))
          : displayFieldValue(field.path, value(field.path)),
    }
    if (fieldStep(field) === 1) party.push(item)
    else account.push(item)
    if (field.path === BANK + 'name' && draft.bankAddress?.trim())
      account.push({ label: 'Bank Address', value: draft.bankAddress.trim() })
  }
  if (
    draft.kind === 'bank' &&
    draft.bankAddress?.trim() &&
    !value(BANK + 'name')
  )
    account.push({ label: 'Bank Address', value: draft.bankAddress.trim() })
  return { party: party.filter((item) => item.value), account }
}
