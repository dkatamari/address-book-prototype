'use client'

import { useId, useRef, useState } from 'react'
import type { AriaAttributes } from 'react'
import Image from 'next/image'
import { Popover } from 'radix-ui'
import { Command } from 'cmdk'
import { RiArrowDownSLine, RiCheckLine, RiSearchLine } from '@remixicon/react'

export type ComboboxOption = {
  value: string
  label: string
  icon?: string
  disabled?: boolean
}
type ComboboxProps = AriaAttributes & {
  id?: string
  label: string
  value: string
  options: ComboboxOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
}
export function Combobox({
  id,
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Select an option',
  disabled,
  clearable,
  ...aria
}: ComboboxProps) {
  const popupId = useId()
  const [open, setOpen] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const selected = options.find((option) => option.value === value)
  const choose = (next: string) => {
    onValueChange(next)
    setOpen(false)
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          {...aria}
          id={id}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={popupId}
          aria-haspopup="dialog"
          disabled={disabled}
          className="combobox-trigger"
          data-placeholder={!value || undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
            }
          }}
        >
          {selected?.icon && (
            <Image src={selected.icon} alt="" width={24} height={24} />
          )}
          <span>{selected?.label || value || placeholder}</span>
          <RiArrowDownSLine size={18} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          id={popupId}
          className="combobox-popover"
          sideOffset={6}
          collisionPadding={16}
          align="start"
          aria-label={`Choose ${label.toLowerCase()}`}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            search.current?.focus()
          }}
        >
          <Command loop label={label}>
            <div className="combobox-search">
              <RiSearchLine size={18} aria-hidden="true" />
              <Command.Input
                ref={search}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label.toLowerCase()}`}
              />
            </div>
            <Command.List className="combobox-list">
              <Command.Empty className="combobox-empty">
                No matches found.
              </Command.Empty>
              {clearable && value && (
                <Command.Item
                  className="combobox-option"
                  value="__clear__"
                  onSelect={() => choose('')}
                >
                  Clear selection
                </Command.Item>
              )}
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  disabled={option.disabled}
                  onSelect={() => choose(option.value)}
                  className="combobox-option"
                >
                  {option.icon && (
                    <Image src={option.icon} alt="" width={24} height={24} />
                  )}
                  <span>{option.label}</span>
                  {option.value === value && (
                    <RiCheckLine
                      className="combobox-check"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
