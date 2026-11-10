// Shared Prisma include helpers for nested relations

export const userInclude = {
  designation: true,
  department: true,
  staff: true,
} as const

export const requisitionInclude = {
  createdBy: { include: { designation: true, department: true } },
  assignee: { include: { designation: true, department: true } },
  targetUser: { include: { designation: true, department: true } },
  targetDesignation: true,
  department: true,
  closedBy: { include: { designation: true } },
  routes: {
    orderBy: { createdAt: 'asc' as const,
    },
    include: {
      fromUser: { include: { designation: true, department: true } },
      toUser: { include: { designation: true, department: true } },
      toDesignation: true,
    },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const,
    },
    include: {
      user: { include: { designation: true } },
    },
  },
  attachments: true,
} as const

export const fileInclude = {
  createdBy: { include: { designation: true, department: true } },
  currentHolder: { include: { designation: true, department: true } },
  targetUser: { include: { designation: true, department: true } },
  targetDesignation: true,
  department: true,
  committee: true,
  routes: {
    orderBy: { createdAt: 'asc' as const,
    },
    include: {
      fromUser: { include: { designation: true, department: true } },
      toUser: { include: { designation: true, department: true } },
      toDesignation: true,
    },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const,
    },
    include: {
      user: { include: { designation: true } },
    },
  },
  attachments: true,
} as const

export const mailInclude = {
  from: { include: { designation: true, department: true } },
  to: { include: { designation: true, department: true } },
  parent: { select: { id: true, subject: true } },
  replies: { select: { id: true, subject: true } },
} as const

// Strip sensitive fields like passwordHash from a user record
export function sanitizeUser<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
  if (!user) return user
  const { passwordHash, ...rest } = user
  return rest
}
