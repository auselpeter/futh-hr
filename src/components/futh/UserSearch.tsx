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

export type UserSearchItem = {
  id: string; username?: string; fullName: string; email?: string | null;
  role: string; designation?: { code?: string; name?: string } | null;
  department?: { code?: string; name?: string } | null;
  unit?: { code?: string; name?: string } | null; isActive?: boolean
}

type Props = {
  users?: UserSearchItem[]; value: string; onChange: (id: string) => void;
  placeholder?: string; disabled?: boolean; className?: string;
  filter?: (u: UserSearchItem) => boolean; allowClear?: boolean; includeInactive?: boolean
}

export default function UserSearch({ users, value, onChange, placeholder = 'Search user...', disabled = false, className, filter, allowClear = false, includeInactive = false }: Props) {
  const isLazy = !users
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [lazyUsers, setLazyUsers] = React.useState<UserSearchItem[]>([])
  const [lazyLoading, setLazyLoading] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<UserSearchItem | null>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (!isLazy || !value) return
    const found = lazyUsers.find(u => u.id === value)
    if (found) { setSelectedUser(found); return }
    fetch(`/api/users?q=${encodeURIComponent(value)}`, { cache: 'no-store' })
      .then(r => r.json()).then(data => {
        const u = (data.users || []).find((x: UserSearchItem) => x.id === value)
        if (u) setSelectedUser(u)
      }).catch(() => {})
  }, [value, isLazy, lazyUsers])

  const fetchUsers = React.useCallback((searchQuery: string) => {
    if (!isLazy) return
    setLazyLoading(true)
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    params.set('limit', '50')
    if (includeInactive) params.set('withInactive', 'true')
    fetch(`/api/users?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json()).then(data => setLazyUsers(data.users || []))
      .catch(() => setLazyUsers([])).finally(() => setLazyLoading(false))
  }, [isLazy, includeInactive])

  React.useEffect(() => {
    if (open && isLazy && lazyUsers.length === 0) fetchUsers('')
  }, [open, isLazy, lazyUsers.length, fetchUsers])

  React.useEffect(() => {
    if (!isLazy || !open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchUsers(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, isLazy, open, fetchUsers])

  const inlineList = React.useMemo(() => {
    if (!users) return []
    let arr = users
    if (filter) arr = arr.filter(filter)
    if (!query.trim()) return arr
    const q = query.toLowerCase()
    return arr.filter((u) =>
      (u.fullName || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q) ||
      (u.designation?.code || '').toLowerCase().includes(q) || (u.department?.code || '').toLowerCase().includes(q)
    )
  }, [users, query, filter])

  const list = isLazy ? lazyUsers : inlineList
  const selected = isLazy ? selectedUser || lazyUsers.find(u => u.id === value) || null : (users || []).find((u) => u.id === value) || null

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}>
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Avatar className="size-5"><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(selected.fullName)}</AvatarFallback></Avatar>
              <span className="truncate">{selected.fullName}{selected.designation?.code && <span className="text-muted-foreground ml-1 text-xs">({selected.designation.code})</span>}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1 hidden sm:inline-flex">{selected.role.replace('_', ' ')}</Badge>
            </span>
          ) : (<span>{placeholder}</span>)}
          <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="sm:max-w-md p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="size-4 shrink-0 opacity-50" />
            <CommandInput placeholder="Type a name, IPPIS, username, role, or designation..." value={query} onValueChange={setQuery} className="h-9 border-0 ring-0 focus-visible:ring-0" />
            {isLazy && lazyLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>}
          </div>
          <CommandList>
            <CommandEmpty>{query ? 'No users match your search.' : 'No users available.'}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem value="__none__" onSelect={() => { onChange(''); setOpen(false); setQuery(''); setSelectedUser(null) }} className="gap-2 py-2 italic text-muted-foreground">
                  <Check className={cn('size-4', !value ? 'opacity-100' : 'opacity-0')} /><span>— None —</span>
                </CommandItem>
              )}
              {list.slice(0, 50).map((u) => (
                <CommandItem key={u.id} value={u.id} onSelect={() => { onChange(u.id); setOpen(false); setQuery(''); setSelectedUser(u) }} className="gap-2 py-2">
                  <Check className={cn('size-4', value === u.id ? 'opacity-100' : 'opacity-0')} />
                  <Avatar className="size-6 shrink-0"><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(u.fullName)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.fullName}{u.designation?.code && <span className="text-muted-foreground ml-1 text-xs">({u.designation.code})</span>}</div>
                    <div className="text-xs text-muted-foreground truncate">@{u.username || '—'} · {u.role.replace('_', ' ')}{u.department?.code && <span className="ml-1">· {u.department.code}</span>}</div>
                  </div>
                  {u.isActive === false && <Badge variant="outline" className="text-[10px] py-0 px-1">Inactive</Badge>}
                </CommandItem>
              ))}
              {list.length > 50 && <div className="text-center text-xs text-muted-foreground py-2 border-t">Showing first 50 results. Refine your search to see more.</div>}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
