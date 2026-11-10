'use client'

import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  FileText,
  BriefcaseBusiness,
  Users,
  Mail,
  Settings,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
  Plane,
  UserCog,
  Users2,
  TrendingUp,
  UserMinus,
  DoorOpen,
  HandCoins,
  GraduationCap,
  Building2,
  Network,
  Receipt,
  ListChecks,
  Award,
  FileBarChart,
  ArrowLeftRight,
  Files,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export type ViewKey =
  | 'dashboard'
  | 'cmd-dashboard'
  | 'cmd-mail'
  | 'requisitions'
  | 'projects'
  | 'reports'
  | 'files'
  | 'committees'
  | 'documents'
  | 'staff'
  | 'duties'
  | 'appraisals'
  | 'department-ratings'
  | 'leaves'
  | 'promotions'
  | 'terminations'
  | 'resignations'
  | 'retirements'
  | 'payment-vouchers'
  | 'posting-transfer'
  | 'trainings'
  | 'designations'
  | 'departments'
  | 'units'
  | 'user-mgmt'
  | 'mail'
  | 'settings'

type NavItem = {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  badgeKey?: 'pendingReqs' | 'unreadMail'
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'cmd-dashboard', label: 'CMD Dashboard', icon: ShieldCheck, roles: ['CMD', 'SUPER_ADMIN'] },
  { key: 'cmd-mail', label: 'CMD Mail', icon: Inbox, roles: ['CMD', 'SUPER_ADMIN'], badgeKey: 'unreadMail' },
  { key: 'requisitions', label: 'Requisitions', icon: FolderKanban, badgeKey: 'pendingReqs' },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'files', label: 'Registry Files', icon: FileText },
  { key: 'committees', label: 'Committees', icon: Users2 },
  { key: 'documents', label: 'Documents', icon: Files },
  { key: 'staff', label: 'Staff Directory', icon: Users },
  { key: 'duties', label: 'Duties', icon: ListChecks },
  { key: 'appraisals', label: 'Appraisals & Reviews', icon: ClipboardList },
  { key: 'department-ratings', label: 'Department Ratings', icon: Award },
  { key: 'leaves', label: 'Leave Management', icon: Plane },
  { key: 'promotions', label: 'Promotions', icon: TrendingUp },
  { key: 'terminations', label: 'Terminations', icon: UserMinus },
  { key: 'resignations', label: 'Resignations', icon: DoorOpen },
  { key: 'retirements', label: 'Retirements', icon: HandCoins },
  { key: 'payment-vouchers', label: 'Payment Vouchers', icon: Receipt },
  { key: 'posting-transfer', label: 'Posting & Transfer', icon: ArrowLeftRight },
  { key: 'trainings', label: 'Training', icon: GraduationCap },
  { key: 'departments', label: 'Departments', icon: Building2 },
  { key: 'units', label: 'Units', icon: Network },
  { key: 'designations', label: 'Designations', icon: BriefcaseBusiness },
  { key: 'user-mgmt', label: 'User Management', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { key: 'mail', label: 'Mail', icon: Mail, badgeKey: 'unreadMail' },
  { key: 'settings', label: 'Settings', icon: Settings },
]

type Props = {
  current: ViewKey
  onNavigate: (v: ViewKey) => void
  userRole: string
  badges: { pendingReqs?: number; unreadMail?: number }
  allowedPages?: string[]            // dynamic permission filter from /api/me/permissions
  isMobile?: boolean
  onNavigateCommit?: () => void
}

export default function Sidebar({
  current,
  onNavigate,
  userRole,
  badges,
  allowedPages,
  isMobile,
  onNavigateCommit,
}: Props) {
  const visibleItems = navItems.filter((item) => {
    // System-only role gate (cmd-mail, user-mgmt): always applied
    if (item.roles) {
      if (!item.roles.includes(userRole)) return false
    }
    // Dynamic permission filter — only applied when allowedPages is a
    // non-undefined array. If undefined (still loading), show everything
    // to avoid an empty sidebar during load.
    if (allowedPages !== undefined && allowedPages.length === 0) {
      // Empty array — only items whose key is in the array
      return allowedPages.includes(item.key)
    }
    if (allowedPages !== undefined && allowedPages.length > 0) {
      return allowedPages.includes(item.key)
    }
    return true
  })

  const handleNav = (key: ViewKey) => {
    onNavigate(key)
    if (onNavigateCommit) onNavigateCommit()
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full w-full',
        'bg-sidebar text-sidebar-foreground',
      )}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
        <div className="futh-logo"><img src="/futh-logo.jpeg" alt="FUTH LAFIA logo" /></div>
        <div className="leading-tight">
          <div className="font-bold text-sm tracking-wide">FUTH LAFIA</div>
          <div className="text-[10px] text-white/70">HR & PMS System</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scroll-thin">
        <div className="px-2 pb-2 text-[10px] uppercase tracking-wider text-white/50 font-semibold">
          Main Menu
        </div>
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = current === item.key
          const count = item.badgeKey ? badges[item.badgeKey] : undefined
          return (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all',
                active
                  ? 'bg-white text-[#14532d] font-semibold shadow-sm'
                  : 'text-white/90 hover:bg-white/10',
              )}
            >
              <Icon className="size-4 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {count !== undefined && count > 0 && (
                <Badge
                  variant={item.badgeKey === 'pendingReqs' ? 'destructive' : 'secondary'}
                  className="h-5 px-1.5 text-[10px] font-bold"
                >
                  {count > 99 ? '99+' : count}
                </Badge>
              )}
              {!active && <ChevronRight className="size-3 opacity-50" />}
            </button>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-[11px] text-white/60">
        <div className="font-medium text-white/80 mb-1">FUTH LAFIA PMS</div>
        <div>v1.0.0 · © {new Date().getFullYear()}</div>
      </div>
    </aside>
  )
}
