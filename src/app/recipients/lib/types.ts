export type Values = Record<string, string>
export type Constraints = {
  const?: string | number | boolean
  pattern?: string
  length?: number
  minLength?: number
  maxLength?: number
}
export type RuleField = {
  path: string
  constraints?: Constraints
  normalization?: string[]
}
export type Expression =
  | { field: RuleField }
  | { allOf: Expression[] }
  | { anyOf: Expression[] }
export type Rule = {
  id: string
  label: string
  requirementLevel: 'REQUIRED' | 'CONDITIONAL' | 'OPTIONAL'
  appliesWhen?: Record<string, string | string[]>
  expression: Expression
  details: string
  notes: string
}
export type Playbook = {
  id: string
  version: string
  destination: { country: { code: string; name: string } }
  paymentMethods: {
    id: string
    payoutCurrencies: {
      currency: { code: string; name: string }
      localCurrency: boolean
      requirements: Rule[]
    }[]
  }[]
  regulatoryRequirements: {
    id: string
    status: string
    effectiveFrom: string
    appliesWhen: Record<string, string | string[]>
    dataRequirements: Rule[]
  }[]
}
export type ModelField = {
  type: string
  enum?: string[]
  required?: string[]
  pattern?: string
  description?: string
}
export type Snapshot = {
  source: { revision: string; hashes: Record<string, string>; dirty: boolean }
  index: {
    version: string
    countries: {
      countryCode: string
      countryName: string
      payoutCurrencies: string[]
    }[]
  }
  playbooks: Record<string, Playbook>
  fields: Record<string, ModelField>
}
export type FormField = {
  path: string
  label: string
  required: boolean
  hint?: string
  enum?: string[]
  section: 'account' | 'party'
  fixed?: string
}
export type SupportingDocument = { id: string; name: string; size: number }
export type Recipient = {
  status?: 'pending_review' | 'active'
  businessRelationship?: string
  bankAddress?: string
  accountReason?: string
  supportingDocument?: SupportingDocument
  id: string
  kind: 'bank' | 'stablecoin'
  relationship: 'own' | 'external'
  country: string
  currency: string
  network: string
  values: Values
  createdAt: string
  updatedAt: string
  playbookHash?: string
  demo?: boolean
}
export type Draft = Pick<
  Recipient,
  | 'kind'
  | 'relationship'
  | 'businessRelationship'
  | 'bankAddress'
  | 'accountReason'
  | 'supportingDocument'
  | 'country'
  | 'currency'
  | 'network'
  | 'values'
>
