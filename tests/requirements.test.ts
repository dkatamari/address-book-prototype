import {
  fieldStep,
  stepErrors,
  valuesForCountryChange,
} from '../src/app/recipients/lib/form-flow.ts'
import { ownPartyValues } from '../src/app/recipients/lib/party-details.ts'
import { routingSummary } from '../src/app/recipients/lib/routing.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import {
  ACCOUNT,
  BANK,
  NAME,
  P,
  evaluate,
  matchContext,
  resolve,
  walletErrors,
} from '../src/app/recipients/lib/requirements.ts'
import {
  parseRecipients,
  serializeRecipients,
} from '../src/app/recipients/lib/storage.ts'
import type {
  Draft,
  Expression,
  Snapshot,
} from '../src/app/recipients/lib/types.ts'
const snapshot: Snapshot = JSON.parse(
  fs.readFileSync('src/data/playbooks/snapshot.json', 'utf8'),
)
const draft = (country: string): Draft => ({
  kind: 'bank',
  relationship: 'external',
  country,
  currency: snapshot.index.countries.find((c) => c.countryCode === country)!
    .payoutCurrencies[0],
  network: '',
  values: { ...ownPartyValues, [NAME]: 'Example Ltd', [ACCOUNT]: '1234567890' },
})
test('all imported destinations resolve without a backend', () => {
  assert.equal(snapshot.index.countries.length, 16)
  for (const c of snapshot.index.countries) {
    const result = resolve(snapshot, draft(c.countryCode))
    assert.equal(result.supported, true)
    assert.ok(result.fields.some((f) => f.path === ACCOUNT))
    assert.ok(
      result.fields.every((f) => f.path.startsWith('payment.creditor.')),
    )
  }
})
test('Hong Kong preserves leading zeros and requires its clearing code, not BIC', () => {
  const d = draft('HK')
  d.values[BANK + 'clearingSystemMemberId'] = ' 0 0 4 '
  const r = resolve(snapshot, d)
  assert.equal(r.values[BANK + 'clearingSystemMemberId'], '004')
  assert.equal(r.values[BANK + 'clearingSystemCode'], 'HKNCC')
  assert.equal(r.values[P + 'account.accountIdentifierType'], 'BBAN')
  assert.deepEqual(r.errors, {})
  d.values[BANK + 'clearingSystemMemberId'] = '4'
  assert.ok(resolve(snapshot, d).errors[BANK + 'clearingSystemMemberId'])
})
test('China normalizes BIC, validates optional CNAPS only when entered', () => {
  const d = draft('CN')
  d.values[BANK + 'bic'] = ' exam cn bj '
  d.values[P + 'party.identification.identificationType'] = 'CINC'
  d.values[P + 'party.identification.identificationId'] = 'DEMO-123'
  assert.deepEqual(resolve(snapshot, d).errors, {})
  assert.equal(resolve(snapshot, d).values[BANK + 'bic'], 'EXAMCNBJ')
  d.values[BANK + 'clearingSystemMemberId'] = '123'
  assert.ok(resolve(snapshot, d).errors[BANK + 'clearingSystemMemberId'])
  d.values[BANK + 'bic'] = 'EXAMHKBJ'
  assert.ok(resolve(snapshot, d).errors[BANK + 'bic'])
})
test('IBAN destination enforces its country format', () => {
  const d = draft('PK')
  assert.ok(resolve(snapshot, d).errors[ACCOUNT])
  d.values[ACCOUNT] = 'pk36 scbl 0000 0011 2345 6702'
  const r = resolve(snapshot, d)
  assert.equal(r.errors[ACCOUNT], undefined)
  assert.equal(r.values[ACCOUNT], 'PK36SCBL0000001123456702')
})
test('nested alternatives require a complete branch', () => {
  const e: Expression = {
    anyOf: [
      { field: { path: 'a' } },
      { allOf: [{ field: { path: 'b' } }, { field: { path: 'c' } }] },
    ],
  }
  assert.equal(evaluate(e, { b: 'yes' }, {}), false)
  assert.equal(evaluate(e, { b: 'yes', c: 'yes' }, {}), true)
  assert.equal(evaluate(e, { a: 'yes' }, {}), true)
})
test('missing transaction context remains unknown rather than becoming valid', () => {
  assert.equal(matchContext({ amountAtLeast: '1000' }, {}), 'unknown')
  assert.equal(
    matchContext({ destinationCountry: 'CN' }, { destinationCountry: 'HK' }),
    'no',
  )
  assert.equal(
    matchContext(
      { creditorPartyType: ['BUSINESS', 'INDIVIDUAL'] },
      { creditorPartyType: 'BUSINESS' },
    ),
    'yes',
  )
})
test('stablecoin checks are explicitly separate from country rules', () => {
  const d: Draft = {
    ...draft('HK'),
    kind: 'stablecoin',
    currency: 'USDT',
    network: 'Avalanche',
  }
  assert.ok(walletErrors(d)[ACCOUNT])
  d.values[ACCOUNT] = '0x' + 'a'.repeat(40)
  assert.deepEqual(walletErrors(d), {})
  d.network = 'Tron'
  assert.ok(walletErrors(d)[ACCOUNT])
  d.values[ACCOUNT] = 'T' + 'a'.repeat(33)
  assert.deepEqual(walletErrors(d), {})
})
test('local storage preserves an empty address book and rejects corrupt records', () => {
  assert.deepEqual(parseRecipients(serializeRecipients([])), [])
  assert.throws(() => parseRecipients('{'))
  assert.throws(() => parseRecipients('{"version":2,"recipients":[]}'))
  assert.throws(() =>
    parseRecipients('{"version":1,"recipients":[{"id":"oops"}]}'),
  )
})

test('routing labels use the selected playbook scheme in the table and form', () => {
  for (const [country, code, expected] of [
    ['IN', 'HDFC0001234', 'IFSC'],
    ['GH', '130100', 'GIP code'],
    ['HK', '004', 'Clearing code'],
    ['CN', '123456789012', 'CNAPS'],
  ]) {
    const d = draft(country)
    d.values[BANK + 'clearingSystemMemberId'] = code
    assert.equal(routingSummary(snapshot, d), `${expected}: ${code}`)
    assert.equal(
      resolve(snapshot, d).fields.find(
        (f) => f.path === BANK + 'clearingSystemMemberId',
      )?.label,
      expected,
    )
    assert.equal(d.values[BANK + 'clearingSystemCode'], undefined)
  }
})
test('routing labels follow regenerated playbooks and safely handle unknown schemes', () => {
  const d = draft('IN')
  d.values[BANK + 'clearingSystemMemberId'] = 'HDFC0001234'
  for (const [scheme, expected] of [
    ['CNAPS', 'CNAPS'],
    ['NEW_SCHEME', 'Clearing code'],
  ]) {
    const updated: Snapshot = JSON.parse(
      JSON.stringify(snapshot).replaceAll('"INFSC"', JSON.stringify(scheme)),
    )
    assert.equal(routingSummary(updated, d), `${expected}: HDFC0001234`)
  }
  const missing: Snapshot = { ...snapshot, playbooks: {} }
  assert.equal(routingSummary(missing, d), 'Clearing code: HDFC0001234')
  const otherCurrency = { ...d, currency: 'USD' }
  assert.equal(
    routingSummary(snapshot, otherCurrency),
    'Clearing code: HDFC0001234',
  )
})
test('routing summaries preserve BIC, empty and wallet cases', () => {
  const d = draft('IN')
  assert.equal(routingSummary(snapshot, d), 'Code not provided')
  d.values[BANK + 'bic'] = 'EXAMINBBXXX'
  d.values[BANK + 'clearingSystemMemberId'] = 'HDFC0001234'
  assert.equal(routingSummary(snapshot, d), 'BIC: EXAMINBBXXX')
  assert.equal(
    routingSummary(snapshot, {
      ...d,
      kind: 'stablecoin',
      network: 'Avalanche',
    }),
    'Avalanche',
  )
})

test('stablecoin validation rejects unsupported chains', () => {
  const d: Draft = {
    ...draft('HK'),
    kind: 'stablecoin',
    currency: 'USDT',
    network: 'Avalanche',
  }
  d.values[ACCOUNT] = '0x' + 'a'.repeat(40)
  assert.deepEqual(walletErrors(d), {})
  for (const network of ['Ethereum', 'Polygon', '']) {
    assert.equal(walletErrors({ ...d, network }).network, 'Choose a network.')
  }
})
test('only the original demo wallet moves to Avalanche', () => {
  const original = {
    ...draft('HK'),
    kind: 'stablecoin' as const,
    network: 'Ethereum',
    currency: 'USDT',
    id: 'demo-wallet',
    demo: true,
    createdAt: '2026-09-29T00:00:00Z',
    updatedAt: '2026-09-29T00:00:00Z',
  }
  const userCreated = { ...original, id: 'user-wallet', demo: undefined }
  const editedDemo = { ...original, demo: undefined }
  const records = parseRecipients(serializeRecipients([original, userCreated]))
  assert.equal(records[0].network, 'Avalanche')
  assert.equal(records[1].network, 'Ethereum')
  assert.deepEqual(records[1].values, userCreated.values)
  assert.equal(
    parseRecipients(serializeRecipients([editedDemo]))[0].network,
    'Ethereum',
  )
})

test('consumer helpers come from synced details, with specific profile copy taking precedence', () => {
  const result = resolve(snapshot, draft('GH'))
  const account = result.fields.find((field) => field.path === ACCOUNT)
  assert.equal(
    account?.hint,
    "Enter the recipient's account number exactly as provided by their bank, including any leading zeros.",
  )
  const indonesia = resolve(snapshot, draft('ID'))
  assert.ok(
    indonesia.rules.some((rule) => rule.id === 'id_wire_beneficiary_account'),
  )
  assert.equal(
    indonesia.fields.find((field) => field.path === ACCOUNT)?.hint,
    indonesia.rules.find((rule) => rule.id === 'id_creditor_bban')?.details,
  )
  const source = result.rules.find((rule) => rule.id === 'gh_creditor_bban')!
  assert.equal(account?.hint, source.details)
  assert.match(source.notes, /Store it as text/)
  assert.notEqual(account?.hint, source.notes)
})

test('China identification is required on Account Details for own and external accounts', () => {
  const type = P + 'party.identification.identificationType'
  const number = P + 'party.identification.identificationId'
  for (const relationship of ['own', 'external'] as const) {
    const d = { ...draft('CN'), relationship }
    d.values[BANK + 'bic'] = 'EXAMCNBJ'
    const missing = resolve(snapshot, d)
    assert.ok(
      missing.rules.some(
        (r) => r.id === 'cn_incoming_wire_recipient_identification',
      ),
    )
    for (const path of [type, number]) {
      const field = missing.fields.find((f) => f.path === path)!
      assert.equal(field.required, true)
      assert.equal(fieldStep(field), 2)
      assert.ok(stepErrors(2, missing.errors, missing.fields)[path])
    }
    assert.deepEqual(stepErrors(1, missing.errors, missing.fields), {})
    d.values[type] = 'CINC'
    assert.ok(resolve(snapshot, d).errors[number])
    d.values[number] = 'DEMO-123'
    assert.deepEqual(resolve(snapshot, d).errors, {})
    d.values[type] = 'INVALID'
    assert.ok(resolve(snapshot, d).errors[type])
  }
})
test('country changes clear country-specific identity values while preserving Party Details', () => {
  const d = draft('CN')
  d.values[P + 'party.identification.identificationType'] = 'CINC'
  const values = valuesForCountryChange(d.values)
  assert.equal(values[NAME], d.values[NAME])
  assert.equal(
    values[P + 'party.contact.emailAddress'],
    d.values[P + 'party.contact.emailAddress'],
  )
  assert.equal(values[P + 'party.identification.identificationType'], undefined)
  assert.equal(values[ACCOUNT], undefined)
  const hk = resolve(snapshot, { ...draft('HK'), values })
  assert.equal(
    hk.fields.some((f) => f.path.startsWith(P + 'party.identification.')),
    false,
  )
  assert.deepEqual(stepErrors(1, hk.errors, hk.fields), {})
})
test('identification visibility follows the imported rule rather than a hardcoded China condition', () => {
  const updated: Snapshot = structuredClone(snapshot)
  for (const regulation of updated.playbooks.CN.regulatoryRequirements)
    regulation.dataRequirements = regulation.dataRequirements.filter(
      (r) => r.id !== 'cn_incoming_wire_recipient_identification',
    )
  const result = resolve(updated, draft('CN'))
  assert.equal(
    result.fields.some((f) => f.path.startsWith(P + 'party.identification.')),
    false,
  )
})
