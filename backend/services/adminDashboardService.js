import mongoose from 'mongoose';
import {
  AuditLog,
  Course,
  CourseFaculty,
  CustomDomain,
  Department,
  Enrollment,
  Institution,
  University,
} from '../models.js';

export class AdminApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizedName(value = '') {
  return String(value).normalize('NFKC').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

export async function resolveAdminScope(user) {
  if (!user || user.role !== 'admin') throw new AdminApiError(403, 'Admin access required.');
  if (!mongoose.connection.readyState) {
    throw new AdminApiError(503, 'The admin dashboard requires a MongoDB connection.');
  }

  let institution = user.institutionId
    ? await Institution.findById(user.institutionId)
    : null;
  if (!institution && user.institution) {
    institution = await Institution.findOne({ name: user.institution });
  }
  if (!institution) {
    throw new AdminApiError(403, 'No institution is assigned to this admin account.');
  }

  const userDepartmentName = normalizedName(user.department);
  let scopedDepartment = user.departmentId
    ? await Department.findOne({ _id: user.departmentId, institutionId: institution._id })
    : null;
  if (user.departmentId && !scopedDepartment) {
    throw new AdminApiError(403, 'The department assigned to this admin is not in this institution.');
  }
  if (!scopedDepartment && userDepartmentName) {
    scopedDepartment = await Department.findOne({
      institutionId: institution._id,
      $or: [
        { name: new RegExp(`^${String(user.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { code: new RegExp(`^${String(user.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    });
  }
  if (!scopedDepartment) {
    throw new AdminApiError(403, 'No department is assigned to this admin account.');
  }

  return { institution, department: scopedDepartment };
}

export const courseStatusOptions = [
  { status: 'active', label: 'Active Curriculum' },
  { status: 'inactive', label: 'Inactive' },
  { status: 'archived', label: 'Archived' },
  { status: 'upcoming', label: 'Upcoming' },
];

export function publicCourseStatusLabel(status) {
  return courseStatusOptions.find((option) => option.status === status)?.label || 'Unknown';
}

export function sanitizeAuditValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (typeof value.toObject === 'function') return sanitizeAuditValue(value.toObject());
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(token|secret|private.?key|password)/i.test(key))
      .map(([key, child]) => [key, sanitizeAuditValue(child)])
  );
}

export async function recordAdminAudit(req, scope, entry) {
  await AuditLog.create({
    institutionId: scope.institution._id,
    actorId: String(req.user.id),
    action: entry.action,
    entityType: entry.entityType,
    entityId: String(entry.entityId),
    before: sanitizeAuditValue(entry.before),
    after: sanitizeAuditValue(entry.after),
    ip: String(req.ip || '').slice(0, 64),
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
  });
}

export async function getAdminDashboard(scope) {
  const [institution, department, courses, domain] = await Promise.all([
    Institution.findById(scope.institution._id).lean(),
    Department.findById(scope.department._id).lean(),
    Course.find({ institutionId: scope.institution._id, departmentId: scope.department._id })
      .sort({ code: 1 })
      .lean(),
    CustomDomain.findOne({
      institutionId: scope.institution._id,
      releasedAt: { $exists: false },
    }).select('+verificationToken').lean(),
  ]);
  const university = institution.universityId
    ? await University.findById(institution.universityId).lean()
    : null;
  const courseIds = courses.map((course) => course._id);
  const [facultyAssignments, enrollmentCounts] = courseIds.length
    ? await Promise.all([
      CourseFaculty.find({ courseId: { $in: courseIds }, active: true })
        .populate('facultyId', 'id name role')
        .lean(),
      Enrollment.aggregate([
        { $match: { courseId: { $in: courseIds }, status: 'enrolled' } },
        { $group: { _id: '$courseId', enrolledCount: { $sum: 1 } } },
      ]),
    ])
    : [[], []];

  const facultyByCourse = new Map();
  for (const assignment of facultyAssignments) {
    if (!assignment.facultyId) continue;
    const key = String(assignment.courseId);
    const faculty = facultyByCourse.get(key) || [];
    faculty.push({
      id: String(assignment.facultyId.id || assignment.facultyId._id),
      name: assignment.facultyId.name,
      role: assignment.role,
    });
    facultyByCourse.set(key, faculty);
  }
  const countByCourse = new Map(enrollmentCounts.map((entry) => [
    String(entry._id),
    entry.enrolledCount,
  ]));
  const courseRows = courses.map((course) => {
    const faculty = (facultyByCourse.get(String(course._id)) || [])
      .sort((left, right) => (left.role === 'primary' ? -1 : right.role === 'primary' ? 1 : 0));
    const primaryFaculty = faculty.find((item) => item.role === 'primary');
    return {
      ...course,
      faculty,
      facultyName: primaryFaculty?.name || 'Unassigned',
      enrolledCount: countByCourse.get(String(course._id)) || 0,
      statusLabel: publicCourseStatusLabel(course.status),
    };
  });
  const totalEnrolled = courseRows.reduce((total, course) => total + course.enrolledCount, 0);

  return {
    institution: {
      name: institution.name,
      shortName: institution.shortName,
      city: institution.city,
      department: { id: String(department._id), name: department.name },
      affiliation: {
        university: university?.name || '',
        short: university?.shortName || '',
      },
      accreditations: institution.accreditations || [],
      nirfBand: institution.nirfBand || '',
    },
    domain: domain ? {
      domain: domain.domain,
      status: domain.status,
      recordType: domain.recordType,
      target: domain.target,
      verification: {
        type: domain.verificationType,
        host: `_acadlytic-verify.${domain.domain}`,
        value: domain.verificationToken,
        verifiedAt: domain.verifiedAt,
      },
      ssl: {
        status: domain.ssl?.status || 'none',
        protocol: domain.ssl?.protocol || '',
        issuer: domain.ssl?.issuer || '',
        expiresAt: domain.ssl?.expiresAt || null,
        autoRenew: Boolean(domain.ssl?.autoRenew),
      },
      lastCheckedAt: domain.lastCheckedAt,
      lastError: domain.lastError,
    } : null,
    courses: courseRows,
    statusOptions: courseStatusOptions,
    stats: {
      totalCourses: courseRows.length,
      totalEnrolled,
      unassignedCourses: courseRows.filter((course) => !course.faculty.some((item) => item.role === 'primary')).length,
    },
  };
}

export async function listAdminCourses(scope, query) {
  const filter = {
    institutionId: scope.institution._id,
    departmentId: scope.department._id,
  };
  if (query.status) filter.status = query.status;
  if (query.semester) filter.semester = query.semester;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { code: new RegExp(escaped, 'i') },
      { name: new RegExp(escaped, 'i') },
    ];
  }
  const skip = (query.page - 1) * query.limit;
  const [total, courses] = await Promise.all([
    Course.countDocuments(filter),
    Course.find(filter).sort({ code: 1 }).skip(skip).limit(query.limit).lean(),
  ]);
  const dashboardData = await getAdminDashboard(scope);
  const courseRows = new Map(dashboardData.courses.map((course) => [String(course._id), course]));
  return {
    courses: courses.map((course) => courseRows.get(String(course._id)) || course),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}
