import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SendClient } from './send-client'
export const metadata: Metadata = { title: 'Send · Axiym' }
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-state">Loading send…</div>}>
      <SendClient />
    </Suspense>
  )
}
