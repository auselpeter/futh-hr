import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

async function generateTemplateCode(name: string): Promise<string> {
  const baseCode = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/(^_|_$)/g, '').slice(0, 30)
  let suffix = ''
  let code = baseCode
  // Ensure uniqueness with a numeric suffix
  let n = 1
  while (await db.reportTemplate.findUnique({ where: { code } })) {
    suffix = `_${n++}`
    code = `${baseCode.slice(0, 30 - suffix.length)}${suffix}`
  }
  return code
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Filter templates by user's access level
    const role = user.activeRole || user.role
    let accessLevels: string[] = []
    if (['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA'].includes(role)) accessLevels = ['executive', 'directorate', 'management', 'officer', 'staff', 'all']
    else if (['AD', 'DFA'].includes(role)) accessLevels = ['directorate', 'management', 'officer', 'staff', 'all']
    else if (['HOD', 'HOU'].includes(role)) accessLevels = ['management', 'officer', 'staff', 'all']
    else if (['APPRAISAL_OFFICER', 'REGISTRY_OFFICER'].includes(role)) accessLevels = ['officer', 'staff', 'all']
    else accessLevels = ['staff', 'all']

    const templates = await db.reportTemplate.findMany({
      where: {
        isActive: true,
        accessLevel: { in: accessLevels },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ templates })
  } catch (e: any) {
    console.error('Report templates list:', e)
    return NextResponse.json({ error: 'Failed to fetch report templates' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = user.activeRole || user.role
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to create templates' }, { status: 403 })
    }
    const body = await req.json()
    const { name, description, category, accessLevel, module, format, icon, hasDateRange, hasDeptFilter, sortOrder } = body || {}
    if (!name || !category) return NextResponse.json({ error: 'name and category are required' }, { status: 400 })

    const code = body.code || await generateTemplateCode(name)
    const template = await db.reportTemplate.create({
      data: {
        code,
        name,
        description: description || null,
        category,
        accessLevel: accessLevel || 'management',
        module: module || 'staff',
        format: format || 'both',
        icon: icon || null,
        hasDateRange: hasDateRange !== undefined ? Boolean(hasDateRange) : true,
        hasDeptFilter: hasDeptFilter !== undefined ? Boolean(hasDeptFilter) : true,
        sortOrder: sortOrder ? Number(sortOrder) : 100,
        isActive: true,
      },
    })
    await audit(user, 'create', { entity: 'ReportTemplate', entityId: template.id, details: `Created template ${code}`, ipAddress: getIp(req) })
    return NextResponse.json({ template })
  } catch (e: any) {
    console.error('Report template create:', e)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
