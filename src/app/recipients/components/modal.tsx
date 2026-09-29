'use client'
import { useEffect, useRef } from 'react'
import { RiCloseLine } from '@remixicon/react'
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string
  children: React.ReactNode
  close: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby="dialog-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <RiCloseLine />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
