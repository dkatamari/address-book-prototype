'use client'
import { useEffect, useRef } from 'react'
import { RiArrowLeftLine, RiTimeLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import type { Recipient } from '../lib/types'
import { NAME, ACCOUNT } from '../lib/requirements'
import { countryName } from '../lib/data'
export function AccountSaved({
  account,
  back,
}: {
  account: Recipient
  back: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
    window.scrollTo({ top: 0 })
  }, [])
  return (
    <div className="form-page">
      <button className="back-link" onClick={back}>
        <RiArrowLeftLine size={18} />
        Back
      </button>
      <section
        className="form-panel account-saved"
        aria-labelledby="account-saved-title"
      >
        <span className="account-saved-mark">
          <RiTimeLine size={32} aria-hidden="true" />
        </span>
        <h1 id="account-saved-title" ref={heading} tabIndex={-1}>
          Account submitted for review
        </h1>
        <p>Once approved, this account will become active and ready to use.</p>
        <div className="account-saved-summary">
          <strong>{account.values[NAME]}</strong>
          <span>
            {account.kind === 'bank' ? 'Bank account' : 'Stablecoin wallet'} ·{' '}
            {account.kind === 'bank'
              ? countryName(account.country)
              : account.network}{' '}
            · {account.currency}
          </span>
          <span className="account-saved-number">
            {account.values[ACCOUNT]}
          </span>
        </div>
        <Button className="btn" onClick={back}>
          Back to address book
        </Button>
      </section>
    </div>
  )
}
