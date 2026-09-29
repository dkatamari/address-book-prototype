import {
  partyFields,
  contactErrors,
  normalizeContactValues,
  partyErrors,
} from './party-details.ts'
import { clearingCodeLabel } from './clearing-labels.ts'
import type {
  Draft,
  Expression,
  FormField,
  ModelField,
  Rule,
  RuleField,
  Snapshot,
  Values,
} from './types.ts'
export const P = 'payment.creditor.'
export const NAME = P + 'party.name'
export const ACCOUNT = P + 'account.accountId'
export const BANK = P + 'agent.financialInstitutionId.'
const recipientPath = (p: string) => p.startsWith(P)
const humanize = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (x) => x.toUpperCase())
const labels: Record<string, string> = {
  [NAME]: 'Account Holder Name',
  [ACCOUNT]: 'Account Number/IBAN',
  [BANK + 'name']: 'Bank Name',
  [BANK + 'bic']: 'SWIFT/BIC',
  [BANK + 'clearingSystemMemberId']: 'Clearing code',
  [BANK + 'clearingSystemCode']: 'Clearing system',
  [P + 'agent.branchIdentification.id']: 'Branch code',
  [P + 'party.countryOfResidence']: 'Country of registration',
  [P + 'party.identification.identificationId']:
    'Account owner identification number',
  [P + 'party.identification.identificationType']:
    'Account owner identification type',
  [P + 'party.contact.emailAddress']: 'Email address',
}
export function label(path: string) {
  return (
    partyFields.find((field) => field.path === path)?.label ??
    labels[path] ??
    humanize(path.split('.').at(-1) ?? path)
  )
}
export function leaves(e: Expression): RuleField[] {
  if ('field' in e) return [e.field]
  return ('allOf' in e ? e.allOf : e.anyOf).flatMap(leaves)
}
export function matchContext(
  when: Rule['appliesWhen'],
  context: Values,
): 'yes' | 'no' | 'unknown' {
  let unknown = false
  for (const [key, expected] of Object.entries(when ?? {})) {
    if (!context[key]) {
      unknown = true
      continue
    }
    if (
      !(Array.isArray(expected) ? expected : [expected]).includes(context[key])
    )
      return 'no'
  }
  return unknown ? 'unknown' : 'yes'
}
function project(e: Expression): Expression | undefined {
  if ('field' in e) return recipientPath(e.field.path) ? e : undefined
  if ('anyOf' in e)
    return leaves(e).every((f) => recipientPath(f.path)) ? e : undefined
  const allOf = e.allOf.map(project).filter((x): x is Expression => !!x)
  return allOf.length ? { allOf } : undefined
}
function mandatory(e: Expression): Set<string> {
  if ('field' in e) return new Set([e.field.path])
  const children = ('allOf' in e ? e.allOf : e.anyOf).map(mandatory)
  if ('allOf' in e) return new Set(children.flatMap((x) => [...x]))
  return new Set(
    [...children[0]].filter((p) => children.every((c) => c.has(p))),
  )
}
function normalize(value: string, f: RuleField) {
  let result = value.trim()
  for (const n of f.normalization ?? []) {
    if (n === 'REMOVE_WHITESPACE') result = result.replace(/\s/g, '')
    if (n === 'UPPERCASE') result = result.toUpperCase()
    if (n === 'LOWERCASE') result = result.toLowerCase()
  }
  return result
}
function present(values: Values, path: string) {
  return (
    !!values[path]?.trim() ||
    Object.entries(values).some(
      ([p, v]) => p.startsWith(path + '.') && !!v.trim(),
    )
  )
}
function fieldError(
  f: RuleField,
  values: Values,
  model: Record<string, ModelField>,
  required = true,
): string | undefined {
  const v = values[f.path] ?? ''
  const schema = model[f.path]
  if (schema?.type === 'object') {
    if (!present(values, f.path))
      return required ? `${label(f.path)} is required.` : undefined
    for (const child of schema.required ?? []) {
      const error = fieldError({ path: f.path + '.' + child }, values, model)
      if (error) return error
    }
    return undefined
  }
  if (!v.trim()) return required ? `${label(f.path)} is required.` : undefined
  const c = f.constraints ?? {}
  if (c.const !== undefined && v !== String(c.const))
    return `${label(f.path)} must be ${c.const}.`
  if (c.length !== undefined && v.length !== c.length)
    return `Enter exactly ${c.length} characters.`
  if (c.minLength !== undefined && v.length < c.minLength)
    return `Enter at least ${c.minLength} characters.`
  if (c.maxLength !== undefined && v.length > c.maxLength)
    return `Enter no more than ${c.maxLength} characters.`
  if (c.pattern && !new RegExp(c.pattern).test(v))
    return `${label(f.path)} does not match the country format.`
  if (schema?.pattern && !new RegExp(schema.pattern).test(v))
    return `Enter a valid ${label(f.path).toLowerCase()}.`
  if (schema?.enum && !schema.enum.includes(v))
    return `Choose a valid ${label(f.path).toLowerCase()}.`
}
export function evaluate(
  e: Expression,
  values: Values,
  model: Record<string, ModelField>,
): boolean {
  if ('field' in e) return !fieldError(e.field, values, model)
  if ('allOf' in e) return e.allOf.every((x) => evaluate(x, values, model))
  return e.anyOf.some((x) => evaluate(x, values, model))
}
export function resolve(snapshot: Snapshot, draft: Draft) {
  const playbook = snapshot.playbooks[draft.country]
  const profile = playbook?.paymentMethods
    .find((m) => m.id === 'BANK')
    ?.payoutCurrencies.find((c) => c.currency.code === draft.currency)
  const context: Values = {
    paymentMethod: 'BANK',
    destinationCountry: draft.country,
    payoutCurrency: draft.currency,
    creditorPartyType: 'BUSINESS',
    transferScope: 'CROSS_BORDER',
    creditorResidenceCountry:
      draft.values[P + 'party.countryOfResidence'] ?? '',
  }
  const rules: Rule[] = []
  const deferred: string[] = []
  const take = (rule: Rule, parent: 'yes' | 'no' | 'unknown' = 'yes') => {
    const matches = matchContext(rule.appliesWhen, context)
    if (parent === 'no' || matches === 'no') return
    const e = project(rule.expression)
    if (!e) return
    if (parent === 'unknown' || matches === 'unknown') {
      deferred.push(rule.label)
      return
    }
    rules.push({ ...rule, expression: e })
  }
  for (const r of profile?.requirements ?? []) take(r)
  for (const reg of playbook?.regulatoryRequirements ?? []) {
    if (
      reg.status !== 'IN_FORCE' ||
      reg.effectiveFrom > new Date().toISOString().slice(0, 10)
    )
      continue
    for (const r of reg.dataRequirements)
      take(r, matchContext(reg.appliesWhen, context))
  }
  const values = {
    ...normalizeContactValues(draft.values),
    [P + 'party.partyType']: 'BUSINESS',
    [P + 'account.currency']: draft.currency,
  }
  for (const r of rules)
    for (const f of leaves(r.expression))
      if (values[f.path]) values[f.path] = normalize(values[f.path], f)
  const active = rules.filter(
    (r) =>
      r.requirementLevel !== 'OPTIONAL' ||
      leaves(r.expression).some(
        (f) => f.constraints?.const === undefined && present(values, f.path),
      ),
  )
  for (const r of active) {
    const required = mandatory(r.expression)
    for (const f of leaves(r.expression))
      if (required.has(f.path) && f.constraints?.const !== undefined)
        values[f.path] = String(f.constraints.const)
  }
  const requiredPaths = new Set([
    NAME,
    ACCOUNT,
    ...active.flatMap((r) => [...mandatory(r.expression)]),
  ])
  const fields = new Map<string, FormField>()
  function add(path: string, required: boolean, hint?: string) {
    const schema = snapshot.fields[path]
    if (schema?.type === 'object') {
      for (const child of Object.keys(snapshot.fields).filter(
        (p) =>
          p.startsWith(path + '.') && !p.slice(path.length + 1).includes('.'),
      ))
        add(
          child,
          required && !!schema.required?.includes(child.slice(path.length + 1)),
          hint,
        )
      return
    }
    const existing = fields.get(path)
    fields.set(path, {
      path,
      label: label(path),
      required: required || !!existing?.required,
      // Profile-specific input guidance takes precedence over general regulatory copy.
      hint: existing?.hint ?? hint,
      enum: schema?.enum,
      section: path.startsWith(P + 'party.') ? 'party' : 'account',
    })
  }
  add(NAME, true)
  add(ACCOUNT, true)
  add(BANK + 'name', false)
  add(BANK + 'bic', false)
  for (const field of partyFields) add(field.path, field.required, field.hint)
  for (const r of rules)
    for (const f of leaves(r.expression)) {
      if (f.constraints?.const !== undefined) continue
      add(f.path, requiredPaths.has(f.path), r.details)
    }
  if (values[P + 'account.accountIdentifierType'] === 'IBAN')
    fields.get(ACCOUNT)!.label = 'IBAN'
  const clearingField = fields.get(BANK + 'clearingSystemMemberId')
  if (clearingField)
    clearingField.label = clearingCodeLabel(values[BANK + 'clearingSystemCode'])
  const errors: Values = {}
  if (!profile) errors.country = 'Choose a supported country and currency.'
  for (const f of fields.values()) {
    const error = fieldError(
      { path: f.path },
      values,
      snapshot.fields,
      f.required,
    )
    if (error) errors[f.path] = error
  }
  // Optional object data must still satisfy its structural children when provided.
  for (const object of [P + 'party.address', P + 'party.identification']) {
    if (present(values, object))
      for (const child of snapshot.fields[object]?.required ?? []) {
        const p = object + '.' + child
        const error = fieldError({ path: p }, values, snapshot.fields)
        if (error) errors[p] = error
      }
  }
  for (const r of active) {
    for (const f of leaves(r.expression)) {
      if (!present(values, f.path)) continue
      const error = fieldError(f, values, snapshot.fields, false)
      if (error) errors[f.path] = error
    }
    if (!evaluate(r.expression, values, snapshot.fields)) {
      for (const path of mandatory(r.expression)) {
        const field = leaves(r.expression).find((f) => f.path === path)!
        const error = fieldError(field, values, snapshot.fields)
        if (error) errors[path] = error
      }
      errors['rule:' + r.id] =
        `${r.label}: complete the required fields or a valid alternative.`
    }
  }
  Object.assign(errors, contactErrors(values))
  return {
    fields: [...fields.values()],
    values,
    errors,
    deferred,
    rules,
    supported: !!profile,
  }
}
export const networks = ['Avalanche', 'Tron']
export function walletErrors(draft: Draft): Values {
  const errors: Values = partyErrors(draft.values)
  if (!draft.values[NAME]?.trim())
    errors[NAME] = 'Enter the account holder name.'
  if (!['USDT', 'USDC'].includes(draft.currency))
    errors.currency = 'Choose a stablecoin.'
  if (!networks.includes(draft.network)) errors.network = 'Choose a network.'
  const address = draft.values[ACCOUNT]?.trim() ?? ''
  const pattern =
    draft.network === 'Tron'
      ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/
      : /^0x[a-fA-F0-9]{40}$/
  if (!pattern.test(address))
    errors[ACCOUNT] =
      `Enter a valid ${draft.network || 'wallet'} address format.`
  return errors
}
