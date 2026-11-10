'use client'

import { useEffect, useState, useCallback } from 'react'

export type CurrentUser = {
  id: string
  email: string
  username: string
  fullName: string
  phone: string | null
  avatarUrl: string | null
  role: string             // primary role
  activeRole: string       // override role or primary (used for permission checks)
  secondaryRoles: string[] // additional roles this user can switch to
  staffId: string | null
  designationId: string | null
  departmentId: string | null
  isActive: boolean
  lastLoginAt: string | null
  designation?: { id: string; code: string; name: string; rank: number; level: string } | null
  department?: { id: string; code: string; name: string; faculty: string | null } | null
  staff?: { id: string; staffId: string; fullName: string; position: string | null; rank: string | null } | null
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await res.json()
      if (data && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch user')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setUser(null)
  }, [])

  return { user, loading, error, refresh, logout, setUser }
}

// API helper — returns { data, error, status }
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (!res.ok) {
      const msg = (data && data.error) || `Request failed (${res.status})`
      return { data: null, error: msg, status: res.status }
    }
    return { data, error: null, status: res.status }
  } catch (e: any) {
    return { data: null, error: e.message || 'Network error', status: 0 }
  }
}
