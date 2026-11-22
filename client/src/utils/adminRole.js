export const ADMIN_ROLES = {
  SYSTEM_DEVELOPER: 'system_developer',
  SYSTEM_ADMIN: 'system_admin',
  VALIDATOR: 'validator',
}

export const ROLE_DEFINITIONS = [
  {
    key: ADMIN_ROLES.SYSTEM_DEVELOPER,
    label: 'System Developer',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    summary: 'Strictly technical maintainer for diagnostics, system error logs, and account turnover.',
    permissions: [
      'Full System Error Logs with stack traces and technical diagnostics',
      'Developer-side system governance and System Admin account handover',
      'Isolated from day-to-day operational modules (courses, users, validators)',
    ],
  },
  {
    key: ADMIN_ROLES.SYSTEM_ADMIN,
    label: 'System Admin',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-800',
    summary: 'Dedicated platform operator managing daily LearnMatch operations and staff.',
    permissions: [
      'Full access to Courses, Users, Assessment Monitoring, Analytics, and Feedback',
      'Add Co-Admin accounts and generate Course Validator invite links',
      'Reportable System Error Logs (without developer tools or stack traces)',
    ],
  },
  {
    key: ADMIN_ROLES.VALIDATOR,
    label: 'Course Validator',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    summary: 'Subject-matter expert onboarded via secure single-use invitation link.',
    permissions: [
      'Review assigned course drafts, sources, and career/salary evidence',
      'Approve, request revisions, and digitally sign off on courses',
      'Isolated from student records, admin accounts, and system logs',
    ],
  },
]

export function normalizeRole(role) {
  if (role === 'admin' || role === ADMIN_ROLES.SYSTEM_DEVELOPER) return ADMIN_ROLES.SYSTEM_DEVELOPER
  if (role === ADMIN_ROLES.SYSTEM_ADMIN) return ADMIN_ROLES.SYSTEM_ADMIN
  if (role === ADMIN_ROLES.VALIDATOR) return ADMIN_ROLES.VALIDATOR
  return ADMIN_ROLES.SYSTEM_DEVELOPER
}

export function getRoleMeta(role) {
  const normalized = normalizeRole(role)
  return ROLE_DEFINITIONS.find((item) => item.key === normalized) || ROLE_DEFINITIONS[0]
}

export function getStoredAdminRole() {
  const stored = localStorage.getItem('adminRole')
  if (stored) return normalizeRole(stored)
  const token = localStorage.getItem('adminToken')
  if (!token) return ADMIN_ROLES.SYSTEM_DEVELOPER
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return ADMIN_ROLES.SYSTEM_DEVELOPER
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return normalizeRole(payload?.role)
  } catch {
    return ADMIN_ROLES.SYSTEM_DEVELOPER
  }
}
