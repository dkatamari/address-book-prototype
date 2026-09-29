import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title: 'Address book · Axiym',
  description:
    'A standalone Axiym address book for deposit and withdrawal accounts.',
}
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
