import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import bcrypt from 'bcryptjs'

// GET /api/users — list all active users
// Available to ANY logged-in user (used for mail recipient dropdowns, file
// routing, etc.). Non-admin users get a lighter response (no rolePermissions).
export async function GET(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(me.role)
    const { searchParams } = new URL(req.url)
    const withInactive = searchParams.get('withInactive') === 'true'
    const search = searchParams.get('q')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    const showInactive = isAdmin && withInactive

    const where: any = {}
    if (!showInactive) where.isActive = true
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } },
        { staff: { ippisNumber: { contains: search } } },
        { staff: { staffId: { contains: search } } },
        { designation: { code: { contains: search } } },
        { designation: { name: { contains: search } } },
        { department: { code: { contains: search } } },
        { department: { name: { contains: search } } },
      ]
    }

    // Non-admin: lighter response with limit
    if (!isAdmin) {
      const users = await db.user.findMany({
        where,
        orderBy: [{ fullName: 'asc' }],
        take: limit,
        skip: offset,
        select: {
          id: true, fullName: true, username: true, email: true, role: true, isActive: true,
          designation: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      })
      const total = await db.user.count({ where })
      return NextResponse.json({ users, total, limit, offset })
    }

    // Admin: full response with pagination
    const users = await db.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      take: limit,
      skip: offset,
      include: {
        designation: true,
        department: true,
        staff: { select: { id: true, staffId: true, fullName: true, position: true } },
      },
    })
    const total = await db.user.count({ where })
    const safe = users.map(({ passwordHash, ...rest }: any) => rest)
    return NextResponse.json({ users: safe, total, limit, offset })
  } catch (e: any) {
    console.error('Users list error:', e)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }
    const body = await req.json()
    const { username, email, fullName, password, role, phone, designationId, departmentId, staffId, isActive } = body || {}

    if (!username || !email || !fullName || !password) {
      return NextResponse.json({ error: 'Username, email, full name, and password are required' }, { status: 400 })
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ username }, { email }] },
    })
    if (existing) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 })
    }

    const passwordHash = bcrypt.hashSync(password, 10)

    const user = await db.user.create({
      data: {
        username, email, fullName, passwordHash,
        phone: phone || null, role: role || 'STAFF',
        designationId: designationId || null, departmentId: departmentId || null,
        staffId: staffId || null, isActive: isActive !== undefined ? !!isActive : true,
      },
      include: { designation: true, department: true, staff: true },
    })
    const { passwordHash: _, ...safe } = user
    await audit(me, 'create', { entity: 'User', entityId: user.id, details: `Created user ${username} (${role || 'STAFF'})`, ipAddress: getIp(req) })
    return NextResponse.json({ user: safe })
  } catch (e: any) {
    console.error('User create error:', e)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
