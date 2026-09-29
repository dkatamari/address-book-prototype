import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_DOCUMENT_SIZE,
  validateDocument,
} from '../src/app/recipients/lib/documents.ts'
import {
  parseRecipients,
  serializeRecipients,
} from '../src/app/recipients/lib/storage.ts'
import type { Recipient } from '../src/app/recipients/lib/types.ts'

test('supporting documents accept PDFs up to 5 MB and reject invalid input', async () => {
  const valid = new File(['%PDF-1.7\n'], 'bank-statement.pdf', {
    type: 'application/pdf',
  })
  assert.equal(await validateDocument(valid), undefined)
  assert.equal(
    await validateDocument(new File(['%PDF-1.7\n'], 'statement.PDF')),
    undefined,
  )
  assert.equal(
    await validateDocument(
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    ),
    'Choose a PDF document.',
  )
  assert.equal(
    await validateDocument(
      new File(['hello'], 'notes.pdf', { type: 'application/pdf' }),
    ),
    'Choose a valid PDF document.',
  )
  assert.equal(
    await validateDocument(new File([], 'empty.pdf')),
    'Choose a valid PDF document.',
  )
  const content = new Uint8Array(MAX_DOCUMENT_SIZE)
  content.set(new TextEncoder().encode('%PDF-'))
  assert.equal(
    await validateDocument(new File([content], 'maximum.pdf')),
    undefined,
  )
  assert.equal(
    await validateDocument(new File([content, 'x'], 'oversized.pdf')),
    'Choose a PDF no larger than 5 MB.',
  )
})
test('account context and document references survive storage without changing canonical fields', () => {
  const account: Recipient = {
    id: 'account',
    kind: 'bank',
    relationship: 'own',
    country: 'HK',
    currency: 'HKD',
    network: '',
    values: {},
    createdAt: '',
    updatedAt: '',
    bankAddress: '1 Bank Street, Hong Kong',
    accountReason: 'Business collections',
    supportingDocument: { id: 'document', name: 'statement.pdf', size: 100 },
  }
  assert.deepEqual(parseRecipients(serializeRecipients([account])), [account])
  assert.throws(() =>
    parseRecipients(
      serializeRecipients([
        {
          ...account,
          supportingDocument: {
            ...account.supportingDocument!,
            size: MAX_DOCUMENT_SIZE + 1,
          },
        },
      ]),
    ),
  )
})
