'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { LogOut, Menu, User, Settings as SettingsIcon } from 'lucide-react'
import { initials } from '@/lib/formatters'
import NotificationBell from './NotificationBell'
import RoleSwitcher from './RoleSwitcher'

type Props = {
  user: any
  unreadMail: number
  pendingReqs: number
  onLogout: () => void
  onNavigate: (v: any) => void
  onOpenMobile: () => void
}

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
  SUPER_ADMIN: 'bg-violet-100 text-violet-700',
  ADMIN: 'bg-violet-100 text-violet-700',
  CMD: 'bg-amber-100 text-amber-700',
  CMA: 'bg-emerald-100 text-emerald-700',
  AD: 'bg-sky-100 text-sky-700',
  DFA: 'bg-cyan-100 text-cyan-700',
  HOD: 'bg-indigo-100 text-indigo-700',
  HOU: 'bg-blue-100 text-blue-700',
  APPRAISAL_OFFICER: 'bg-fuchsia-100 text-fuchsia-700',
  REGISTRY_OFFICER: 'bg-orange-100 text-orange-700',
  STAFF: 'bg-gray-100 text-gray-700',
}

export default function Topbar({
  user,
  unreadMail,
  pendingReqs,
  onLogout,
  onNavigate,
  onOpenMobile,
}: Props) {
  const role = user?.activeRole || user?.role || 'STAFF'
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-border px-4 lg:px-6 h-16 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobile}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        <div>
          <div className="text-xs text-muted-foreground hidden sm:block">FEDERAL UNIVERSITY TEACHING HOSPITAL</div>
          <div className="text-base font-bold text-foreground leading-tight">FUTH LAFIA</div>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-green-500" />
          <span>System Active</span>
        </div>

        <RoleSwitcher
          user={{
            id: user?.id,
            role: user?.role,
            activeRole: user?.activeRole || user?.role,
            secondaryRoles: user?.secondaryRoles || [],
          }}
        />

        <NotificationBell initialUnread={0} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-1.5 lg:px-3 h-10 hover:bg-secondary/50">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {initials(user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-sm font-medium text-foreground max-w-32 truncate">
                  {user?.fullName}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {user?.designation?.code || roleLabel[role]}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {initials(user?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <div className="font-semibold text-sm">{user?.fullName}</div>
                    <div className="text-xs text-muted-foreground">@{user?.username}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={`text-[10px] font-medium ${roleBadgeColor[role] || 'bg-gray-100 text-gray-700'}`}>
                    {roleLabel[role] || role}
                  </Badge>
                  {(user?.secondaryRoles || []).length > 0 && (
                    <span className="text-[10px] text-muted-foreground self-center">
                      +{user.secondaryRoles.length} more
                    </span>
                  )}
                  {user?.designation && (
                    <Badge variant="outline" className="text-[10px]">
                      {user.designation.code}
                    </Badge>
                  )}
                  {user?.department && (
                    <Badge variant="outline" className="text-[10px]">
                      {user.department.code}
                    </Badge>
                  )}
                </div>
                {user?.email && (
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">{user.email}</div>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate('settings')}>
              <User className="size-4 mr-2" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('settings')}>
              <SettingsIcon className="size-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
