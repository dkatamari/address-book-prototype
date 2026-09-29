'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { RiArrowLeftLine, RiFileCopyLine, RiCheckLine } from '@remixicon/react'
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { Recipient } from '../lib/types'
import { ACCOUNT, NAME, networks } from '../lib/requirements'
import {
  countryName,
  recipientAddress,
  ruleRevision,
  snapshot,
} from '../lib/data'
import { accountStatus, accountStatusLabel } from '../lib/account-status'
import { accountDetailItems } from '../lib/account-details'
import { downloadDocument } from '../lib/documents'

function WalletCode({
  address,
  network,
}: {
  address: string
  network: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    QRCode.toCanvas(canvas.current!, address, {
      width: 232,
      margin: 4,
      errorCorrectionLevel: 'M',
    }).catch(() => {
      if (active) setFailed(true)
    })
    return () => {
      active = false
    }
  }, [address])
  return (
    <div className="drawer-wallet-code">
      <div className="drawer-network">
        {networks.includes(network) && (
          <Image
            src={`/chains/${network.toUpperCase()}.svg`}
            alt=""
            width={28}
            height={28}
          />
        )}
        <strong>{network}</strong>
      </div>
      {failed ? (
        <p role="status">QR code unavailable. Copy the wallet address above.</p>
      ) : (
        <canvas
          ref={canvas}
          role="img"
          aria-label={`QR code for wallet address ${address}`}
        />
      )}
    </div>
  )
}

export function AccountDrawer({
  account,
  close,
  remove,
}: {
  account: Recipient
  close: () => void
  remove: () => void
}) {
  const [open, setOpen] = useState(true)
  const opener = useRef<HTMLElement | null>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const pendingAction = useRef<'close' | 'delete' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const bank = account.kind === 'bank'
  const address = account.values[ACCOUNT]
  const pending = accountStatus(account) === 'pending_review'
  const rulesChanged =
    bank &&
    account.playbookHash &&
    account.playbookHash !== ruleRevision(account.country)
  const items = accountDetailItems(snapshot, account, countryName)
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(''), 3000)
    return () => clearTimeout(timer)
  }, [feedback])
  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setFeedback('Copied to clipboard')
      setError('')
    } catch {
      setError('Clipboard unavailable. Select and copy the address manually.')
    }
  }
  async function download() {
    try {
      await downloadDocument(account.supportingDocument!)
      setError('')
    } catch {
      setError('Unable to load the saved document in this browser.')
    }
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) pendingAction.current = 'close'
        setOpen(next)
      }}
    >
      <SheetContent
        className="account-drawer"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
          backButton.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          // Radix keeps the content mounted until the exit animation finishes.
          // Only then unmount this account or hand focus over to delete confirmation.
          if (!pendingAction.current) return
          opener.current?.focus()
          if (pendingAction.current === 'delete') remove()
          else close()
        }}
      >
        <div className="account-drawer-panel">
          <div className="account-drawer-scroll">
            <SheetClose asChild>
              <button
                ref={backButton}
                type="button"
                className="icon-button drawer-back"
                aria-label="Close account details"
              >
                <RiArrowLeftLine size={26} />
              </button>
            </SheetClose>
            <header className="drawer-heading">
              <SheetTitle>{account.values[NAME]}</SheetTitle>
              <SheetDescription>{recipientAddress(account)}</SheetDescription>
            </header>
            <div className="drawer-currency-row">
              <span className="drawer-currency">
                <Image
                  src={
                    bank
                      ? `/flags/${account.country}.svg`
                      : `/currencies/${account.currency}.svg`
                  }
                  alt={bank ? countryName(account.country) : ''}
                  width={40}
                  height={40}
                />
                <strong>{account.currency}</strong>
              </span>
              <span
                className={`status ${pending ? 'pending-review' : rulesChanged ? 'needs-review' : ''}`}
              >
                {rulesChanged && !pending
                  ? 'Review details'
                  : accountStatusLabel(account)}
              </span>
            </div>
            <dl className="drawer-details">
              <div className="drawer-detail-row">
                <dt>{bank ? 'Account Number / IBAN' : 'Wallet Address'}</dt>
                <dd className="drawer-account-number">
                  <span>{address}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      bank ? 'Copy account number' : 'Copy wallet address'
                    }
                    onClick={copy}
                  >
                    {feedback ? (
                      <RiCheckLine size={16} />
                    ) : (
                      <RiFileCopyLine size={16} />
                    )}
                  </button>
                </dd>
              </div>
            </dl>
            <div className="drawer-feedback" role="status">
              {feedback}
            </div>
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            {!bank && address && (
              <WalletCode address={address} network={account.network} />
            )}
            <dl className="drawer-details drawer-additional-details">
              {items.map((item) => (
                <div className="drawer-detail-row" key={item.id}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
              {account.supportingDocument && (
                <div className="drawer-detail-row">
                  <dt>Supporting Document</dt>
                  <dd>
                    <button
                      type="button"
                      className="text-button"
                      onClick={download}
                    >
                      {account.supportingDocument.name}
                    </button>
                  </dd>
                </div>
              )}
            </dl>
            {pending && (
              <p className="drawer-note">
                This account will be ready to use once approved.
              </p>
            )}
            {rulesChanged && (
              <p className="info-banner">
                The country requirements have changed since this account was
                saved. To change its details, delete this entry and submit a new
                account for review.
              </p>
            )}
          </div>
          <footer className="drawer-footer">
            <button
              type="button"
              className="text-button danger"
              onClick={() => {
                pendingAction.current = 'delete'
                setOpen(false)
              }}
            >
              Delete account
            </button>
            <SheetClose asChild>
              <button type="button" className="btn btn-secondary">
                Close
              </button>
            </SheetClose>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  )
}
