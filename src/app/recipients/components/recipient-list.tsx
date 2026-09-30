'use client'
import {
  RiArrowRightUpLine,
  RiDeleteBin6Line,
  RiGroupLine,
  RiFileCopyLine,
} from '@remixicon/react'
import Image from 'next/image'
import type { Recipient } from '../lib/types'
import { ACCOUNT, BANK, NAME, networks } from '../lib/requirements'
import {
  countryName,
  recipientAddress,
  ruleRevision,
  snapshot,
} from '../lib/data'
import { accountStatus, accountStatusLabel } from '../lib/account-status'
import { routingSummary } from '../lib/routing'
export function RecipientList({
  items,
  open,
  remove,
  add,
  copy,
}: {
  items: Recipient[]
  open: (r: Recipient) => void
  remove: (r: Recipient) => void
  copy: (value: string) => void
  add: () => void
}) {
  if (!items.length)
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <RiGroupLine size={30} />
        </span>
        <h2>No accounts here yet</h2>
        <p>Add an account or try a different search or filter.</p>
        <button className="btn" onClick={add}>
          Add account <RiArrowRightUpLine size={18} />
        </button>
      </div>
    )
  return (
    <div className="recipient-panel">
      {(['own', 'external'] as const).map((group) => {
        const rows = items.filter((r) => r.relationship === group)
        if (!rows.length) return null
        return (
          <section
            className="recipient-group"
            key={group}
            aria-label={group === 'own' ? 'Own accounts' : 'External accounts'}
          >
            <h2>{group === 'own' ? 'Own Accounts' : 'External Accounts'}</h2>
            <div
              className={`table-heading ${rows[0].kind === 'stablecoin' ? 'wallet-grid' : ''}`}
              aria-hidden="true"
            >
              <span>Account Holder</span>
              <span>
                {rows[0].kind === 'bank'
                  ? 'Account Number / IBAN'
                  : 'Wallet Address'}
              </span>
              {rows[0].kind === 'bank' && <span>Bank</span>}
            </div>
            {rows.map((r) => (
              <div
                className={`recipient-row ${r.kind === 'stablecoin' ? 'wallet-grid' : ''}`}
                key={r.id}
              >
                <button
                  className="recipient-main"
                  onClick={() => open(r)}
                  aria-label={`View ${r.values[NAME]}`}
                >
                  <span className="country-mark">
                    <Image
                      src={
                        r.kind === 'bank'
                          ? `/flags/${r.country}.svg`
                          : `/currencies/${r.currency}.svg`
                      }
                      alt={
                        r.kind === 'bank' ? countryName(r.country) : r.currency
                      }
                      width={32}
                      height={32}
                    />
                  </span>
                  <span className="recipient-name">{r.values[NAME]}</span>
                  <span
                    className="recipient-address"
                    title={recipientAddress(r)}
                  >
                    {recipientAddress(r)}
                  </span>
                </button>
                <div className="truncate-cell account-cell">
                  {r.kind === 'stablecoin' ? (
                    <>
                      <div className="wallet-address-line">
                        <span title={r.values[ACCOUNT]}>
                          {r.values[ACCOUNT]}
                        </span>
                        <button
                          type="button"
                          className="icon-button copy-address-button"
                          aria-label={`Copy wallet address for ${r.values[NAME]}`}
                          title="Copy wallet address"
                          onClick={() => copy(r.values[ACCOUNT])}
                        >
                          <RiFileCopyLine size={14} />
                        </button>
                      </div>
                      <small className="wallet-network">
                        {networks.includes(r.network) && (
                          <Image
                            src={`/chains/${r.network.toUpperCase()}.svg`}
                            alt=""
                            width={16}
                            height={16}
                          />
                        )}
                        <span>
                          {r.network}
                          {!networks.includes(r.network) && ' · Unsupported'}
                        </span>
                      </small>
                    </>
                  ) : (
                    <>
                      <span title={r.values[ACCOUNT]}>{r.values[ACCOUNT]}</span>
                      <small>{routingSummary(snapshot, r)}</small>
                    </>
                  )}
                </div>
                {r.kind === 'bank' && (
                  <div className="truncate-cell bank-cell">
                    <span>{r.values[BANK + 'name'] || 'Bank account'}</span>
                    <small>
                      {countryName(r.country)} · {r.currency}
                    </small>
                  </div>
                )}
                <div className="row-actions">
                  <span
                    className={`status ${accountStatus(r) === 'pending_review' ? 'pending-review' : r.playbookHash && r.playbookHash !== ruleRevision(r.country) ? 'needs-review' : ''}`}
                  >
                    {accountStatus(r) === 'active' &&
                    r.playbookHash &&
                    r.playbookHash !== ruleRevision(r.country)
                      ? 'Review details'
                      : accountStatusLabel(r)}
                  </span>
                  <button
                    className="icon-button delete-button"
                    aria-label={`Delete ${r.values[NAME]}`}
                    onClick={() => remove(r)}
                  >
                    <RiDeleteBin6Line size={16} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
