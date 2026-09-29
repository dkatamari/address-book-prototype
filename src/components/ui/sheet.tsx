'use client'

import type { ComponentProps } from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { RiCloseLine } from '@remixicon/react'
import { cn } from '@/lib/utils'

// shadcn-style composition, backed by Radix Dialog's modal and presence handling.
export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close
export const SheetTitle = SheetPrimitive.Title
export const SheetDescription = SheetPrimitive.Description

export function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="sheet-overlay"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn('sheet-content', className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            className="icon-button sheet-close"
            aria-label="Close"
          >
            <RiCloseLine size={20} />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}
