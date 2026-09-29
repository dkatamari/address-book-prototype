import type { Draft, Values } from './types.ts'

// Payment API 0.1.0: components.schemas.BusinessRelationship.
// This describes the external account owner's relationship to the user's business,
// separately from the own/external account-ownership choice.
export const businessRelationships = [
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'SERVICE_PROVIDER', label: 'Service provider' },
  { value: 'GROUP_COMPANY', label: 'Group company' },
  { value: 'SUBSIDIARY', label: 'Subsidiary' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'INVESTMENT_TARGET', label: 'Investment target' },
  { value: 'DEBTOR', label: 'Debtor' },
  { value: 'CREDITOR', label: 'Creditor' },
  { value: 'OTHER', label: 'Other' },
] as const
export function isBusinessRelationship(value: unknown): boolean {
  return businessRelationships.some((option) => option.value === value)
}
export function businessRelationshipLabel(value?: string): string {
  return (
    businessRelationships.find((option) => option.value === value)?.label ?? ''
  )
}
export function businessRelationshipErrors(draft: Draft): Values {
  return draft.relationship === 'external' &&
    !isBusinessRelationship(draft.businessRelationship)
    ? {
        businessRelationship:
          'Choose the account owner’s relationship to your business.',
      }
    : {}
}
export function savedBusinessRelationship(draft: Draft): string | undefined {
  return draft.relationship === 'external'
    ? draft.businessRelationship
    : undefined
}
