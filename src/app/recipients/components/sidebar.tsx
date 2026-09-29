'use client'
import Image from 'next/image'
import {
  RiDashboardLine,
  RiGroupLine,
  RiHistoryLine,
  RiSettings3Line,
  RiLogoutBoxRLine,
  RiCloseLine,
} from '@remixicon/react'
export function Sidebar({
  onRecipients,
  open,
  close,
}: {
  onRecipients: () => void
  open: boolean
  close: () => void
}) {
  return (
    <>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
      <aside
        className={`sidebar ${open ? 'is-open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="brand">
          <Image
            src="/axiym.svg"
            width={145}
            height={42}
            alt="Axiym"
            priority
          />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={close}
          >
            <RiCloseLine />
          </button>
        </div>
        <div className="profile">
          <span className="avatar">AT</span>
          <div>
            <strong>David Andersson</strong>
            <span>Axi Labs AG</span>
          </div>
        </div>
        <nav>
          <button disabled>
            <RiDashboardLine />
            <span>Dashboard</span>
          </button>
          <button
            className="nav-active"
            aria-current="page"
            onClick={() => {
              onRecipients()
              close()
            }}
          >
            <RiGroupLine />
            <span>Address book</span>
          </button>
          <button disabled>
            <RiHistoryLine />
            <span>History</span>
          </button>
          <button disabled>
            <RiSettings3Line />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button disabled>
            <RiLogoutBoxRLine />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
