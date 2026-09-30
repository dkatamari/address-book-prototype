import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { createDemoRecipients } from '../src/app/recipients/lib/demo-accounts.ts'
import { accountDetailItems } from '../src/app/recipients/lib/account-details.ts'
import { ACCOUNT, BANK, NAME } from '../src/app/recipients/lib/requirements.ts'
import { ownPartyValues } from '../src/app/recipients/lib/party-details.ts'
import type { Recipient, Snapshot } from '../src/app/recipients/lib/types.ts'
const snapshot: Snapshot = JSON.parse(
  fs.readFileSync('src/data/playbooks/snapshot.json', 'utf8'),
)
const account: Recipient = {
  id: 'test',
  kind: 'bank',
  relationship: 'external',
  businessRelationship: 'SUPPLIER',
  country: 'IN',
  currency: 'INR',
  network: '',
  createdAt: '2026-09-29',
  updatedAt: '2026-09-29',
  bankAddress: 'Bank Street, Mumbai',
  accountReason: 'Supplier account',
  values: {
    ...ownPartyValues,
    [NAME]: 'Test Company',
    [ACCOUNT]: '00123456789',
    [BANK + 'name']: 'Example Bank',
    [BANK + 'clearingSystemMemberId']: 'HDFC0001234',
  },
}
const countryName = (code: string) => (code === 'IN' ? 'India' : code)

test('saved bank details use the playbook code label and preserve saved data', () => {
  const before = structuredClone(account)
  const rows = Object.fromEntries(
    accountDetailItems(snapshot, account, countryName).map(
      ({ label, value }) => [label, value],
    ),
  )
  assert.equal(rows.IFSC, 'HDFC0001234')
  assert.equal(rows['Bank Address'], account.bankAddress)
  assert.equal(rows.Email, 'info@axiym.io')
  assert.equal(rows['Phone number'], '+65 12345678')
  assert.equal(rows['Bank country'], 'India')
  assert.equal(rows.Relationship, 'Supplier')
  assert.equal(rows['Reason For Adding This Account'], account.accountReason)
  assert.deepEqual(account, before)
  // Name, account number and address are shown in the drawer header/primary row.
  assert.ok(!Object.values(rows).includes(account.values[ACCOUNT]))
})
test('wallet details retain contacts but omit bank-only metadata and own-account relationship', () => {
  const rows = Object.fromEntries(
    accountDetailItems(
      snapshot,
      {
        ...account,
        kind: 'stablecoin',
        relationship: 'own',
        network: 'Tron',
        currency: 'USDT',
        values: ownPartyValues,
      },
      countryName,
    ).map(({ label, value }) => [label, value]),
  )
  assert.equal(rows.Ownership, 'Own account')
  assert.equal(rows['Phone number'], '+65 12345678')
  assert.equal(rows.Relationship, undefined)
  assert.equal(rows['Bank Address'], undefined)
  assert.equal(rows['Bank country'], undefined)
})

test('drawer rows have stable unique IDs and show bank country only once for normalized defaults', () => {
  for (const saved of createDemoRecipients(snapshot)) {
    const rows = accountDetailItems(snapshot, saved, countryName)
    assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, saved.id)
    if (saved.kind === 'bank') {
      if (saved.id === 'demo-gh')
        assert.equal(
          saved.values[BANK + 'address.country'],
          saved.country,
          'Ghana reproduces the duplicate canonical and account country',
        )
      const countries = rows.filter(
        (row) => row.id === BANK + 'address.country',
      )
      assert.equal(countries.length, 1)
      assert.equal(countries[0].label, 'Bank country')
      assert.equal(countries[0].value, countryName(saved.country))
    }
    const reversed = {
      ...saved,
      values: Object.fromEntries(Object.entries(saved.values).reverse()),
    }
    assert.deepEqual(
      rows.map((row) => row.id).sort(),
      accountDetailItems(snapshot, reversed, countryName)
        .map((row) => row.id)
        .sort(),
    )
  }
})
