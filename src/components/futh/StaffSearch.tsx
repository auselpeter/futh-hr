'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/formatters'

export type StaffSearchItem = {
  id: string
  staffId?: string
  fullName: string
  position?: string | null
  rank?: string | null
  email?: string | null
  phone?: string | null
  department?: { code?: string; name?: string } | null
  designation?: { code?: string; name?: string } | null
  status?: string | null
}

type Props = {
  /** Optional: pass a pre-loaded staff list. If omitted, the component lazy-loads from /api/staff. */
  staff?: StaffSearchItem[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Optional pre-filter on the staff list (only applies to inline mode, not lazy mode) */
  filter?: (s: StaffSearchItem) => boolean
  /** Whether to allow "no selection" (shows a "Clear" option at the top of the list) */
  allowClear?: boolean
}

/**
 * StaffSearch — a searchable combobox for picking a staff member.
 *
 * Two modes:
 *   1. Inline mode: pass `staff` prop → filters client-side (for small lists ≤200)
 *   2. Lazy mode (default when `staff` is not provided): fetches from /api/staff on-demand
 *      with debounced search. Only loads the first 50 matching staff — handles 2,000+ records
 *      efficiently.
 */
export default function StaffSearch({
  staff: inlineStaff,
  value,
  onChange,
  placeholder = 'Search staff...',
  disabled = false,
  className,
  filter,
  allowClear = false,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  // === Lazy-loading state ===
  const [lazyStaff, setLazyStaff] = React.useState<StaffSearchItem[]>([])
  const [lazyLoading, setLazyLoading] = React.useState(false)
  const [selectedStaff, setSelectedStaff] = React.useState<StaffSearchItem | null>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLazy = !inlineStaff || inlineStaff.length === 0

  // Fetch the selected staff's info if we don't have it in the current list
  React.useEffect(() => {
    if (!value || !isLazy) return
    // Check if we already have it in lazyStaff
    const found = lazyStaff.find(s => s.id === value)
    if (found) {
      setSelectedStaff(found)
      return
    }
    // Fetch just this one staff member
    fetch(`/api/staff?q=${encodeURIComponent(value)}`)
      .then(r => r.json())
      .then(d => {
        const found = (d.staff || []).find((s: any) => s.id === value)
        if (found) setSelectedStaff(found)
      })
      .catch(() => {})
  }, [value, isLazy, lazyStaff])

  // Debounced fetch for lazy mode
  const fetchStaff = React.useCallback((searchQuery: string) => {
    if (!isLazy) return
    setLazyLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (searchQuery) params.set('q', searchQuery)
    fetch(`/api/staff?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setLazyStaff(d.staff || [])
      })
      .catch(() => setLazyStaff([]))
      .finally(() => setLazyLoading(false))
  }, [isLazy])

  // Fetch initial list when popover opens
  React.useEffect(() => {
    if (open && isLazy && lazyStaff.length === 0) {
      fetchStaff('')
    }
  }, [open, isLazy, lazyStaff.length, fetchStaff])

  // Debounced search when query changes
  React.useEffect(() => {
    if (!isLazy || !open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchStaff(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, isLazy, open, fetchStaff])

  // === Inline mode filtering (client-side) ===
  const inlineList = React.useMemo(() => {
    if (isLazy) return []
    let arr = inlineStaff || []
    if (filter) arr = arr.filter(filter)
    if (!query.trim()) return arr
    const q = query.toLowerCase()
    return arr.filter((s) =>
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.staffId || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.position || '').toLowerCase().includes(q) ||
      (s.department?.code || '').toLowerCase().includes(q) ||
      (s.department?.name || '').toLowerCase().includes(q) ||
      (s.designation?.code || '').toLowerCase().includes(q) ||
      (s.designation?.name || '').toLowerCase().includes(q)
    )
  }, [inlineStaff, query, filter, isLazy])

  const list = isLazy ? lazyStaff : inlineList
  const selected = isLazy
    ? selectedStaff || lazyStaff.find(s => s.id === value) || null
    : (inlineStaff || []).find(s => s.id === value) || null

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Avatar className="size-5">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(selected.fullName)}</AvatarFallback>
              </Avatar>
              <span className="truncate">
                {selected.fullName}
                {selected.staffId && <span className="text-muted-foreground ml-1 text-xs">— {selected.staffId}</span>}
              </span>
              {selected.department?.code && (
                <Badge variant="outline" className="text-[10px] py-0 px-1 hidden sm:inline-flex">{selected.department.code}</Badge>
              )}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="sm:max-w-md p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="size-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={isLazy ? "Type a name, staff ID, or department... (loads from server)" : "Type a name, staff ID, or department..."}
              value={query}
              onValueChange={setQuery}
              className="h-9 border-0 ring-0 focus:ring-0"
            />
            {isLazy && lazyLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>}
          </div>
          <CommandList>
            <CommandEmpty>{query ? 'No staff match your search.' : 'No staff available.'}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange(''); setOpen(false); setQuery('') }}
                  className="gap-2 py-2 italic text-muted-foreground"
                >
                  <Check className={cn('size-4', !value ? 'opacity-100' : 'opacity-0')} />
                  <span>All Staff</span>
                </CommandItem>
              )}
              {list.slice(0, 50).map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => { onChange(s.id); setOpen(false); setQuery('') }}
                  className="gap-2 py-2"
                >
                  <Check className={cn('size-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(s.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {s.fullName}
                      {s.staffId && <span className="text-muted-foreground ml-1 text-xs">— {s.staffId}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.position || s.designation?.name || '—'}
                      {s.department?.code && <span className="ml-1">· {s.department.code}</span>}
                    </div>
                  </div>
                  {s.status && s.status !== 'active' && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1 capitalize">{s.status.replace('_', ' ')}</Badge>
                  )}
                </CommandItem>
              ))}
              {list.length > 50 && (
                <div className="text-center text-xs text-muted-foreground py-2 border-t">
                  Showing first 50 results. Refine your search to see more.
                </div>
              )}
              {isLazy && !query && list.length === 50 && (
                <div className="text-center text-xs text-muted-foreground py-2 border-t">
                  Showing first 50 staff. Type to search by name, ID, or department.
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
