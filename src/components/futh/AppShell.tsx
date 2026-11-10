'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import Sidebar, { type ViewKey } from './Sidebar'
import Topbar from './Topbar'
import { useCurrentUser } from '@/hooks/use-current-user'
import { PermissionsContext, type PagePermission } from '@/lib/permissions-context'

type Props = {
  current: ViewKey
  onNavigate: (v: ViewKey) => void
  children: React.ReactNode
}

export default function AppShell({ current, onNavigate, children }: Props) {
  const { user, logout } = useCurrentUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [badges, setBadges] = useState<{ pendingReqs?: number; unreadMail?: number }>({})
  const [allowedPages, setAllowedPages] = useState<string[] | undefined>(undefined)
  const [permissions, setPermissions] = useState<PagePermission[]>([])
  const [permsLoading, setPermsLoading] = useState(true)

  const refreshBadges = useCallback(async () => {
    try {
      const [reqRes, mailRes] = await Promise.all([
        fetch('/api/requisitions?tab=pending&limit=1', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/mail?folder=inbox&filter=unread', { cache: 'no-store' }).then((r) => r.json()),
      ])
      const pendingCount = reqRes?.requisitions?.length ?? 0
      const unreadCount = mailRes?.mail?.length ?? 0
      setBadges({ pendingReqs: pendingCount, unreadMail: unreadCount })
    } catch {}
  }, [])

  const refreshPermissions = useCallback(async () => {
    if (!user) {
      setAllowedPages(undefined)
      setPermissions([])
      setPermsLoading(true)
      return
    }
    try {
      const res = await fetch('/api/me/permissions', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setAllowedPages(data.pages || [])
        setPermissions(data.permissions || [])
      } else {
        setAllowedPages([])
        setPermissions([])
      }
    } catch {
      setAllowedPages([])
      setPermissions([])
    }
    setPermsLoading(false)
  }, [user])

  useEffect(() => {
    refreshBadges()
    const t = setInterval(refreshBadges, 30000)
    return () => clearInterval(t)
  }, [refreshBadges])

  useEffect(() => {
    refreshPermissions()
  }, [refreshPermissions])

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <PermissionsContext.Provider
      value={{ pages: allowedPages || [], permissions, loading: permsLoading }}
    >
      <div className="min-h-screen flex flex-col">
        {/* Sidebar — desktop */}
        <div className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:fixed lg:inset-y-0 lg:z-20">
          <Sidebar
            current={current}
            onNavigate={onNavigate}
            userRole={user.activeRole || user.role}
            badges={badges}
            allowedPages={allowedPages}
          />
        </div>

        {/* Mobile sidebar — Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-72 max-w-[85vw]">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <Sidebar
              current={current}
              onNavigate={onNavigate}
              userRole={user.activeRole || user.role}
              badges={badges}
              allowedPages={allowedPages}
              isMobile
              onNavigateCommit={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <Topbar
            user={user}
            unreadMail={badges.unreadMail || 0}
            pendingReqs={badges.pendingReqs || 0}
            onLogout={handleLogout}
            onNavigate={onNavigate}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
          <footer className="mt-auto border-t border-border bg-white px-6 py-3 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} FEDERAL UNIVERSITY TEACHING HOSPITAL · HUMAN RESOURCES MANAGEMENT SYSTEM
          </footer>
        </div>
      </div>
    </PermissionsContext.Provider>
  )
}
