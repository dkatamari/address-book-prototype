'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { RiMenuLine } from '@remixicon/react'
import { Sidebar } from '../../recipients/components/sidebar'
export function SendShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <Sidebar
        active="dashboard"
        onRecipients={() => router.push('/recipients')}
        open={open}
        close={() => setOpen(false)}
      />
      <main className="main-content send-content">
        <div className="mobile-bar">
          <button
            className="icon-button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <RiMenuLine />
          </button>
          <span>axiym</span>
        </div>
        {children}
      </main>
    </div>
  )
}
