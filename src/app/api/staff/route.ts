import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isAdmin, isRegistry } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { buildScopeFilter, applyScope } from '@/lib/scope'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const departmentId = searchParams.get('departmentId')
    const designationId = searchParams.get('designationId')
    const status = searchParams.get('status')
    const unitId = searchParams.get('unitId')
    const rank = searchParams.get('rank')
    const gradeLevel = searchParams.get('gradeLevel')
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')
    const countOnly = searchParams.get('count') === 'true'

    const where: any = {}
    if (q) {
      where.OR = [
        { fullName: { contains: q } },
        { staffId: { contains: q } },
        { ippisNumber: { contains: q } },
        { email: { contains: q } },
        { ninNumber: { contains: q } },
        { pensionNumber: { contains: q } },
      ]
    }
    if (departmentId) where.departmentId = departmentId
    if (designationId) where.designationId = designationId
    if (status) where.status = status
    if (unitId) where.unitId = unitId
    if (rank) where.rank = rank
    if (gradeLevel) where.gradeLevel = gradeLevel

    // Apply role-based data scope
    const scopeWhere = buildScopeFilter(user, 'staff')
    const finalWhere = applyScope(where, scopeWhere)

    // If only count is requested, return the total
    if (countOnly) {
      const total = await db.staff.count({ where: finalWhere })
      return NextResponse.json({ total })
    }

    const staff = await db.staff.findMany({
      where: finalWhere,
      orderBy: [{ fullName: 'asc' }],
      take: limit,
      skip: offset,
      include: {
        department: true,
        designation: true,
        unit: true,
        user: { select: { id: true, username: true, role: true, isActive: true } },
        // Light nested — just count, not full records (for list display)
        _count: { select: { nextOfKin: true, bankDetails: true, academicBackground: true, dependants: true } },
      },
    })

    // Also return the total count for pagination
    const total = await db.staff.count({ where: finalWhere })

    return NextResponse.json({ staff, total, limit, offset })
  } catch (e: any) {
    console.error('Staff list error:', e)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const effectiveRole = user.activeRole || user.role
    if (!isAdmin(effectiveRole) && !isRegistry(effectiveRole)) {
      return NextResponse.json({ error: 'Only administrators or Registry Officers can create staff records' }, { status: 403 })
    }
    const body = await req.json()

    const {
      staffId, ippisNumber,
      // Personal
      surname, firstName, otherNames, gender, dateOfBirth, maritalStatus,
      nationality, religion, stateOfOrigin, lga,
      // Government
      ninNumber, tinNumber, pensionNumber, nhfNumber, nhisNumber,
      // Contact
      email, phone, altPhone,
      // Address
      residentialAddress, permanentAddress, cityOfResidence, stateOfResidence,
      // Employment
      position, rank, employmentType, dateHired, confirmationDate, retirementDate,
      status, departmentId, designationId, unitId,
      fileNumber, gradeLevel, step, cadre,
      // Biometrics
      avatarUrl, signatureUrl, thumbprintUrl, pictureUrl,
      // Nested
      nextOfKin, bankDetails, academicBackground, dependants,
    } = body || {}

    if (!staffId || !surname || !firstName) {
      return NextResponse.json({ error: 'staffId, surname and firstName are required' }, { status: 400 })
    }
    const existing = await db.staff.findUnique({ where: { staffId: String(staffId) } })
    if (existing) {
      return NextResponse.json({ error: 'A staff record with that staffId already exists' }, { status: 409 })
    }

    const fullName = otherNames ? `${firstName} ${otherNames} ${surname}` : `${firstName} ${surname}`

    const toDate = (v: any) => (v ? new Date(v) : null)

    const staff = await db.$transaction(async (tx) => {
      const created = await tx.staff.create({
        data: {
          staffId: String(staffId),
          ippisNumber: ippisNumber ? String(ippisNumber) : null,
          surname: String(surname),
          firstName: String(firstName),
          otherNames: otherNames ? String(otherNames) : null,
          fullName,
          gender: gender || null,
          dateOfBirth: toDate(dateOfBirth),
          maritalStatus: maritalStatus || null,
          nationality: nationality || 'Nigerian',
          religion: religion || null,
          stateOfOrigin: stateOfOrigin || null,
          lga: lga || null,
          ninNumber: ninNumber || null,
          tinNumber: tinNumber || null,
          pensionNumber: pensionNumber || null,
          nhfNumber: nhfNumber || null,
          nhisNumber: nhisNumber || null,
          email: email || null,
          phone: phone || null,
          altPhone: altPhone || null,
          residentialAddress: residentialAddress || null,
          permanentAddress: permanentAddress || null,
          cityOfResidence: cityOfResidence || null,
          stateOfResidence: stateOfResidence || null,
          position: position || null,
          rank: rank || null,
          employmentType: employmentType || 'permanent',
          fileNumber: fileNumber || null,
          gradeLevel: gradeLevel || null,
          step: step || null,
          cadre: cadre || null,
          dateHired: toDate(dateHired),
          confirmationDate: toDate(confirmationDate),
          retirementDate: toDate(retirementDate),
          status: status || 'active',
          departmentId: departmentId || null,
          designationId: designationId || null,
          unitId: unitId || null,
          avatarUrl: avatarUrl || null,
          signatureUrl: signatureUrl || null,
          thumbprintUrl: thumbprintUrl || null,
          pictureUrl: pictureUrl || null,
        },
      })

      // Nested: NextOfKin (max 3)
      if (Array.isArray(nextOfKin)) {
        for (const nok of nextOfKin.slice(0, 3)) {
          if (!nok?.fullName) continue
          await tx.nextOfKin.create({
            data: {
              staffId: created.id,
              fullName: String(nok.fullName),
              relationship: nok.relationship || null,
              gender: nok.gender || null,
              phone: nok.phone || null,
              email: nok.email || null,
              address: nok.address || null,
              city: nok.city || null,
              state: nok.state || null,
              occupation: nok.occupation || null,
              employerName: nok.employerName || null,
              isPrimary: !!nok.isPrimary,
            },
          })
        }
      }

      // Nested: BankDetail (max 2)
      if (Array.isArray(bankDetails)) {
        for (const bd of bankDetails.slice(0, 2)) {
          if (!bd?.bankName || !bd?.accountNumber) continue
          await tx.bankDetail.create({
            data: {
              staffId: created.id,
              bankName: String(bd.bankName),
              accountName: bd.accountName || '',
              accountNumber: String(bd.accountNumber),
              accountType: bd.accountType || 'Savings',
              branch: bd.branch || null,
              sortCode: bd.sortCode || null,
              bvnNumber: bd.bvnNumber || null,
              isPrimary: !!bd.isPrimary,
            },
          })
        }
      }

      // Nested: AcademicBackground (max 5)
      if (Array.isArray(academicBackground)) {
        for (const ab of academicBackground.slice(0, 5)) {
          if (!ab?.institution) continue
          await tx.academicBackground.create({
            data: {
              staffId: created.id,
              institution: String(ab.institution),
              qualification: ab.qualification || null,
              field: ab.field || null,
              startDate: toDate(ab.startDate),
              endDate: toDate(ab.endDate),
              grade: ab.grade || null,
              certificateUrl: ab.certificateUrl || null,
              certificateNumber: ab.certificateNumber || null,
            },
          })
        }
      }

      // Nested: Dependant (max 5)
      if (Array.isArray(dependants)) {
        for (const dp of dependants.slice(0, 5)) {
          if (!dp?.fullName) continue
          await tx.dependant.create({
            data: {
              staffId: created.id,
              fullName: String(dp.fullName),
              relationship: dp.relationship || null,
              dateOfBirth: toDate(dp.dateOfBirth),
              gender: dp.gender || null,
            },
          })
        }
      }

      return tx.staff.findUnique({
        where: { id: created.id },
        include: {
          department: true, designation: true,
          user: { select: { id: true, username: true, role: true, isActive: true } },
          nextOfKin: true, bankDetails: true, academicBackground: true, dependants: true,
        },
      })
    })

    // Auto-create a linked User account using fullName as username and IPPIS as password
    if (staff) {
      const username = fullName.toLowerCase().replace(/\s+/g, '_')
      const password = ippisNumber ? String(ippisNumber) : 'admin123'
      const emailAddr = email || `${username}@futhlafia.gov.ng`
      // Determine the role from the designation
      const dsg = designationId ? await db.designation.findUnique({ where: { id: designationId } }) : null
      const userRole = dsg?.code || 'STAFF'

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: { OR: [{ username }, { email: emailAddr }] },
      })
      if (!existingUser) {
        const newUser = await db.user.create({
          data: {
            username,
            email: emailAddr,
            fullName,
            passwordHash: bcrypt.hashSync(password, 10),
            role: userRole,
            phone: phone || null,
            designationId: designationId || null,
            departmentId: departmentId || null,
            unitId: unitId || null,
            staffId: staff.id,
            isActive: true,
          },
        })
        // Link the staff to the user
        await db.staff.update({ where: { id: staff.id }, data: { userId: newUser.id } })
        await audit(user, 'create', { entity: 'User', entityId: newUser.id, details: `Auto-created user ${username} (password: IPPIS) for staff ${fullName}`, ipAddress: getIp(req) })
      }
    }

    await audit(user, 'create', { entity: 'Staff', entityId: staff?.id, details: `Created staff record: ${staff?.fullName} (${staff?.staffId}) + auto-created user account`, ipAddress: getIp(req) })

    return NextResponse.json({ staff })
  } catch (e: any) {
    console.error('Create staff error:', e)
    return NextResponse.json({ error: 'Failed to create staff record' }, { status: 500 })
  }
}
