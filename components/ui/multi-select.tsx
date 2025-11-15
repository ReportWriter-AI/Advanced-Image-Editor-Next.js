"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface MultiSelectOption {
  value: string
  label: string
  description?: string
}

interface MultiSelectProps {
  value: string[]
  onChange: (values: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  maxBadges?: number
  className?: string
}

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select options",
  emptyText = "No results found.",
  disabled,
  maxBadges = 3,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOptions = React.useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value]
  )

  const toggleValue = (optionValue: string) => {
    if (disabled) return
    const exists = value.includes(optionValue)
    onChange(exists ? value.filter((val) => val !== optionValue) : [...value, optionValue])
  }

  const clearAll = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (disabled) return
    onChange([])
  }

  const displayedBadges = selectedOptions.slice(0, maxBadges)
  const remainingCount = selectedOptions.length - displayedBadges.length

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between hover:bg-muted",
              !selectedOptions.length && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {selectedOptions.length ? `${selectedOptions.length} selected` : placeholder}
            </span>
            <div className="flex items-center gap-1">
              {selectedOptions.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  aria-label="Clear selection"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandList className="max-h-60">
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = value.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.value} ${option.label}`}
                      onSelect={() => toggleValue(option.value)}
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          {option.description && (
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {displayedBadges.map((option) => (
            <Badge key={option.value} variant="secondary" className="flex items-center gap-1">
              <span className="max-w-[180px] truncate">{option.label}</span>
              <button
                type="button"
                onClick={() => toggleValue(option.value)}
                className="rounded-full outline-none hover:text-destructive focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove</span>
              </button>
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{remainingCount} more
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}


