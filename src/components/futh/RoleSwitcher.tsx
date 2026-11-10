'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  CMD: 'Chief Medical Director',
  CMA: 'Chief Medical Admin',
  AD: 'Administrator',
  DFA: 'Director Finance & Admin',
  HOD: 'Head of Department',
  HOU: 'Head of Unit',
  APPRAISAL_OFFICER: 'Appraisal Officer',
  REGISTRY_OFFICER: 'Registry Officer',
  STAFF: 'Staff',
}

const roleBadgeColor: Record<string, string> = {
  SUPER_ADMIN: 'bg-violet-100 text-violet-700 border-violet-200',
  ADMIN: 'bg-violet-100 text-violet-700 border-violet-200',
  CMD: 'bg-amber-100 text-amber-700 border-amber-200',
  CMA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  AD: 'bg-sky-100 text-sky-700 border-sky-200',
  DFA: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  HOD: 'bg-rose-100 text-rose-700 border-rose-200',
  HOU: 'bg-teal-100 text-teal-700 border-teal-200',
  APPRAISAL_OFFICER: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  REGISTRY_OFFICER: 'bg-orange-100 text-orange-700 border-orange-200',
  STAFF: 'bg-gray-100 text-gray-700 border-gray-200',
}

type Props = {
  user: {
    id: string
    role: string
    activeRole: string
    secondaryRoles: string[]
  }
}

export default function RoleSwitcher({ user }: Props) {
  const [switching, setSwitching] = useState(false)

  // No secondary roles and active role = primary → just show a static badge
  const hasSecondary = (user.secondaryRoles || []).length > 0
  if (!hasSecondary) {
    return (
      <Badge
        variant="outline"
        className={`hidden md:inline-flex text-[10px] font-medium border ${roleBadgeColor[user.activeRole] || roleBadgeColor.STAFF}`}
      >
        {roleLabel[user.activeRole] || user.activeRole}
      </Badge>
    )
  }

  const allRoles = [user.role, ...(user.secondaryRoles || [])].filter(
    (r, i, arr) => arr.indexOf(r) === i
  )

  const switchRole = async (role: string | null) => {
    if (switching) return
    setSwitching(true)
    try {
      const res = await fetch('/api/me/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to switch role')
        setSwitching(false)
        return
      }
      toast.success(`Active role switched to ${roleLabel[data.activeRole] || data.activeRole}`)
      // Reload to refresh permissions throughout the SPA
      setTimeout(() => window.location.reload(), 350)
    } catch (e: any) {
      toast.error('Network error — failed to switch role')
      setSwitching(false)
    }
  }

  return (
    <TooltipProvider delayDuration={250}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={switching}
                className="h-9 px-2 gap-1.5 bg-white/80 hover:bg-white"
              >
                {switching ? (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <RefreshCw className="size-3.5 text-muted-foreground" />
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium border ${roleBadgeColor[user.activeRole] || roleBadgeColor.STAFF}`}
                >
                  {roleLabel[user.activeRole] || user.activeRole}
                </Badge>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Switch role</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch active role
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allRoles.map((r) => {
            const active = (user.activeRole || user.role) === r
            const isPrimary = r === user.role
            return (
              <DropdownMenuItem
                key={r}
                onClick={() => switchRole(isPrimary ? null : r)}
                className="flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{roleLabel[r] || r}</span>
                  {isPrimary && (
                    <span className="text-[10px] text-muted-foreground">(primary)</span>
                  )}
                </div>
                {active && <Check className="size-4 text-green-600" />}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => switchRole(null)}
            className="flex items-center justify-between gap-2 cursor-pointer text-xs text-muted-foreground"
          >
            <span>Revert to primary role ({roleLabel[user.role] || user.role})</span>
            {user.activeRole === user.role && <Check className="size-3 text-green-600" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
