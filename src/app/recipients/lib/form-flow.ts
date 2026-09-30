import { partyFields } from './party-details.ts'
import type { FormField, Values } from './types.ts'

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
  if (step === 0) return {}
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
