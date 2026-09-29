'use client'
import { useState } from 'react'
import Image from 'next/image'
import { RiPencilLine, RiFilePdf2Line, RiDownload2Line } from '@remixicon/react'
import type { Draft, FormField } from '../lib/types'
import { confirmationDetails, type ConfirmationItem } from '../lib/confirmation'
import { countryName, snapshot } from '../lib/data'
import { purposeBadge } from '../lib/form-flow'
import { downloadDocument, downloadFile } from '../lib/documents'

function Details({ items }: { items: ConfirmationItem[] }) {
  return (
    <dl className="confirmation-grid">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
export function AccountConfirmation({
  draft,
  fields,
  file,
  edit,
  busy,
}: {
  draft: Draft
  fields: FormField[]
  file?: File
  edit: (step: number) => void
  busy: boolean
}) {
  const [documentError, setDocumentError] = useState('')
  const { party, account } = confirmationDetails(draft, fields, countryName)
  const bank = draft.kind === 'bank'
  const currency = snapshot.playbooks[draft.country]?.paymentMethods
    .find((method) => method.id === 'BANK')
    ?.payoutCurrencies.find((entry) => entry.currency.code === draft.currency)
    ?.currency.name
  const purpose = purposeBadge(draft.accountPurposes)
  const document = draft.supportingDocument
  function editButton(step: number, name: string) {
    return (
      <button
        type="button"
        className="confirmation-edit"
        disabled={busy}
        aria-label={`Edit ${name}`}
        onClick={() => edit(step)}
      >
        <RiPencilLine size={16} aria-hidden="true" /> Edit
      </button>
    )
  }
  async function download() {
    if (!document) return
    try {
      if (file) downloadFile(file, document.name)
      else await downloadDocument(document)
      setDocumentError('')
    } catch {
      setDocumentError(
        'Unable to open this document. Please attach it again in Account Details.',
      )
    }
  }
  return (
    <div className="account-confirmation">
      <div className="confirmation-overview">
        <div className="context-pills">
          <span>{bank ? 'Bank account' : 'Stablecoin wallet'}</span>
          <span>
            {draft.relationship === 'own' ? 'Own account' : 'External account'}
          </span>
          {purpose && <span>{purpose}</span>}
        </div>
        {editButton(0, 'Account Type')}
      </div>
      <section className="confirmation-section" aria-labelledby="confirm-party">
        <div className="confirmation-heading">
          <h2 id="confirm-party">Party Details</h2>
          {editButton(1, 'Party Details')}
        </div>
        <Details items={party} />
      </section>
      <section
        className="confirmation-section"
        aria-labelledby="confirm-account"
      >
        <div className="confirmation-heading">
          <h2 id="confirm-account">Account Details</h2>
          {editButton(2, 'Account Details')}
        </div>
        <div className="confirmation-currency">
          <Image
            src={
              bank
                ? `/flags/${draft.country}.svg`
                : `/currencies/${draft.currency}.svg`
            }
            width={32}
            height={32}
            alt=""
          />
          <div>
            <strong>
              {bank
                ? `${currency ?? draft.currency}${currency ? ` (${draft.currency})` : ''}`
                : draft.currency}
            </strong>
            <span>
              {bank ? (
                countryName(draft.country)
              ) : (
                <>
                  <Image
                    src={`/chains/${draft.network.toUpperCase()}.svg`}
                    width={16}
                    height={16}
                    alt=""
                  />
                  {draft.network}
                </>
              )}
            </span>
          </div>
        </div>
        <Details items={account} />
      </section>
      {(draft.accountReason?.trim() || document) && (
        <section
          className="confirmation-section"
          aria-labelledby="confirm-support"
        >
          <div className="confirmation-heading">
            <h2 id="confirm-support">Additional Details</h2>
            {editButton(2, 'Additional Details')}
          </div>
          {draft.accountReason?.trim() && (
            <Details
              items={[
                {
                  label: 'Reason For Adding This Account',
                  value: draft.accountReason.trim(),
                },
              ]}
            />
          )}
          {document && (
            <div className="confirmation-document">
              <span className="confirmation-document-icon">
                <RiFilePdf2Line size={24} aria-hidden="true" />
              </span>
              <div>
                <span>Supporting Document</span>
                <strong>{document.name}</strong>
                <small>
                  PDF ·{' '}
                  {document.size < 1024 * 1024
                    ? `${Math.max(1, Math.round(document.size / 1024))} KB`
                    : `${(document.size / (1024 * 1024)).toFixed(1)} MB`}
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Download ${document.name}`}
                onClick={() => void download()}
              >
                <RiDownload2Line size={20} />
              </button>
            </div>
          )}
          {documentError && (
            <p className="field-error" role="alert">
              {documentError}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
