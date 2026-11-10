'use client'

import { createContext, useContext } from 'react'

export type PagePermission = {
  key: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

export type PermissionsState = {
  pages: string[]                   // page keys the user can VIEW
  permissions: PagePermission[]    // per-page granular permissions
  loading: boolean
}

export const PermissionsContext = createContext<PermissionsState>({
  pages: [],
  permissions: [],
  loading: true,
})

export function usePermissions(): PermissionsState {
  return useContext(PermissionsContext)
}

export function useCanCreate(pageKey: string): boolean {
  const { permissions } = usePermissions()
  const p = permissions.find((p) => p.key === pageKey)
  return p?.canCreate ?? false
}

export function useCanEdit(pageKey: string): boolean {
  const { permissions } = usePermissions()
  const p = permissions.find((p) => p.key === pageKey)
  return p?.canEdit ?? false
}

export function useCanDelete(pageKey: string): boolean {
  const { permissions } = usePermissions()
  const p = permissions.find((p) => p.key === pageKey)
  return p?.canDelete ?? false
}

export function useCanView(pageKey: string): boolean {
  const { pages } = usePermissions()
  return pages.includes(pageKey)
}
